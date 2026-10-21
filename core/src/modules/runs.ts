// Runs (design §11): an agent's script run in its sandbox, serving its module. A run is a row; its
// steps are journal lines carrying its id; it reaches the person's stream only as a card. What a
// script reads from a site goes through the browser engine, and only to sites on its module's
// list: a new site waits on the person's yes (gate 1), which puts it on the list.
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import type { BrowserEngine, ExtractSpec } from '@alpha/connector-sdk'
import { Cron } from 'croner'
import { parse, stringify } from 'yaml'
import { config } from '../config.ts'
import { type Ask, askModel, inReadingOrder, type ReadSpec, readInto } from '../files/reading.ts'
import { decide } from '../gates/gates.ts'
import { runScript, type ScriptRun } from '../scripts/run.ts'
import { all, run as exec, parse as fromJson, json, newId, now, one } from '../world/db.ts'
import { Refused } from '../world/kinds.ts'
import type { Module, Table } from '../world/shape.ts'
import type { World } from '../world/world.ts'
import { type Agent, agents } from './agents.ts'
import type { Drafts } from './drafts.ts'
import { type JudgeSpec, judge } from './judging.ts'
import { Reviews } from './reviews.ts'

export interface RunOutcome {
  id: string
  state: 'ok' | 'failed' | 'stopped'
  words: string
  result: unknown
}

// Who a run serves: the person, and the desk's turn when the desk started it, so a card it
// opens shows in that turn.
export interface RunFor {
  user: string | null
  turn: string | null
}

export interface RunRow {
  id: string
  agent: string | null
  module: string | null
  startedAt: string
  endedAt: string | null
  state: 'running' | 'ok' | 'failed' | 'stopped'
  words: string | null
  tokens: number | null // the model's, when the run asked it to read something
}

const CHANGE_KINDS = ['wrote', 'changed', 'landed', 'removed']

// What a filing hands the agents waiting on one: each document read or put on a row since they
// last looked, with the rows it sits on.
export interface Filed {
  file: string
  name: string
  document: string
  kind: string // sheet, pdf, text
  rows: { table: string; row: string; kind: string | null }[]
}

export function moduleNetwork(module: Module): string[] {
  const file = join(module.dir, 'module.yaml')
  if (!existsSync(file)) return []
  const m = (parse(readFileSync(file, 'utf8')) ?? {}) as { network?: unknown }
  return Array.isArray(m.network) ? m.network.map(String) : []
}

function allowHost(module: Module, host: string): void {
  const file = join(module.dir, 'module.yaml')
  const m = (existsSync(file) ? parse(readFileSync(file, 'utf8')) : {}) as Record<string, unknown>
  const list = Array.isArray(m.network) ? m.network.map(String) : []
  if (!list.includes(host)) writeFileSync(file, stringify({ ...m, network: [...list, host] }))
}

const onList = (list: string[], host: string) =>
  list.some((d) => host === d || host.endsWith(`.${d}`))

export class AgentRunner {
  private world: World
  private engine: () => BrowserEngine
  private running = new Map<string, AbortController>()
  private notify: () => void
  private owner: string | null
  private ask: Ask
  private judgeAsk: Ask
  private tokens = new Map<string, number>() // a run's model tokens, while it runs
  drafts: Drafts | null = null // an agent's drafts, sent from the person's mail on their yes
  readonly reviews: Reviews // rows an agent puts to the person, on a card

  constructor(
    world: World,
    engine: () => BrowserEngine,
    options: {
      notify?: () => void
      owner?: string | null
      ask?: Ask // the model reading a document
      judge?: Ask // the model sorting items into the person's groups
    } = {},
  ) {
    this.world = world
    this.engine = engine
    this.notify = options.notify ?? (() => {})
    this.owner = options.owner ?? null
    this.ask = options.ask ?? askModel(world.paths.dir)
    this.judgeAsk =
      options.judge ?? options.ask ?? askModel(world.paths.dir, undefined, () => config.judging())
    this.reviews = new Reviews(world, this.owner)
  }

  // Sites a module's scripts may read: its list, or a yes on a card for that site (gate 1), which
  // puts the site on the list for good.
  private reach(module: Module, url: string, runId: string, who: RunFor): void {
    let host: string
    try {
      host = new URL(url).host.toLowerCase()
    } catch {
      throw new Refused(`That is not a link: ${url}`)
    }
    if (onList(moduleNetwork(module), host)) return
    const verdict = decide(this.world, {
      call: { tool: 'network', input: { module: module.id, host } },
      effect: 'outward',
      preview: `Let ${module.name} read ${host}?`,
      yes: 'Let it read',
      restsOn: [`a run of ${module.name}’s reader`],
      detail: `${module.name}'s readers would open pages on ${host} at a person's pace, keeping to its robots rules.`,
      cannotUndo: 'What a reader asks a site for leaves your world.',
      actor: { kind: 'agent', id: runId },
      user: who.user,
      turn: who.turn,
      module: module.id,
    })
    if (!verdict.pass)
      throw new Refused(
        `${host} is not on ${module.name}'s list: it waits for the person's yes on a card.`,
      )
    allowHost(module, host)
    this.world.line({
      actor: { kind: 'system' },
      kind: 'shaped',
      words: `${module.name} may now read ${host}.`,
      data: { module: module.id, host },
      module: module.id,
    })
  }

  // A site that wants the person to sign in: a card with Sign in, which opens the site in a window
  // of Alpha's browser where they sign in themselves; then the agent runs again (api: sign-in).
  private wantsSignIn(
    module: Module,
    url: string,
    label: string,
    runId: string,
    agentId: string | null,
    who: RunFor,
  ): void {
    const host = new URL(url).host.toLowerCase()
    this.world.cards.open({
      kind: 'permission',
      gate: 'sign_in',
      words: `${host} wants you to sign in`,
      detail: `${label} could not read ${host} without your sign-in. Sign in opens the site in a window of Alpha's browser; you type your login there yourself, Alpha never sees it, and the reader reads as you from then on.`,
      restsOn: [`a run of ${label}`],
      options: ['Sign in', 'Not now'],
      call: { tool: 'site_sign_in', input: { host, url, agent: agentId } },
      actor: { kind: 'agent', id: runId },
      user: who.user ?? this.owner,
      module: module.id,
      run: runId,
    })
  }

  private async browse<T>(
    module: Module,
    url: string,
    label: string,
    runId: string,
    agentId: string | null,
    who: RunFor,
    read: () => Promise<T>,
  ): Promise<T> {
    try {
      return await read()
    } catch (err) {
      if ((err as { kind?: string }).kind === 'sign_in')
        this.wantsSignIn(module, url, label, runId, agentId, who)
      throw err
    }
  }

  private api(module: Module, label: string, runId: string, who: RunFor, agentId: string | null) {
    const actor = { kind: 'agent' as const, id: label }
    const ctx = { actor, run: runId }
    const tableOf = (name: unknown): Table => {
      const t = this.world.shape.table(String(name))
      if (!t) throw new Refused(`There is no table called ${String(name)}.`)
      return t
    }
    return {
      'rows.list': async (p: Record<string, unknown>) => {
        const t = tableOf(p.table)
        const keys = new Map(
          all<{ id: string; item_key: string | null }>(
            this.world.db,
            'SELECT id, item_key FROM records WHERE table_id = ?',
            t.id,
          ).map((r) => [r.id, r.item_key]),
        )
        // values by field name, as land and compute take them
        const names = new Map(t.fields.map((f) => [f.slug, f.name]))
        return this.world.records.list(t.id).map((r) => ({
          id: r.id,
          key: keys.get(r.id) ?? null,
          updatedAt: r.updatedAt,
          values: Object.fromEntries(
            Object.entries(r.values).map(([k, v]) => [names.get(k) ?? k, v]),
          ),
          // a computed value's note as it was written, so a script can tell when its sum changed
          notes: Object.fromEntries(
            Object.entries(r.provenance)
              .filter(([, pv]) => pv.kind === 'computed' && pv.source.note)
              .map(([k, pv]) => [names.get(k) ?? k, pv.source.note]),
          ),
        }))
      },
      'rows.land': async (p: Record<string, unknown>) => {
        const t = tableOf(p.table)
        const items = (Array.isArray(p.items) ? p.items : []) as {
          key: string
          row?: string // a row already there, by its id
          values: Record<string, unknown>
          url?: string
          places?: Record<
            string,
            {
              file: string
              sheet?: string
              cell?: string
              page?: number
              line?: number
              box?: [number, number, number, number]
            }
          >
        }[]
        for (const i of items)
          if (i.url !== undefined && !/^https?:\/\//.test(String(i.url)))
            throw new Refused(
              `A row's url is the page it was read from, a web link; ${String(i.url)} is not one.`,
            )
        return this.world.records.land(
          t.id,
          items,
          { connector: `agent:${label}`, account: module.name },
          ctx,
        )
      },
      // the documents filed in the world, each with the rows it sits on, and one's cells or
      // lines with their places
      'documents.list': async () =>
        this.world.files.documents().map((d) => ({
          file: d.fileHash,
          name: this.world.files.file(d.fileHash)?.name ?? d.title,
          title: d.title,
          kind: d.kind,
          pieces: d.chunks,
          rows: this.world.rowsOfFile(d.fileHash).map((r) => ({
            table: this.world.shape.table(r.table)?.name ?? r.table,
            row: r.record,
            kind: r.kind,
          })),
        })),
      // a filed document put on a row of the module's own tables (the deal it is about)
      'documents.place': async (p: Record<string, unknown>) => {
        const t = tableOf(p.table)
        if (!this.world.shape.within(module.id).includes(t.module.id))
          throw new Refused(`${t.name} is not one of ${module.name}'s tables.`)
        const rec = this.world.records.get(String(p.row))
        if (rec?.table.id !== t.id) throw new Refused(`${t.name} has no row ${String(p.row)}.`)
        const placed = this.world.placeFile(
          String(p.file),
          rec.record.id,
          p.kind ? String(p.kind) : null,
          ctx,
        )
        this.notify()
        return { file: placed.file.hash, row: placed.record, kind: placed.kind }
      },
      // the model reads a document into the values the script names, each with the place it
      // was read from; what is not found where it is cited comes back as not given
      'documents.extract': async (p: Record<string, unknown>) => {
        const d = this.world.files.document(String(p.file))
        if (!d) throw new Refused('That document is not filed, or not read yet.')
        const chunks = this.world.files.chunks(d.id)
        const pieces = d.kind === 'pdf' ? inReadingOrder(chunks) : chunks
        const name = this.world.files.file(d.fileHash)?.name ?? d.title
        const out = await readInto(p.spec as ReadSpec, pieces, this.ask)
        this.tokens.set(runId, (this.tokens.get(runId) ?? 0) + out.tokens)
        const found =
          Object.values(out.values).filter(Boolean).length +
          Object.values(out.lists).reduce((n, l) => n + l.length, 0)
        this.world.line({
          actor,
          kind: 'run_step',
          words: `Read ${name}: ${found} found${out.dropped.length ? `; ${out.dropped.length} left out, not found where cited` : ''}.`,
          data: { file: d.fileHash, dropped: out.dropped, tokens: out.tokens },
          run: runId,
          module: module.id,
        })
        this.notify()
        return { values: out.values, lists: out.lists, dropped: out.dropped }
      },
      // the person's people (or companies), each with how to reach them, where they work, the
      // plain numbers of their contact, and the rows of the person's modules that name them
      'people.list': async (p: Record<string, unknown>) => {
        const kind = p.kind === 'company' ? 'company' : 'person'
        const named = this.world.people.namings()
        const born = new Map(
          all<{ id: string; created_at: string }>(
            this.world.db,
            'SELECT id, created_at FROM people WHERE merged_into IS NULL',
          ).map((r) => [r.id, r.created_at]),
        )
        return this.world.people.list(kind).map((x) => ({
          ...x,
          since: born.get(x.id) ?? null,
          named: named.get(x.id) ?? [],
        }))
      },
      // the model sorts items into the groups the person named, each with why; nothing is kept
      // from it until the script lands rows the person then decides
      judge: async (p: Record<string, unknown>) => {
        const out = await judge(p as unknown as JudgeSpec, this.judgeAsk)
        this.tokens.set(runId, (this.tokens.get(runId) ?? 0) + out.tokens)
        const sorted = out.judged.filter((j) => j.group).length
        this.world.line({
          actor,
          kind: 'run_step',
          words: `Sorted ${out.judged.length} into the groups given: ${sorted} placed.`,
          data: { tokens: out.tokens },
          run: runId,
          module: module.id,
        })
        this.notify()
        return out.judged
      },
      // rows of the module's own tables put to the person on one card, with the choices given
      review: async (p: Record<string, unknown>) => {
        const t = tableOf(p.table)
        if (!this.world.shape.within(module.id).includes(t.module.id))
          throw new Refused(`${t.name} is not one of ${module.name}'s tables.`)
        const card = this.reviews.open(
          {
            words: String(p.words ?? '').trim() || `Rows of ${t.name} for you to decide`,
            table: t,
            field: String(p.field ?? ''),
            choices: Array.isArray(p.choices) ? p.choices.map(String) : [],
            rows: Array.isArray(p.rows) ? p.rows.map(String) : [],
            note: p.note ? String(p.note) : null,
          },
          { agent: label, module: module.id, run: runId },
        )
        this.notify()
        return { card: card.id }
      },
      // an email drafted for the person's yes (or sent at once under a standing permission)
      'draft.email': async (p: Record<string, unknown>) => {
        if (!this.drafts) throw new Refused('Drafts are not set up in this core.')
        const about = p.about as { table?: unknown; row?: unknown } | undefined
        const t = about ? tableOf(about.table) : null
        const out = await this.drafts.propose(
          {
            agent: label,
            module: module.id,
            kind: String(p.kind ?? 'email'),
            key: p.key ? String(p.key) : null,
            connector: String(p.connector ?? 'gmail'),
            message: {
              to: String(p.to ?? ''),
              ...(p.cc ? { cc: String(p.cc) } : {}),
              subject: String(p.subject ?? ''),
              body: String(p.body ?? ''),
            },
            about: t && about ? { table: t.id, row: String(about.row) } : null,
            note: p.note ? String(p.note) : null,
          },
          runId,
        )
        this.notify()
        return out
      },
      'documents.read': async (p: Record<string, unknown>) => {
        const d = this.world.files.document(String(p.file))
        if (!d) throw new Refused('That document is not filed, or not read yet.')
        return this.world.files.chunks(d.id).map((c) => ({ ...c.position, words: c.words }))
      },
      'rows.compute': async (p: Record<string, unknown>) => {
        const t = tableOf(p.table)
        // what the person said stands: a script computes only the rest
        const said = fromJson<Record<string, { kind?: string }>>(
          one<{ provenance: string }>(
            this.world.db,
            'SELECT provenance FROM records WHERE id = ? AND table_id = ?',
            String(p.id),
            t.id,
          )?.provenance ?? null,
          {},
        )
        const stated = new Set(
          t.fields.filter((f) => said[f.id]?.kind === 'stated').map((f) => f.name),
        )
        const given = (p.values ?? {}) as Record<string, unknown>
        const values = Object.fromEntries(Object.entries(given).filter(([k]) => !stated.has(k)))
        const formula = (p.formula ?? {}) as Record<string, string>
        const notes = (p.notes ?? {}) as Record<string, string>
        // what the script works out for a value the person typed over is kept beside theirs
        const beside = Object.fromEntries(
          Object.entries(given)
            .filter(([k]) => stated.has(k))
            .map(([k, v]) => [
              k,
              {
                value: v,
                ...(formula[k] ? { formula: formula[k] } : {}),
                ...(notes[k] ? { note: String(notes[k]) } : {}),
              },
            ]),
        )
        if (Object.keys(beside).length) this.world.records.keepBeside(t.id, String(p.id), beside)
        if (!Object.keys(values).length) return null
        const perField = Object.fromEntries(
          Object.keys(values).map((k) => [
            k,
            {
              kind: 'computed' as const,
              source: {
                formula: formula[k] ?? `${label}`,
                inputs: [],
                ...(notes[k] ? { note: String(notes[k]) } : {}),
              },
            },
          ]),
        )
        this.world.records.change(
          t.id,
          [
            {
              id: String(p.id),
              values,
              provenance: { kind: 'computed', source: { formula: label } },
              per_field: perField,
            },
          ],
          ctx,
        )
        return null
      },
      'browser.open': async (p: Record<string, unknown>) => {
        this.reach(module, String(p.url), runId, who)
        return this.browse(module, String(p.url), label, runId, agentId, who, () =>
          this.engine().open(String(p.url)),
        )
      },
      'browser.extract': async (p: Record<string, unknown>) => {
        this.reach(module, String(p.url), runId, who)
        return this.browse(module, String(p.url), label, runId, agentId, who, () =>
          this.engine().extract(String(p.url), p.spec as ExtractSpec),
        )
      },
      // What is worth the person's attention: a line in their stream (Home).
      tell: async (p: Record<string, unknown>) => {
        const words = String(p.words ?? '').trim()
        if (!words) throw new Refused('tell needs words.')
        const about = p.about as
          | {
              table?: unknown
              rows?: unknown
              choice?: { field?: unknown; value?: unknown; label?: unknown }
            }
          | undefined
        let rows: {
          table: string
          rows: string[]
          choice?: { field: string; value: string; label: string }
        } | null = null
        if (about) {
          const t = tableOf(about.table)
          const ids = Array.isArray(about.rows) ? about.rows.map(String) : []
          const choice = about.choice
            ? {
                field: String(about.choice.field),
                value: String(about.choice.value),
                label: String(about.choice.label ?? about.choice.value),
              }
            : undefined
          if (choice) {
            const f = t.fields.find((x) => x.name === choice.field)
            if (f?.kind !== 'choice' || !f.choices.includes(choice.value))
              throw new Refused(
                `${choice.value} is not one of ${t.name}'s ${choice.field} choices.`,
              )
          }
          rows = { table: t.id, rows: ids, ...(choice ? { choice } : {}) }
        }
        this.world.line({
          actor,
          kind: 'told',
          words: `${label}: ${words}`,
          data: { agent: label, ...(rows ? { about: rows } : {}) },
          run: runId,
          module: module.id,
          user: who.user ?? this.owner,
        })
        this.notify()
        return null
      },
      log: async (p: Record<string, unknown>) => {
        this.world.line({
          actor,
          kind: 'run_step',
          words: String(p.words ?? ''),
          run: runId,
          module: module.id,
        })
        this.notify()
        return null
      },
    }
  }

  // One script of a module, run now: an agent's, or a skill's when trying it out.
  async runScript(
    module: Module,
    script: string,
    input: unknown,
    label: string,
    agentId: string | null,
    who: RunFor = { user: null, turn: null },
  ): Promise<RunOutcome> {
    const path = resolve(module.dir, script)
    if (!path.startsWith(`${module.dir}/`) || !existsSync(path))
      throw new Refused(`${module.name} has no script ${script}.`)
    const runId = newId('n')
    exec(
      this.world.db,
      "INSERT INTO runs (id, agent_id, module_id, started_at, state) VALUES (?, ?, ?, ?, 'running')",
      runId,
      agentId,
      module.id,
      now(),
    )
    this.world.line({
      actor: { kind: 'agent', id: label },
      kind: 'run_started',
      words: `${label} started.`,
      run: runId,
      module: module.id,
    })
    this.notify()
    const stop = new AbortController()
    this.running.set(runId, stop)
    let out: ScriptRun
    try {
      out = await runScript({
        script: path,
        moduleDir: module.dir,
        input,
        api: this.api(module, label, runId, who, agentId),
        signal: stop.signal,
      })
    } finally {
      this.running.delete(runId)
    }
    const state: RunOutcome['state'] = out.stopped ? 'stopped' : out.error ? 'failed' : 'ok'
    const said =
      out.result && typeof out.result === 'object' && 'words' in out.result
        ? String((out.result as { words: unknown }).words)
        : null
    const words =
      state === 'stopped'
        ? `${label} was stopped.`
        : out.error
          ? `${label} did not finish: ${out.error}`
          : said
            ? `${label}: ${said}`
            : `${label} finished.`
    const tokens = this.tokens.get(runId) ?? null
    this.tokens.delete(runId)
    exec(
      this.world.db,
      'UPDATE runs SET ended_at = ?, state = ?, words = ?, data = ? WHERE id = ?',
      now(),
      state,
      words,
      json({ result: out.result, stderr: out.stderr.slice(-4000), tokens }),
      runId,
    )
    if (agentId)
      exec(this.world.db, 'UPDATE agents SET last_run_at = ? WHERE id = ?', now(), agentId)
    this.world.line({
      actor: { kind: 'agent', id: label },
      kind: 'run_ended',
      words,
      data: { state },
      run: runId,
      module: module.id,
    })
    this.notify()
    return { id: runId, state, words, result: out.result }
  }

  async runAgent(agent: Agent, who?: RunFor, given: object = {}): Promise<RunOutcome> {
    const module = this.world.shape.module(agent.module)
    if (!module) throw new Refused('That agent’s module is not there.')
    // what became of its drafts since its last run
    const decided = this.drafts?.outcomes(agent.name, module.id, agent.lastRunAt) ?? []
    return this.runScript(
      module,
      agent.runs.script,
      {
        ...(agent.runs.input ?? {}),
        ...given,
        ...(decided.length ? { decided } : {}),
        // when it last ran, so it can look at what is new since
        lastRun: agent.lastRunAt,
      },
      agent.name,
      agent.id,
      who,
    )
  }

  stop(runId: string): boolean {
    const c = this.running.get(runId)
    c?.abort()
    return !!c
  }

  // What is due by each agent's trigger. One run of an agent at a time.
  async runDue(nowMs = Date.now()): Promise<void> {
    for (const a of agents(this.world)) {
      if (a.state !== 'on') continue
      if (one(this.world.db, "SELECT 1 FROM runs WHERE agent_id = ? AND state = 'running'", a.id))
        continue
      const given = this.due(a, nowMs)
      if (!given) continue
      await this.runAgent(a, undefined, given).catch(() => undefined)
      // the run counts at the tick's time, the clock its next one is judged by
      exec(
        this.world.db,
        'UPDATE agents SET last_run_at = ? WHERE id = ?',
        new Date(nowMs).toISOString(),
        a.id,
      )
    }
  }

  // Whether an agent is due, and what its trigger hands it when it is (a filing's documents).
  private due(a: Agent, nowMs: number): false | { filed?: Filed[] } {
    const is = this.isDue(a, nowMs)
    return is === true ? {} : is
  }

  private isDue(a: Agent, nowMs: number): boolean | { filed: Filed[] } {
    const last = a.lastRunAt ? Date.parse(a.lastRunAt) : 0
    const t = a.trigger
    if ('every' in t) {
      if (t.every === 'hour') return nowMs - last >= 3_600_000
      const days = t.every === 'week' ? 7 : 1
      const at = new Date(nowMs)
      const [h, m] = (t.at ?? '00:00').split(':').map(Number)
      at.setHours(h ?? 0, m ?? 0, 0, 0)
      if (at.getTime() > nowMs) at.setDate(at.getDate() - 1)
      return last < at.getTime() && nowMs - last >= (days - 1) * 86_400_000 + 3_600_000
    }
    if ('cron' in t) {
      const next = new Cron(t.cron).nextRun(new Date(last || nowMs - 60_000))
      return !!next && next.getTime() <= nowMs
    }
    if ('filed' in t) {
      // a document read, or put on a row, since the agent last looked (not by the agent itself)
      const seen = Number(a.cursor ?? 0)
      const files = new Set<string>()
      for (const l of this.world.lines({ after: seen, kinds: ['filed'] })) {
        const d = l.data as { file?: string; document?: string; record?: string; off?: boolean }
        if (l.actor.kind === 'agent' && l.actor.id === a.name) continue
        if (d.file && (d.document || (d.record && !d.off))) files.add(d.file)
      }
      exec(
        this.world.db,
        'UPDATE agents SET cursor = ? WHERE id = ?',
        String(this.world.lastLineId()),
        a.id,
      )
      const filed: Filed[] = []
      for (const hash of files) {
        const doc = this.world.files.document(hash)
        if (!doc) continue // a PDF still being read comes when it is read
        filed.push({
          file: hash,
          name: this.world.files.file(hash)?.name ?? doc.title,
          document: doc.id,
          kind: doc.kind,
          rows: this.world.rowsOfFile(hash).map((r) => ({
            table: this.world.shape.table(r.table)?.name ?? r.table,
            row: r.record,
            kind: r.kind,
          })),
        })
      }
      return filed.length ? { filed } : false
    }
    const tables = new Set(
      (Array.isArray(t.changes) ? t.changes : [t.changes])
        .map((name) => this.world.shape.table(name)?.id)
        .filter(Boolean),
    )
    if (!tables.size) return false
    const seen = Number(a.cursor ?? 0)
    const lines = this.world
      .lines({ after: seen, kinds: CHANGE_KINDS })
      .filter(
        (l) =>
          tables.has((l.data as { table?: string }).table) &&
          !(l.actor.kind === 'agent' && l.actor.id === a.name),
      )
    const latest = this.world.lastLineId()
    exec(this.world.db, 'UPDATE agents SET cursor = ? WHERE id = ?', String(latest), a.id)
    return lines.length > 0
  }

  runs(limit = 50): RunRow[] {
    return all<{
      id: string
      agent_id: string | null
      module_id: string | null
      started_at: string
      ended_at: string | null
      state: RunRow['state']
      words: string | null
      data: string
    }>(this.world.db, 'SELECT * FROM runs ORDER BY started_at DESC LIMIT ?', limit).map((r) => ({
      id: r.id,
      agent: r.agent_id,
      module: r.module_id,
      startedAt: r.started_at,
      endedAt: r.ended_at,
      state: r.state,
      words: r.words,
      tokens: fromJson<{ tokens?: number | null }>(r.data, {}).tokens ?? null,
    }))
  }
}
