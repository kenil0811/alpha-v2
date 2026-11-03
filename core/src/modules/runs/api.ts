import type { ExtractSpec } from '@alpha/connector-sdk'
import { inReadingOrder, type ReadSpec, readInto } from '../../files/reading.ts'
import { callKey } from '../../world/cards.ts'
import { all, run as exec, json, parse } from '../../world/db.ts'
import { Refused } from '../../world/kinds.ts'
import type { Module, Table } from '../../world/shape/index.ts'
import { agents, nextRun } from '../agents.ts'
import { propose as proposeBuild } from '../builder.ts'
import { explain, review as governanceReview } from '../governance.ts'
import { alphaModule, refresh as refreshInterview, worthAsking } from '../interview.ts'
import { type JudgeSpec, judge } from '../judging.ts'
import { research } from '../research.ts'
import { REVIEW, type ReviewInput } from '../reviews.ts'
import { connectorCalls } from './connected.ts'
import type { AgentRunner } from './runner.ts'
import { proposeTasks } from './tasks.ts'
import { lastTold, sameJson, TOLD_AGAIN } from './told.ts'
import type { RunFor } from './types.ts'
import type { Walls } from './walls.ts'

export function api(
  runner: AgentRunner,
  module: Module,
  label: string,
  runId: string,
  who: RunFor,
  agentId: string | null,
  walls: Walls | null = null,
) {
  const actor = { kind: 'agent' as const, id: label }
  const ctx = { actor, run: runId }
  const tableOf = (name: unknown): Table => {
    const t = runner.world.shape.table(String(name))
    if (!t) throw new Refused(`There is no table called ${String(name)}.`)
    return t
  }
  // the walls: a refusal is a step of the run, so Activity says what was refused and why
  const refuse = (why: string): never => {
    runner.world.line({
      actor,
      kind: 'run_step',
      words: `Refused: ${why}`,
      run: runId,
      module: module.id,
    })
    throw new Refused(why)
  }
  const readable = (t: Table): Table => {
    if (walls && !walls.reads.has(t.name.toLowerCase()))
      refuse(
        `${label} may not read ${t.name}: it is neither ${module.name}'s own table nor one its kit uses.`,
      )
    return t
  }
  const writable = (t: Table): Table => {
    if (walls && !walls.touches.has(t.name.toLowerCase()))
      refuse(
        walls.kind === 'try'
          ? `${label} may write only ${module.name}'s own tables, not ${t.name}.`
          : `${label} does not touch ${t.name}: its file says touches: [${[...walls.touches].join(', ') || 'nothing'}].`,
      )
    // a write stays inside the module whatever the file says (item 40, 25 Oct)
    if (!runner.world.shape.within(module.id).includes(t.module.id))
      refuse(`${t.name} is not one of ${module.name}'s tables.`)
    return t
  }
  const step = (words: string, tokens?: number): void => {
    runner.world.line({
      actor,
      kind: 'run_step',
      words,
      ...(tokens ? { data: { tokens } } : {}),
      run: runId,
      module: module.id,
    })
    runner.notify()
  }
  const spent = (tokens: number): void => {
    runner.tokens.set(runId, (runner.tokens.get(runId) ?? 0) + tokens)
  }
  const isAlpha = (): boolean => alphaModule(runner.world) === module.id
  const affecting = (call: string): void => {
    if (walls?.effects && !walls.effects.has(call))
      refuse(
        `${label} may not ${call}: its file names no such effect (effects: [${[...walls.effects].join(', ') || 'none'}]).`,
      )
  }
  // Like asks come on one card (Vikas, 29 Oct): rows an agent puts to the person for a table, a
  // field and choices its card still waiting already asks go onto that card, so a backlog grows
  // one card's rows, not the cards.
  const onWaiting = (t: Table, p: Record<string, unknown>): { card: string } | null => {
    const choices = Array.isArray(p.choices) ? p.choices.map(String) : []
    const note = p.note ? String(p.note) : null
    const twin = all<{ id: string; call: string }>(
      runner.world.db,
      `SELECT id, call FROM cards WHERE state = 'waiting' AND json_extract(call, '$.tool') = ?
         AND run_id IN (SELECT id FROM runs WHERE agent_id = ?) ORDER BY created_at LIMIT 50`,
      REVIEW,
      agentId,
    )
      .map((c) => ({ id: c.id, input: parse<{ input: ReviewInput }>(c.call, {} as never).input }))
      .find(
        (c) =>
          c.input?.table === t.id &&
          c.input.field === String(p.field ?? '') &&
          c.input.note === note &&
          c.input.choices.join('\n') === choices.join('\n'),
      )
    if (!twin) return null
    const known = new Set(runner.world.records.list(t.id).map((r) => r.id))
    const fresh = (Array.isArray(p.rows) ? p.rows.map(String) : []).filter(
      (r) => known.has(r) && !twin.input.rows.includes(r),
    )
    if (fresh.length) {
      const call = { tool: REVIEW, input: { ...twin.input, rows: [...twin.input.rows, ...fresh] } }
      exec(
        runner.world.db,
        'UPDATE cards SET call = ?, call_key = ? WHERE id = ?',
        json(call),
        callKey(call),
        twin.id,
      )
      runner.world.line({
        actor,
        kind: 'run_step',
        words: `Put ${fresh.length} more row${fresh.length === 1 ? '' : 's'} of ${t.name} on the card already waiting for you, ${call.input.rows.length} in all.`,
        run: runId,
        module: module.id,
      })
    }
    runner.notify()
    return { card: twin.id }
  }
  return {
    ...connectorCalls({ runner, module, label, runId, who, refuse, writable, tableOf }),
    'rows.list': async (p: Record<string, unknown>) => {
      const t = readable(tableOf(p.table))
      const keys = runner.world.records.itemKeys(t.id)
      // values by field name, as land and compute take them
      const names = new Map(t.fields.map((f) => [f.slug, f.name]))
      return runner.world.records.list(t.id).map((r) => ({
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
      const t = writable(tableOf(p.table))
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
      return runner.world.records.land(
        t.id,
        items,
        { connector: `agent:${label}`, account: module.name },
        ctx,
      )
    },
    // the documents filed in the world, each with the rows it sits on, and one's cells or
    // lines with their places
    'documents.list': async () =>
      runner.world.files.documents().map((d) => ({
        file: d.fileHash,
        name: runner.world.files.file(d.fileHash)?.name ?? d.title,
        title: d.title,
        kind: d.kind,
        pieces: d.chunks,
        rows: runner.world.rowsOfFile(d.fileHash).map((r) => ({
          table: runner.world.shape.table(r.table)?.name ?? r.table,
          row: r.record,
          kind: r.kind,
        })),
      })),
    // a filed document put on a row of the module's own tables (the deal it is about)
    'documents.place': async (p: Record<string, unknown>) => {
      const t = writable(tableOf(p.table))
      if (!runner.world.shape.within(module.id).includes(t.module.id))
        throw new Refused(`${t.name} is not one of ${module.name}'s tables.`)
      const rec = runner.world.records.get(String(p.row))
      if (rec?.table.id !== t.id) throw new Refused(`${t.name} has no row ${String(p.row)}.`)
      const placed = runner.world.placeFile(
        String(p.file),
        rec.record.id,
        p.kind ? String(p.kind) : null,
        ctx,
      )
      runner.notify()
      return { file: placed.file.hash, row: placed.record, kind: placed.kind }
    },
    // the model reads a document into the values the script names, each with the place it
    // was read from; what is not found where it is cited comes back as not given
    'documents.extract': async (p: Record<string, unknown>) => {
      const d = runner.world.files.document(String(p.file))
      if (!d) throw new Refused('That document is not filed, or not read yet.')
      const chunks = runner.world.files.chunks(d.id)
      const pieces = d.kind === 'pdf' ? inReadingOrder(chunks) : chunks
      const name = runner.world.files.file(d.fileHash)?.name ?? d.title
      const out = await readInto(p.spec as ReadSpec, pieces, runner.ask)
      runner.tokens.set(runId, (runner.tokens.get(runId) ?? 0) + out.tokens)
      const found =
        Object.values(out.values).filter(Boolean).length +
        Object.values(out.lists).reduce((n, l) => n + l.length, 0)
      runner.world.line({
        actor,
        kind: 'run_step',
        words: `Read ${name}: ${found} found${out.dropped.length ? `; ${out.dropped.length} left out, not found where cited` : ''}.`,
        data: { file: d.fileHash, dropped: out.dropped, tokens: out.tokens },
        run: runId,
        module: module.id,
      })
      runner.notify()
      return { values: out.values, lists: out.lists, dropped: out.dropped }
    },
    // the person's people (or companies), each with how to reach them, where they work, the
    // plain numbers of their contact, and the rows of the person's modules that name them
    'people.list': async (p: Record<string, unknown>) => {
      const kind = p.kind === 'company' ? 'company' : 'person'
      const named = runner.world.people.namings()
      const born = new Map(
        all<{ id: string; created_at: string }>(
          runner.world.db,
          'SELECT id, created_at FROM people WHERE merged_into IS NULL',
        ).map((r) => [r.id, r.created_at]),
      )
      return runner.world.people.list(kind).map((x) => ({
        ...x,
        since: born.get(x.id) ?? null,
        named: named.get(x.id) ?? [],
      }))
    },
    // the model sorts items into the groups the person named, each with why; nothing is kept
    // from it until the script lands rows the person then decides
    judge: async (p: Record<string, unknown>) => {
      const out = await judge(p as unknown as JudgeSpec, runner.judgeAsk)
      runner.tokens.set(runId, (runner.tokens.get(runId) ?? 0) + out.tokens)
      const sorted = out.judged.filter((j) => j.group).length
      runner.world.line({
        actor,
        kind: 'run_step',
        words: `Sorted ${out.judged.length} into the groups given: ${sorted} placed.`,
        data: { tokens: out.tokens },
        run: runId,
        module: module.id,
      })
      runner.notify()
      return out.judged
    },
    // rows of the module's own tables put to the person on one card, with the choices given
    review: async (p: Record<string, unknown>) => {
      const t = writable(tableOf(p.table))
      if (!runner.world.shape.within(module.id).includes(t.module.id))
        throw new Refused(`${t.name} is not one of ${module.name}'s tables.`)
      const merged = agentId ? onWaiting(t, p) : null
      if (merged) return merged
      const card = runner.reviews.open(
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
      runner.notify()
      return { card: card.id }
    },
    // an email drafted for the person's yes (or sent at once under a standing permission)
    'draft.email': async (p: Record<string, unknown>) => {
      affecting('draft.email')
      if (!runner.drafts) throw new Refused('Drafts are not set up in this core.')
      const about = p.about as { table?: unknown; row?: unknown } | undefined
      const t = about ? tableOf(about.table) : null
      const out = await runner.drafts.propose(
        {
          agent: label,
          module: module.id,
          kind: String(p.kind ?? 'email'),
          key: p.key ? String(p.key) : null,
          connector: p.connector ? String(p.connector) : null,
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
      runner.notify()
      return out
    },
    'documents.read': async (p: Record<string, unknown>) => {
      const d = runner.world.files.document(String(p.file))
      if (!d) throw new Refused('That document is not filed, or not read yet.')
      return runner.world.files.chunks(d.id).map((c) => ({ ...c.position, words: c.words }))
    },
    'rows.compute': async (p: Record<string, unknown>) => {
      const t = writable(tableOf(p.table))
      // what the person said stands: a script computes only the rest
      const got = runner.world.records.get(String(p.id))
      const said = got && got.table.id === t.id ? got.record.provenance : {}
      const stated = new Set(
        t.fields.filter((f) => said[f.slug]?.kind === 'stated').map((f) => f.name),
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
      if (Object.keys(beside).length) runner.world.records.keepBeside(t.id, String(p.id), beside)
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
      runner.world.records.change(
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
      affecting('browser.open')
      runner.reach(module, String(p.url), runId, who)
      return runner.browse(module, String(p.url), label, runId, agentId, who, () =>
        runner.engine().open(String(p.url)),
      )
    },
    'browser.extract': async (p: Record<string, unknown>) => {
      affecting('browser.extract')
      runner.reach(module, String(p.url), runId, who)
      return runner.browse(module, String(p.url), label, runId, agentId, who, () =>
        runner.engine().extract(String(p.url), p.spec as ExtractSpec),
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
            throw new Refused(`${choice.value} is not one of ${t.name}'s ${choice.field} choices.`)
        }
        rows = { table: t.id, rows: ids, ...(choice ? { choice } : {}) }
      }
      // the same words on the same rows as its last post: the earlier post is said again, not
      // posted twice (Vikas, 30 Oct: "Lead aging" posting the same line every hour)
      const told = `${label}: ${words}`
      const before = lastTold(runner.world, label)
      if (before && before.words === told && sameJson(before.data.about ?? null, rows)) {
        runner.world.line({
          actor,
          kind: TOLD_AGAIN,
          words: told,
          data: { agent: label, again: before.id, ...(rows ? { about: rows } : {}) },
          run: runId,
          module: module.id,
          user: who.user ?? runner.owner,
        })
        runner.notify()
        return null
      }
      runner.world.line({
        actor,
        kind: 'told',
        words: told,
        data: { agent: label, ...(rows ? { about: rows } : {}) },
        run: runId,
        module: module.id,
        user: who.user ?? runner.owner,
      })
      runner.notify()
      return null
    },
    // A run started on a task says what became of it: done, with what it did, or what it
    // waits for. Only its run settles an agent's task (Q93): one that ends without saying waits.
    // A try on a made-up task (no task behind the run) changes none: what it would say is a step.
    'task.done': async (p: Record<string, unknown>) => {
      const words = String(p.words ?? '').trim()
      if (!words) throw new Refused('task.done needs words: what was done.')
      const t = runner.serving(who)
      if (t)
        runner.world.tasks.setState(t.id, 'done', ctx, `${label} finished “${t.title}”: ${words}`)
      else
        runner.world.line({
          actor,
          kind: 'run_step',
          words: `Would finish the task: ${words}`,
          run: runId,
          module: module.id,
        })
      runner.notify()
      return null
    },
    'task.wait': async (p: Record<string, unknown>) => {
      const words = String(p.words ?? '').trim()
      if (!words) throw new Refused('task.wait needs words: what it waits for.')
      const t = runner.serving(who)
      if (t)
        runner.world.tasks.setState(
          t.id,
          'waiting',
          ctx,
          `${label} waits on “${t.title}”: ${words}`,
        )
      else
        runner.world.line({
          actor,
          kind: 'run_step',
          words: `Would leave the task waiting: ${words}`,
          run: runId,
          module: module.id,
        })
      runner.notify()
      return null
    },
    // The journal's lines since a moment, for an agent that notices what was said (Watson).
    'journal.list': async (p: Record<string, unknown>) => {
      const w = runner.world
      const me = agentId ? agents(w).find((a) => a.id === agentId) : undefined
      const since =
        typeof p.since === 'string' && p.since
          ? p.since
          : (me?.lastRunAt ?? new Date(Date.now() - 86_400_000).toISOString())
      const kinds =
        Array.isArray(p.kinds) && p.kinds.length ? p.kinds.map(String) : ['said', 'replied']
      const limit = Math.min(Number(p.limit) || 200, 500)
      return w
        .lines({ kinds })
        .filter((l) => l.at > since)
        .slice(-limit)
        .map((l) => ({
          id: l.id,
          at: l.at,
          who: l.actor.id ? `${l.actor.kind} ${l.actor.id}` : l.actor.kind,
          kind: l.kind,
          words: l.words,
        }))
    },
    // What the person's Home shows today, for an agent that speaks for Alpha (Morning).
    'home.today': async () => {
      const w = runner.world
      const now = Date.now()
      const day = new Date(now).toISOString().slice(0, 10)
      const open = w.tasks.list({ open: true })
      const due = open
        .filter((t) => t.due && t.due.slice(0, 10) <= day)
        .map((t) => ({
          id: t.id,
          title: t.title,
          due: t.due,
          overdue: (t.due ?? '').slice(0, 10) < day,
        }))
      const quiet = open
        .filter((t) => !t.due && now - Date.parse(t.updatedAt) >= 7 * 86_400_000)
        .map((t) => ({ id: t.id, title: t.title, since: t.updatedAt.slice(0, 10) }))
      const counts = w.tasks.counts()
      const cards = w.cards
        .waiting(runner.owner ?? undefined)
        .map((c) => ({ id: c.id, words: c.words }))
      const names = new Map(agents(w).map((a) => [a.id, a.name]))
      const modules = new Map(w.shape.modules().map((m) => [m.id, m.name]))
      const since = new Date(now - 86_400_000).toISOString()
      const changed = runner
        .runs(200)
        .filter((r) => r.startedAt > since && r.state !== 'running' && r.words)
        .map((r) => ({
          name: r.agent ? (names.get(r.agent) ?? 'A try') : 'A try',
          words: r.words ?? '',
          state: r.state,
          at: r.endedAt ?? r.startedAt,
        }))
      // the runs to come, the asking agent's own left out
      const coming = agents(w)
        .filter((a) => a.state === 'on' && a.id !== agentId)
        .flatMap((a) => {
          const next = nextRun(a.trigger, a.lastRunAt, now)
          return next
            ? [{ name: a.name, module: modules.get(a.module) ?? '', at: next.toISOString() }]
            : []
        })
        .sort((a, b) => a.at.localeCompare(b.at))
      return {
        date: day,
        tasks: { open: counts.open, overdue: counts.overdue, today: counts.today, due, quiet },
        cards,
        changed,
        coming,
      }
    },
    // Interview me's pool, refreshed and re-ranked (Alpha's interview skill; Morning runs it):
    // what is unresolved and the standing bank, valued in code, the most valuable worded by the
    // model. Alpha's own module is never asked about.
    'interview.prepare': async () => {
      const own = alphaModule(runner.world) ?? module.id
      const out = await refreshInterview(runner.world, runner.interviewAsk, own)
      spent(out.tokens)
      const top = worthAsking(runner.world)
      const words = top.length
        ? `${top.length} question${top.length === 1 ? '' : 's'} worth asking, the most useful first: ${top[0]?.ask}`
        : 'Nothing worth asking about today.'
      step(
        out.worded || !top.length
          ? words
          : `${words} (in code's own words: the model did not answer)`,
        out.tokens,
      )
      return {
        words,
        count: top.length,
        top: top.slice(0, 20).map((q) => ({
          key: q.key,
          module: q.module,
          ask: q.ask,
          why: q.why,
          unblocks: q.unblocks,
          value: q.value,
        })),
      }
    },
    // The workspace skills (30 Oct), Alpha's, for any module's agent. Research: a bounded web
    // look, reading only, every line of its brief cited by a source that resolves.
    research: async (p: Record<string, unknown>) => {
      affecting('research')
      const out = await research(
        runner.researchAsk,
        runner.web,
        { ask: String(p.ask ?? ''), about: p.about ? String(p.about) : null },
        (w) => step(w),
      )
      spent(out.tokens)
      step(out.words, out.tokens)
      return { words: out.words, lines: out.lines, dropped: out.dropped }
    },
    // Governance: noticed rules put to the person on their Save cards, agents walled, said; an
    // agent outside Alpha's own module looks at its own module only. It never approves a rule.
    'governance.review': async () => {
      const out = governanceReview(runner.world, {
        user: who.user ?? runner.owner,
        actor,
        run: runId,
        module: isAlpha() ? null : module.id,
      })
      step(out.words)
      runner.notify()
      return out
    },
    'governance.explain': async (p: Record<string, unknown>) => {
      const out = await explain(runner.world, runner.governanceAsk, {
        refusal: String(p.refusal ?? ''),
        module: module.id,
        agent: p.agent ? String(p.agent) : label,
      })
      spent(out.tokens)
      return { words: out.words }
    },
    // The Builder: a build with its business case, researched when not exact, on one card for the
    // person's yes; an agent outside Alpha's own module builds inside its module only.
    'builder.propose': async (p: Record<string, unknown>) => {
      const out = await proposeBuild(
        runner.world,
        { ask: runner.researchAsk, web: runner.web },
        p as never,
        {
          user: who.user ?? runner.owner,
          actor,
          run: runId,
          within: isAlpha() ? null : module.id,
        },
        (w) => step(w),
      )
      if (out.brief) spent(out.brief.tokens)
      step(out.words)
      runner.notify()
      return { card: out.card, words: out.words }
    },
    // Tasks the agent thinks need doing, on one card for the person's yes; none is kept before.
    'task.propose': async (p: Record<string, unknown>) =>
      proposeTasks(runner, module, label, runId, who, agentId, p),
    log: async (p: Record<string, unknown>) => {
      runner.world.line({
        actor,
        kind: 'run_step',
        words: String(p.words ?? ''),
        run: runId,
        module: module.id,
      })
      runner.notify()
      return null
    },
  }
}
