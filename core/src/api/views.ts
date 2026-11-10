import { existsSync } from 'node:fs'
import { join } from 'node:path'
import type { FastifyReply } from 'fastify'
import { config } from '../config.ts'
import { startOf } from '../engine/task-runs.ts'
import { unmetNeeds } from '../modules/runs/index.ts'
import { readSchedule, type Schedule } from '../modules/schedules.ts'
import { pagesOf } from '../pages/pages.ts'
import { CHIEF, CHIEF_CARD } from '../world/agents/index.ts'
import type { Card } from '../world/cards.ts'
import type { Provenance } from '../world/kinds.ts'
import { besideFrom, type RecordOut, resetWords } from '../world/records/index.ts'
import type { Module, Table } from '../world/shape/index.ts'
import { manifestSays } from '../world/shape/manifest.ts'
import { placeOf } from '../world/shape/parts.ts'
import type { Task } from '../world/tasks/index.ts'
import { taskOfTurn } from '../world/tasks/index.ts'
import type { View } from '../world/views.ts'
import { activityView } from './activity-view.ts'
import type { BaseCtx } from './ctx.ts'
import type {
  AboutRows,
  CardView,
  ModuleSummary,
  RowView,
  SavedView,
  SourceView,
  TableSummary,
  TaskLineView,
  TaskView,
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
    tab: t.tab,
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
  const lineOf = (t: Task): TaskLineView => {
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
    }
  }
  const taskOut = (id: string): TaskView | undefined => {
    const t = world.tasks.get(id)
    if (!t) return undefined
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
    const begins = startOf(t)
    // who can own it: the person or Alpha
    const owners = [
      { kind: 'person' as const, id: user.id, name: 'You' },
      ...(t.owner.kind === 'alpha' && !t.owner.id
        ? [{ kind: 'alpha' as const, id: null, name: 'Alpha' }]
        : []),
      { kind: 'alpha' as const, id: CHIEF, name: CHIEF_CARD.name },
      ...world.agents.list().map((a) => ({ kind: 'alpha' as const, id: a.id, name: a.name })),
    ]
    const agentId = t.owner.kind === 'alpha' ? t.owner.id : null
    const had = agentId && agentId !== CHIEF ? world.agents.get(agentId) : undefined
    const agent = !agentId
      ? null
      : agentId === CHIEF
        ? { ...CHIEF_CARD, model: world.agents.modelOf(CHIEF) ?? config.models().desk, chief: true }
        : had
          ? {
              id: had.id,
              name: had.name,
              title: had.title,
              description: had.description,
              model: had.model ?? config.models().desk,
              chief: false,
            }
          : null
    return {
      ...lineOf(t),
      agent,
      schedule: t.schedule ? { id: t.schedule, name: t.title } : null,
      startsAt: t.startsAt,
      beginsAt: begins === null ? null : new Date(begins).toISOString(),
      notes: t.notes,
      remindedAt: t.remindedAt,
      madeBy: t.madeBy.startsWith('person')
        ? 'You'
        : t.madeBy.startsWith('schedule:')
          ? t.madeBy.slice(6)
          : 'Alpha',
      placedBy: t.placedBy,
      placedWhy: t.placedWhy,
      createdAt: t.createdAt,
      doneAt: t.doneAt,
      parentTitle: parent?.title ?? null,
      subtasks: world.tasks.children(t.id).map((k) => lineOf(k)),
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
                .map((x) => lineOf(x))
            : [],
      },
      history: world
        .lines({ kinds: ['task', 'reminder'] })
        .filter((l) => (l.data as { task?: string; tasks?: string[] }).task === t.id)
        .slice(-40)
        .reverse()
        .map((l) => ({ at: l.at, words: l.words })),
      owners,
    }
  }

  // only what was sent: a field left out is left as it is
  const given = <T extends object>(o: T) =>
    Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T

  // The modules the window shows: each with a page or a table in sight, and the modules they sit
  // inside (a module only of a connection's hidden tables stays out).
  // What a schedule needs that is not there, in words, from its file.
  const needsOf = (m: Module, a: Schedule): string | null => {
    const path = join(m.dir, a.file)
    if (!existsSync(path)) return null
    try {
      const missing = unmetNeeds(world, readSchedule(path))
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
    if (kind === 'schedule' || kind === 'connector') return id ?? kind
    if (kind === 'system') return 'Its kit'
    return 'Alpha'
  }
  const { activity, runOut } = activityView(ctx, byWords)

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

  // A value's source in words; on a mirror's source field (mirror: its system), the person's value
  // is their correction, kept in Alpha (rules D6).
  function sourceView(p: Provenance, mirror?: string | null): SourceView {
    const at = p.at
    switch (p.kind) {
      case 'stated': {
        const line = p.source.message !== undefined ? world.lineById(p.source.message) : null
        // what is beside their value (rules D3, D6): a page's or a connection's newer read, or
        // what a script works it out as, and what Reset puts back
        const b = p.beside
        const beside = b
          ? {
              beside: {
                value: b.value,
                words:
                  b.kind === 'looked_up'
                    ? `${besideFrom(b) === 'the page' ? 'The page now says' : `${besideFrom(b)} says`}, read ${b.at.slice(0, 10)}`
                    : `Alpha works it out${b.formula ? ` with ${b.formula}` : ''}`,
                reset: `Reset to ${resetWords(b)}`,
                ...(b.note ? { note: b.note } : {}),
              },
            }
          : {}
        if (mirror)
          return {
            kind: 'stated',
            words: `Corrected in Alpha; nothing goes back to ${mirror}`,
            at,
            ...beside,
          }
        // set by hand: the change's own line (rules A1), or the window's own line before it
        if (line && ['set', 'changed', 'wrote'].includes(line.kind))
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
        const by = p.source.connector?.startsWith('schedule:')
          ? `, read by ${p.source.connector.slice('schedule:'.length)}`
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
            words: `Set up by the module ${p.source.account ?? ''}`.trim(),
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

  // Which system a mirror's row was read from: its connection's, where the table mirrors several.
  const readFrom = (mirror: string, r: RecordOut) => {
    const c = Object.values(r.provenance).find((p) => p.source.connector)?.source.connector ?? ''
    return mirror.split(' and ').find((m) => m.toLowerCase() === c.toLowerCase()) ?? mirror
  }

  // A row as a table or its page shows it: its values, each one's source, and on a mirror when
  // it was last read and whether its source deleted it (rules D6, D8, D12).
  function rowOut(t: Table, r: RecordOut): RowView {
    const source = new Set(t.mirror ? t.fields.filter((f) => f.key).map((f) => f.slug) : [])
    return {
      id: r.id,
      values: r.values,
      sources: Object.fromEntries(
        Object.entries(r.provenance).map(([k, p]) => [
          k,
          sourceView(p, source.has(k) && t.mirror ? readFrom(t.mirror, r) : null),
        ]),
      ),
      ...(t.mirror && r.readAt ? { read: { from: readFrom(t.mirror, r), at: r.readAt } } : {}),
      ...(r.goneAt ? { gone: r.goneAt } : {}),
    }
  }

  return {
    cardOut,
    today,
    inDays,
    placeOf,
    lineOf,
    taskOut,
    given,
    needsOf,
    summaries,
    byWords,
    runOut,
    activity,
    moduleOf,
    aboutRows,
    sourceView,
    rowOut,
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
    task: taskOfTurn(c.turn),
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

// Whether People and Organizations live in this module, by its module.yaml.
export const livesPeople = (m: Module): boolean => manifestSays(m, 'people')

// The window gets words, not the tools' inputs.
export function shown(kind: string, data: Record<string, unknown>): Record<string, unknown> {
  if (kind === 'call') return { call: data.call }
  if (kind === 'called') return { call: data.call, ok: data.ok }
  if (kind === 'card_closed') return { state: data.state, answer: data.answer ?? null }
  if (kind === 'made' || kind === 'wrote' || kind === 'shaped') return { table: data.table ?? null }
  if (kind === 'asking') return { ask: data.ask, direct: data.direct === true }
  if (kind === 'answered')
    return {
      ask: data.ask,
      status: data.status,
      evidence: data.evidence ?? null,
      unblock: data.unblock ?? null,
    }
  if (kind === 'agent_changed')
    return { changed: data.changed, commit: data.commit, path: data.path }
  return {}
}
