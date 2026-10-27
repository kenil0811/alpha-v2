import { existsSync } from 'node:fs'
import { join } from 'node:path'
import type { FastifyReply } from 'fastify'
import { type Agent, agents, readAgent } from '../modules/agents.ts'
import { type RunRow, unmetNeeds } from '../modules/runs/index.ts'
import { pagesOf } from '../pages/pages.ts'
import type { Card } from '../world/cards.ts'
import type { Line } from '../world/journal.ts'
import type { Provenance } from '../world/kinds.ts'
import { undoable } from '../world/records/index.ts'
import type { Module, Table } from '../world/shape/index.ts'
import { manifestSays } from '../world/shape/manifest.ts'
import { placeOf } from '../world/shape/parts.ts'
import type { Task } from '../world/tasks/index.ts'
import type { View } from '../world/views.ts'
import type { BaseCtx } from './ctx.ts'
import type {
  AboutRows,
  CardView,
  ModuleSummary,
  RunView,
  SavedView,
  SourceView,
  TableSummary,
  TaskLineView,
  TaskView,
  UndoTarget,
} from './types.ts'

// A table as a module lists it: its rows, and where it sits (core step 3a).
export function tableSummary(world: BaseCtx['world'], t: Table): TableSummary {
  const part = t.fields.find((f) => f.partOf)
  return {
    id: t.id,
    name: t.name,
    rows: world.records.count(t.id),
    place: placeOf(t),
    of: part ? (world.shape.table(part.relatesTo ?? '')?.name ?? null) : null,
  }
}

export function makeViews(ctx: BaseCtx) {
  const { world, engine, user } = ctx

  // A card as the window shows it; a file from the mail with its place and the rows to pick.
  const cardOut = (c: Card): CardView => ({
    ...cardView(c),
    filing: engine.hands?.intake?.view(c) ?? null,
    draft: engine.hands?.drafts?.view(c) ?? null,
    match: c.kind === 'match' ? world.people.matchView(c.id) : null,
    review: engine.hands?.runner?.reviews.view(c) ?? null,
    proposed: engine.hands?.runner?.proposedView(c) ?? null,
  })
  // Tasks (Kenil's plan, 21 Oct): the saved lists, a task's page, and the person's own word on
  // them: added, changed, moved, done, removed.
  const today = () => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }
  const inDays = (n: number) => {
    const d = new Date(Date.now() + n * 86_400_000)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }
  const placeOf = (p: Task['place']) => {
    const rowName = (table: string, row: string) => {
      const t = world.shape.table(table)
      const r = world.records.get(row)
      return t && r ? world.rowName(t, r.record.values) : 'a row'
    }
    const words = world.tasks.placeWords(p, rowName)
    const href =
      p.row && p.table
        ? `#/table/${p.table}/${p.row}`
        : p.table
          ? `#/table/${p.table}`
          : p.module && p.page
            ? `#/module/${p.module}/page/${p.page}`
            : p.module
              ? `#/module/${p.module}`
              : null
    return { words, path: words === 'nowhere yet' ? [] : words.split(' › '), href }
  }
  // the tasks a card waits on the person for: about the task, or from a run serving it
  const waitingCards = () =>
    new Set([
      ...world.cards
        .waiting()
        .map((c) => (c.call?.input as { task?: string } | undefined)?.task)
        .filter((x): x is string => !!x),
      ...world.cards.waitingTasks(),
    ])
  const workingOn = () =>
    new Set(
      (engine.hands?.runner.runs(50) ?? [])
        .filter((r) => r.state === 'running' && r.task)
        .map((r) => r.task as string),
    )
  const lineOf = (t: Task, waiting: Set<string>, working = workingOn()): TaskLineView => {
    const kids = world.tasks.children(t.id)
    return {
      id: t.id,
      title: t.title,
      state: t.state,
      due: t.due,
      overdue:
        !!t.due && ['todo', 'doing', 'waiting'].includes(t.state) && t.due.slice(0, 10) < today(),
      remindAt: t.remindAt,
      repeat: t.repeat,
      priority: t.priority,
      owner: world.tasks.ownerWords(t),
      ownerKind: t.owner.kind,
      place: placeOf(t.place),
      parent: t.parent,
      children: kids.length,
      childrenDone: kids.filter((k) => k.state === 'done').length,
      waitingForYou: waiting.has(t.id),
      working: working.has(t.id),
    }
  }
  const taskOut = (id: string): TaskView | undefined => {
    const t = world.tasks.get(id)
    if (!t) return undefined
    const waiting = waitingCards()
    const row = t.place.row ? world.records.get(t.place.row) : undefined
    const values = row
      ? row.table.fields.flatMap((f) => {
          const v = row.record.values[f.slug]
          if (v === null || v === undefined || v === '') return []
          const words =
            typeof v === 'object' && v && 'amount' in (v as object)
              ? `${(v as { amount: number }).amount.toLocaleString()} ${(v as { currency: string }).currency}`
              : f.kind === 'person'
                ? (world.people.names([String(v)])[String(v)] ?? String(v))
                : Array.isArray(v)
                  ? v.join(', ')
                  : String(v)
          return [{ field: f.name, value: words }]
        })
      : []
    const parent = t.parent ? world.tasks.get(t.parent) : undefined
    // who can own it: the person, Alpha, and the agents that take tasks
    const all = agents(world)
    const owners = [
      { kind: 'person' as const, id: user.id, name: 'You' },
      { kind: 'alpha' as const, id: null, name: 'Alpha' },
      ...all
        .filter((a) => a.tasks || a.id === t.owner.id)
        .map((a) => ({ kind: 'agent' as const, id: a.id, name: a.name })),
    ]
    const agent = t.owner.kind === 'agent' ? all.find((a) => a.id === t.owner.id) : undefined
    const runner = engine.hands?.runner
    const cards = world.cards.ofTask(t.id)
    return {
      ...lineOf(t, waiting),
      notes: t.notes,
      remindedAt: t.remindedAt,
      madeBy: t.madeBy.startsWith('person')
        ? 'You'
        : t.madeBy.startsWith('agent:')
          ? t.madeBy.slice(6)
          : 'Alpha',
      placedBy: t.placedBy,
      placedWhy: t.placedWhy,
      createdAt: t.createdAt,
      doneAt: t.doneAt,
      parentTitle: parent?.title ?? null,
      subtasks: world.tasks.children(t.id).map((k) => lineOf(k, waiting)),
      touches: t.refs.map((r) => {
        if (r.kind === 'person')
          return {
            kind: r.kind,
            name: world.people.names([r.ref])[r.ref] ?? r.ref,
            href: `#/people/${r.ref}`,
          }
        if (r.kind === 'row') {
          const rec = world.records.get(r.ref)
          return {
            kind: r.kind,
            name: rec ? world.rowName(rec.table, rec.record.values) : 'a row no longer there',
            href: rec ? `#/table/${rec.table.id}/${r.ref}` : null,
          }
        }
        return {
          kind: r.kind,
          name: world.files.file(r.ref)?.name ?? r.ref,
          href: `#/file/${r.ref}`,
        }
      }),
      context: {
        values,
        siblings:
          t.place.module || t.place.table
            ? world.tasks
                .list({ open: true, on: { ...t.place, field: null } })
                .filter((x) => x.id !== t.id && x.parent !== t.id)
                .slice(0, 20)
                .map((x) => lineOf(x, waiting))
            : [],
      },
      history: world
        .lines({ kinds: ['task', 'reminder'] })
        .filter((l) => (l.data as { task?: string; tasks?: string[] }).task === t.id)
        .slice(-40)
        .reverse()
        .map((l) => ({ at: l.at, words: l.words })),
      owners,
      agent: agent
        ? {
            name: agent.name,
            on: agent.state === 'on',
            takes: agent.tasks,
            said:
              world
                .lines({ kinds: ['task'] })
                .filter(
                  (l) =>
                    (l.data as { task?: string }).task === t.id &&
                    l.actor.kind === 'agent' &&
                    !l.words.startsWith(`${agent.name} started on`),
                )
                .at(-1)?.words ?? null,
            runs: (runner?.runsOf(t.id) ?? [])
              .reverse()
              .sort((a, b) => Number(b.state === 'running') - Number(a.state === 'running'))
              .map(runOut),
          }
        : null,
      cards: [
        ...cards.filter((c) => c.state === 'waiting'),
        ...cards.filter((c) => c.state !== 'waiting').reverse(),
      ].map(cardOut),
    }
  }

  // the task a run served, when it served one
  const taskOfRun = (run: string): string | null =>
    (engine.hands?.runner.runs(200) ?? []).find((r) => r.id === run)?.task ?? null
  // only what was sent: a field left out is left as it is
  const given = <T extends object>(o: T) =>
    Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T

  // The modules the window shows: each with a page or a table in sight, and the modules they sit
  // inside (a module only of a connection's hidden tables stays out).
  // What an agent needs that is not there, in words, from its file.
  const needsOf = (m: Module, a: Agent): string | null => {
    const path = join(m.dir, a.file)
    if (!existsSync(path)) return null
    try {
      const missing = unmetNeeds(world, readAgent(path))
      return missing.length ? `needs ${missing.join(' and ')}` : null
    } catch {
      return null
    }
  }

  const summaries = (): ModuleSummary[] => {
    const all = world.shape.modules().map((m) => ({
      id: m.id,
      name: m.name,
      parent: m.parent,
      people: livesPeople(m),
      alpha: isAlphas(m),
      pages: pagesOf(m),
      tables: world.shape
        .tables(m.id)
        .filter((t) => !t.hidden)
        .map((t) => tableSummary(world, t)),
    }))
    const shown = new Set<string>()
    for (const m of all) {
      if (!m.tables.length && !m.pages.length) continue
      for (let p: ModuleSummary | undefined = m; p && !shown.has(p.id); ) {
        shown.add(p.id)
        p = all.find((x) => x.id === p?.parent)
      }
    }
    return all.filter((m) => shown.has(m.id))
  }

  const byWords = (madeBy: string): string => {
    const [kind, id] = madeBy.split(/:(.*)/s)
    if (kind === 'person') return id === user.id ? 'You' : (world.user(id ?? '')?.name ?? 'Someone')
    if (kind === 'agent' || kind === 'connector') return id ?? kind
    if (kind === 'system') return 'Its kit'
    return 'Alpha'
  }
  // Activity: agents' runs and connections' reads, newest first, and (core step 1) Alpha's turns
  // that changed rows, removals outside both, and the person's reverts, each with its Revert or
  // Bring back where it can be undone. A run that ended having changed nothing is quiet, so the
  // window can fold it.
  const ROWS = ['landed', 'wrote', 'changed', 'removed', 'reverted']
  const clock = (at: string) =>
    new Date(at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })
  const undoOf = (target: UndoTarget, label: 'Revert' | 'Bring back', what: string) =>
    undoable(world.records, target) ? { target, label, what } : null
  function runOut(r: RunRow): RunView {
    const CHANGES = new Set([...ROWS, 'told', 'card_opened'])
    const steps = world
      .lines({ run: r.id, kinds: ['run_step', 'told', ...ROWS, 'card_opened', 'task'] })
      .map((l) => ({ id: l.id, at: l.at, kind: l.kind, words: l.words }))
    const name = (r.agent && agents(world).find((a) => a.id === r.agent)?.name) || 'A try'
    return {
      id: r.id,
      kind: 'run',
      name,
      module: r.module ? (world.shape.module(r.module)?.name ?? null) : null,
      moduleId: r.module,
      startedAt: r.startedAt,
      ms: r.endedAt ? Date.parse(r.endedAt) - Date.parse(r.startedAt) : null,
      state: r.state,
      words: r.words,
      tokens: r.tokens, // a script's own work uses none; a document read by the model does
      quiet: r.state === 'ok' && !steps.some((st) => CHANGES.has(st.kind)),
      steps,
      undo:
        r.state === 'running'
          ? null
          : undoOf({ run: r.id }, 'Revert', `what ${name} did at ${clock(r.startedAt)}`),
    }
  }
  const lineOut = (
    l: { id: number; at: string; words: string; kind: string },
    kind: RunView['kind'],
    name: string,
    moduleId: string | null,
  ): RunView => ({
    id: `${kind}-${l.id}`,
    kind,
    name,
    module: moduleId ? (world.shape.module(moduleId)?.name ?? null) : null,
    moduleId,
    startedAt: l.at,
    ms: null,
    state: 'ok',
    words: l.words,
    tokens: null,
    quiet: false,
    steps: [],
    undo: null,
  })
  // Alpha's turns that wrote rows, each with the person's words and its row lines as steps
  function turnsOut(rowLines: Line[]): RunView[] {
    const byTurn = new Map<string, Line[]>()
    for (const l of rowLines)
      if (l.turn && !l.run) byTurn.set(l.turn, [...(byTurn.get(l.turn) ?? []), l])
    return [...byTurn].map(([turn, ls]) => {
      const said = world.lineById(Number(turn))
      const at = said?.at ?? (ls[0] as Line).at
      const asked = said?.words ?? ''
      return {
        ...lineOut({ ...(ls[0] as Line), at }, 'turn', 'Alpha', said?.module ?? null),
        id: `turn-${turn}`,
        words: asked
          ? `You asked: “${asked.length > 120 ? `${asked.slice(0, 117)}…` : asked}”`
          : null,
        steps: ls.map((l) => ({ id: l.id, at: l.at, kind: l.kind, words: l.words })),
        undo: undoOf({ turn }, 'Revert', `what Alpha did at ${clock(at)}`),
      }
    })
  }
  const activity = (): RunView[] => {
    const runs: RunView[] = (engine.hands?.runner.runs(100) ?? []).map(runOut)
    const reads: RunView[] = world.lines({ kinds: ['connection_read'], limit: 200 }).map((l) => ({
      id: `read-${l.id}`,
      kind: 'read',
      name: String(l.data.name ?? 'A connection'),
      module: null,
      moduleId: null,
      startedAt: new Date(Date.parse(l.at) - Number(l.data.ms ?? 0)).toISOString(),
      ms: Number(l.data.ms ?? 0),
      state: l.data.state === 'failed' ? 'failed' : 'ok',
      words: l.words,
      tokens: null,
      quiet: l.data.quiet === true,
      steps: [],
      undo: null,
    }))
    const rowLines = world.lines({ kinds: ROWS, limit: 1000 })
    // removals and reverts made outside a run or a turn: the person's, mostly
    const own = rowLines
      .filter((l) => !l.run && !l.turn && (l.kind === 'reverted' || l.kind === 'removed'))
      .filter((l) => l.kind === 'reverted' || Array.isArray(l.data.records))
      .map((l) => {
        const who = byWords(`${l.actor.kind}:${l.actor.id ?? ''}`)
        return l.kind === 'removed'
          ? {
              ...lineOut(l, 'removal', who, l.module),
              undo: undoOf({ line: l.id }, 'Bring back', 'the removal'),
            }
          : {
              ...lineOut(l, 'revert', who, l.module),
              undo: undoOf({ line: l.id }, 'Revert', `the revert at ${clock(l.at)}`),
            }
      })
    return [...runs, ...reads, ...turnsOut(rowLines), ...own]
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
      .slice(0, 200)
  }

  function moduleOf(id: string | null): { id: string; name: string } | null {
    const m = id ? world.shape.module(id) : undefined
    return m ? { id: m.id, name: m.name } : null
  }

  function aboutRows(about: unknown): AboutRows | null {
    const a = about as
      | { table: string; rows: string[]; choice?: { field: string; value: string; label: string } }
      | undefined
    const t = a ? world.shape.table(a.table) : undefined
    if (!a || !t) return null
    const field = a.choice ? t.fields.find((f) => f.name === a.choice?.field) : undefined
    const byId = new Map(world.records.list(t.id).map((r) => [r.id, r]))
    return {
      table: t.id,
      rows: a.rows.flatMap((id) => {
        const r = byId.get(id)
        if (!r) return []
        const v = field ? r.values[field.slug] : null
        return [{ id, name: world.rowName(t, r.values), value: typeof v === 'string' ? v : null }]
      }),
      choice: a.choice ?? null,
    }
  }

  function sourceView(p: Provenance): SourceView {
    const at = p.at
    switch (p.kind) {
      case 'stated': {
        const line = p.source.message !== undefined ? world.lineById(p.source.message) : null
        const beside = p.beside
          ? {
              beside: {
                value: p.beside.value,
                words: `Alpha works it out${p.beside.formula ? ` with ${p.beside.formula}` : ''}`,
                ...(p.beside.note ? { note: p.beside.note } : {}),
              },
            }
          : {}
        if (line?.kind === 'set')
          return { kind: 'stated', words: 'You set it in your window', at, ...beside }
        const words = line?.words
        return {
          kind: 'stated',
          words: words
            ? `You said “${words}”`
            : p.source.card
              ? 'You accepted it on a card'
              : 'You said it',
          at,
          ...beside,
        }
      }
      case 'looked_up': {
        if (p.source.file) {
          const f = world.files.findFile(p.source.file)
          return {
            kind: 'looked_up',
            words: `From ${f?.name ?? 'a file'}${p.source.page ? `, page ${p.source.page}` : ''}${p.source.sheet ? `, ${p.source.sheet}` : ''}${p.source.cell ? ` ${p.source.cell}` : ''}`,
            at,
            open: {
              file: f?.hash ?? p.source.file,
              ...(p.source.cell ? { cell: p.source.cell } : {}),
              ...(p.source.sheet ? { sheet: p.source.sheet } : {}),
              ...(p.source.page ? { page: p.source.page } : {}),
              ...(p.source.box ? { box: p.source.box } : {}),
              ...(p.source.line ? { line: p.source.line } : {}),
            },
          }
        }
        const by = p.source.connector?.startsWith('agent:')
          ? `, read by ${p.source.connector.slice('agent:'.length)}`
          : ''
        if (p.source.url)
          return {
            kind: 'looked_up',
            words: `From ${URL.canParse(p.source.url) ? new URL(p.source.url).host : p.source.url}${by}`,
            at,
            open: { url: p.source.url },
          }
        if (p.source.connector === 'kit')
          return {
            kind: 'looked_up',
            words: `Set up by the kit ${p.source.account ?? ''}`.trim(),
            at,
          }
        if (by) return { kind: 'looked_up', words: `Read by ${by.slice(', read by '.length)}`, at }
        return { kind: 'looked_up', words: 'Looked up', at }
      }
      case 'computed':
        return {
          kind: 'computed',
          words: p.source.formula ? `Computed: ${p.source.formula}` : 'Computed from other values',
          at,
          ...(p.source.note ? { note: p.source.note } : {}),
        }
      case 'estimated':
        return { kind: 'estimated', words: `Estimated: ${p.basis ?? ''}`.trim(), at }
      case 'assumed':
        return { kind: 'assumed', words: `Assumed: ${p.basis ?? ''}`.trim(), at }
    }
  }

  return {
    cardOut,
    today,
    inDays,
    placeOf,
    waitingCards,
    workingOn,
    lineOf,
    taskOut,
    taskOfRun,
    given,
    needsOf,
    summaries,
    byWords,
    runOut,
    activity,
    moduleOf,
    aboutRows,
    sourceView,
    columnOf,
    deny,
    savedView,
    cardView,
    shown,
  }
}

// A row as a person names it: its first text value.
// A cell's column as a number: A is 1, Z 26, AA 27.
export function columnOf(cell: string): number {
  let n = 0
  for (const ch of cell.replace(/\d+$/, '')) n = n * 26 + (ch.charCodeAt(0) - 64)
  return n
}

export function deny(reply: FastifyReply, words: string) {
  return reply.code(403).send({ problem: words })
}

export function savedView(v: View): SavedView {
  return {
    id: v.id,
    name: v.name,
    config: v.config,
    isDefault: v.isDefault,
    madeBy: v.madeBy,
    about: v.about,
  }
}

export function cardView(c: Card): CardView {
  const input = (c.call?.input ?? {}) as { connector?: unknown; host?: unknown }
  return {
    id: c.id,
    kind: c.kind,
    state: c.state,
    words: c.words,
    detail: c.detail,
    gate: c.gate,
    connector: c.gate === 'sign_in' && typeof input.connector === 'string' ? input.connector : null,
    site:
      c.gate === 'sign_in' && c.call?.tool === 'site_sign_in' && typeof input.host === 'string'
        ? input.host
        : null,
    options: c.options,
    cannotUndo: c.cannotUndo,
    answer: c.answer,
    restsOn: c.restsOn,
    module: c.module,
  }
}

// Whether People and Organizations live in this module, by its module.yaml (Network's says so).
export const livesPeople = (m: Module): boolean => manifestSays(m, 'people')

// Whether this is Alpha's own module, the kit the core keeps (its module.yaml says core: true):
// its Decisions and Noticed are the Second Brain.
export const isAlphas = (m: Module): boolean => manifestSays(m, 'core')

// The window gets words, not the tools' inputs.
export function shown(kind: string, data: Record<string, unknown>): Record<string, unknown> {
  if (kind === 'call') return { call: data.call }
  if (kind === 'called') return { call: data.call, ok: data.ok }
  if (kind === 'card_closed') return { state: data.state, answer: data.answer ?? null }
  if (kind === 'made' || kind === 'wrote' || kind === 'shaped') return { table: data.table ?? null }
  return {}
}
