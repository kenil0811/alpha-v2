// Runs (design §11): an agent's script run in its sandbox, serving its module. A run is a row; its
// steps are journal lines carrying its id; it reaches the person's stream only as a card. What a
// script reads from a site goes through the browser engine, and only to sites on its module's
// list: a new site waits on the person's yes (gate 1), which puts it on the list.
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import type { BrowserEngine, ExtractSpec } from '@alpha/connector-sdk'
import { Cron } from 'croner'
import { parse, stringify } from 'yaml'
import { decide } from '../gates/gates.ts'
import { runScript, type ScriptRun } from '../scripts/run.ts'
import { all, run as exec, parse as fromJson, json, newId, now, one } from '../world/db.ts'
import { Refused } from '../world/kinds.ts'
import type { Module, Table } from '../world/shape.ts'
import type { World } from '../world/world.ts'
import { type Agent, agents } from './agents.ts'

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
}

const CHANGE_KINDS = ['wrote', 'changed', 'landed', 'removed']

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

  constructor(
    world: World,
    engine: () => BrowserEngine,
    options: { notify?: () => void; owner?: string | null } = {},
  ) {
    this.world = world
    this.engine = engine
    this.notify = options.notify ?? (() => {})
    this.owner = options.owner ?? null
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

  private api(module: Module, label: string, runId: string, who: RunFor) {
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
          values: Object.fromEntries(
            Object.entries(r.values).map(([k, v]) => [names.get(k) ?? k, v]),
          ),
        }))
      },
      'rows.land': async (p: Record<string, unknown>) => {
        const t = tableOf(p.table)
        const items = (Array.isArray(p.items) ? p.items : []) as {
          key: string
          values: Record<string, unknown>
          url?: string
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
          t.fields.filter((f) => said[f.slug]?.kind === 'stated').map((f) => f.name),
        )
        const values = Object.fromEntries(
          Object.entries((p.values ?? {}) as Record<string, unknown>).filter(
            ([k]) => !stated.has(k),
          ),
        )
        if (!Object.keys(values).length) return null
        const formula = (p.formula ?? {}) as Record<string, string>
        const perField = Object.fromEntries(
          Object.keys(values).map((k) => [
            k,
            {
              kind: 'computed' as const,
              source: { formula: formula[k] ?? `${label}`, inputs: [] },
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
        return this.engine().open(String(p.url))
      },
      'browser.extract': async (p: Record<string, unknown>) => {
        this.reach(module, String(p.url), runId, who)
        return this.engine().extract(String(p.url), p.spec as ExtractSpec)
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
        api: this.api(module, label, runId, who),
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
    exec(
      this.world.db,
      'UPDATE runs SET ended_at = ?, state = ?, words = ?, data = ? WHERE id = ?',
      now(),
      state,
      words,
      json({ result: out.result, stderr: out.stderr.slice(-4000) }),
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

  async runAgent(agent: Agent, who?: RunFor): Promise<RunOutcome> {
    const module = this.world.shape.module(agent.module)
    if (!module) throw new Refused('That agent’s module is not there.')
    return this.runScript(
      module,
      agent.runs.script,
      agent.runs.input ?? {},
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
      if (!this.due(a, nowMs)) continue
      await this.runAgent(a).catch(() => undefined)
      // the run counts at the tick's time, the clock its next one is judged by
      exec(
        this.world.db,
        'UPDATE agents SET last_run_at = ? WHERE id = ?',
        new Date(nowMs).toISOString(),
        a.id,
      )
    }
  }

  private due(a: Agent, nowMs: number): boolean {
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
    }>(this.world.db, 'SELECT * FROM runs ORDER BY started_at DESC LIMIT ?', limit).map((r) => ({
      id: r.id,
      agent: r.agent_id,
      module: r.module_id,
      startedAt: r.started_at,
      endedAt: r.ended_at,
      state: r.state,
      words: r.words,
    }))
  }
}
