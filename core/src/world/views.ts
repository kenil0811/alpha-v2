// Saved views (design §4, §14; step 10, Kenil 20 Oct): a table's named ways of looking at it, its
// filters, sorts, group, columns, totals and colours, shared by everyone in the firm. Kept by
// field id, so a renamed field keeps its views; given and shown by field name. Each change is
// journaled; removing a table removes its views (shape.removeTable).
import { createHash } from 'node:crypto'
import { z } from 'zod'
import { all, type Db, json, newId, now, one, parse, run, tx } from './db.ts'
import { append } from './journal.ts'
import { Refused } from './kinds.ts'
import { findField, type Shape, type Table, type WriteCtx } from './shape/index.ts'

export const VIEW_KINDS = [
  'table',
  'board',
  'list',
  'gallery',
  'calendar',
  'timeline',
  'chart',
  'form',
] as const

export const FILTER_OPS = [
  'is',
  'is_not',
  'contains',
  'not_contains',
  'starts',
  'ends',
  'eq',
  'ne',
  'gt',
  'lt',
  'between',
  'before',
  'after',
  'today',
  'this_week',
  'next_days',
  'in',
  'empty',
  'not_empty',
] as const

export const TOTAL_OPS = [
  'sum',
  'avg',
  'min',
  'max',
  'count',
  'empty',
  'filled',
  'unique',
  'earliest',
  'latest',
] as const

const Value = z.union([z.string(), z.number()]).nullable()

export const ViewConfig = z.object({
  kind: z.enum(VIEW_KINDS).default('table'),
  search: z.string().default(''),
  filters: z
    .object({
      match: z.enum(['all', 'any']).default('all'),
      rules: z
        .array(
          z.object({
            field: z.string(),
            op: z.enum(FILTER_OPS),
            value: Value.optional(),
            value2: Value.optional(),
            values: z.array(z.string()).optional(),
          }),
        )
        .default([]),
    })
    .default({ match: 'all', rules: [] }),
  sorts: z.array(z.object({ field: z.string(), dir: z.enum(['asc', 'desc']) })).default([]),
  group: z.string().nullable().default(null), // a table's groups, a board's columns
  by: z.string().nullable().default(null), // the date a calendar, timeline or chart is laid on
  measure: z.string().nullable().default(null), // what a chart adds up (a number); none counts rows
  hidden: z.array(z.string()).default([]),
  order: z.array(z.string()).default([]),
  widths: z.record(z.string(), z.number().min(48).max(1200)).default({}),
  frozen: z.number().int().min(1).max(50).default(1), // columns that stay at the left as it scrolls across
  wrap: z.array(z.string()).default([]), // fields whose words run onto more lines
  totals: z.record(z.string(), z.enum(TOTAL_OPS)).default({}),
  colours: z
    .object({
      tint: z.string().nullable().default(null), // rows tinted by a choice's colours
      when: z
        .array(
          z.object({
            field: z.string(),
            op: z.enum(['gt', 'lt', 'eq', 'before', 'after']),
            value: Value,
            tone: z.enum(['good', 'warn', 'bad', 'accent']),
          }),
        )
        .default([]),
    })
    .default({ tint: null, when: [] }),
})
export type ViewConfig = z.infer<typeof ViewConfig>

export type MadeBy = 'person' | 'alpha' | 'kit'

export interface View {
  id: string
  table: string
  name: string
  config: ViewConfig
  isDefault: boolean
  madeBy: MadeBy
  kitHash: string | null // the kit's version of it, while nobody has changed it
  about: string | null // the question the view answers, in a sentence
}

interface ViewRow {
  id: string
  table_id: string
  name: string
  config: string
  is_default: number
  made_by: MadeBy
  kit_hash: string | null
  about: string | null
}

export const hashOf = (c: ViewConfig) => createHash('sha256').update(json(c)).digest('hex')

// Every field a view names, from its name, slug or id to its id; a field that is not there is
// refused with the ones that are.
export function resolveConfig(table: Table, input: unknown): ViewConfig {
  const c = ViewConfig.parse(input ?? {})
  const id = (name: string) => findField(table, name).id
  const opt = (name: string | null) => (name ? id(name) : null)
  const resolved: ViewConfig = {
    ...c,
    filters: { ...c.filters, rules: c.filters.rules.map((r) => ({ ...r, field: id(r.field) })) },
    sorts: c.sorts.map((s) => ({ ...s, field: id(s.field) })),
    group: opt(c.group),
    by: opt(c.by),
    measure: opt(c.measure),
    hidden: c.hidden.map(id),
    order: c.order.map(id),
    widths: Object.fromEntries(Object.entries(c.widths).map(([k, v]) => [id(k), v])),
    wrap: c.wrap.map(id),
    totals: Object.fromEntries(Object.entries(c.totals).map(([k, v]) => [id(k), v])),
    colours: {
      tint: opt(c.colours.tint),
      when: c.colours.when.map((w) => ({ ...w, field: id(w.field) })),
    },
  }
  // a board needs a choice to group by: its first choice when none was named
  if (resolved.kind === 'board') {
    const grouped = table.fields.find((f) => f.id === resolved.group)
    if (grouped?.kind !== 'choice') {
      const choice = table.fields.find((f) => f.kind === 'choice')
      if (!choice) throw new Refused(`${table.name} has no choice to make a board of.`)
      resolved.group = choice.id
    }
  }
  // a calendar or timeline needs a date
  if (['calendar', 'timeline'].includes(resolved.kind)) {
    const by = table.fields.find((f) => f.id === resolved.by)
    if (by?.kind !== 'date') {
      const date = table.fields.find((f) => f.kind === 'date')
      if (!date) throw new Refused(`${table.name} has no date to lay a ${resolved.kind} on.`)
      resolved.by = date.id
    }
  }
  // a chart has its bars by a group, else by the months of a date; it adds up a number or counts
  if (resolved.kind === 'chart') {
    const group = table.fields.find((f) => f.id === resolved.group)
    const by = table.fields.find((f) => f.id === resolved.by)
    if (!group && by?.kind !== 'date') {
      const choice = table.fields.find((f) => f.kind === 'choice')
      const date = table.fields.find((f) => f.kind === 'date')
      if (choice) resolved.group = choice.id
      else if (date) resolved.by = date.id
      else throw new Refused(`${table.name} has no choice or date to chart its rows by.`)
    }
    const measure = table.fields.find((f) => f.id === resolved.measure)
    if (resolved.measure && measure?.kind !== 'number' && measure?.kind !== 'money')
      throw new Refused(`A chart adds up a number; ${measure?.name ?? 'that field'} is not one.`)
  }
  return resolved
}

// A view as module.yaml and the model read it: field names, not ids.
export function namedConfig(table: Table, c: ViewConfig): ViewConfig {
  const name = (id: string) => table.fields.find((f) => f.id === id)?.name
  const known = (id: string) => !!name(id)
  return {
    ...c,
    filters: {
      ...c.filters,
      rules: c.filters.rules
        .filter((r) => known(r.field))
        .map((r) => ({ ...r, field: name(r.field) as string })),
    },
    sorts: c.sorts
      .filter((s) => known(s.field))
      .map((s) => ({ ...s, field: name(s.field) as string })),
    group: c.group ? (name(c.group) ?? null) : null,
    by: c.by ? (name(c.by) ?? null) : null,
    measure: c.measure ? (name(c.measure) ?? null) : null,
    hidden: c.hidden.filter(known).map((h) => name(h) as string),
    order: c.order.filter(known).map((o) => name(o) as string),
    widths: Object.fromEntries(
      Object.entries(c.widths)
        .filter(([k]) => known(k))
        .map(([k, v]) => [name(k) as string, v]),
    ),
    wrap: c.wrap.filter(known).map((w) => name(w) as string),
    totals: Object.fromEntries(
      Object.entries(c.totals)
        .filter(([k]) => known(k))
        .map(([k, v]) => [name(k) as string, v]),
    ),
    colours: {
      tint: c.colours.tint ? (name(c.colours.tint) ?? null) : null,
      when: c.colours.when
        .filter((w) => known(w.field))
        .map((w) => ({ ...w, field: name(w.field) as string })),
    },
  }
}

export interface SaveInput {
  table: string
  id?: string // a view being changed; none for a new one
  name: string
  config: unknown // by field name, slug or id
  isDefault?: boolean | undefined
  madeBy?: MadeBy
  kitHash?: string | null
  about?: string | null // given: set (null takes it off); left out: kept as it was
}

export class Views {
  private db: Db
  private shape: Shape

  constructor(db: Db, shape: Shape) {
    this.db = db
    this.shape = shape
  }

  list(tableId: string): View[] {
    return all<ViewRow>(
      this.db,
      'SELECT * FROM views WHERE table_id = ? ORDER BY created_at',
      tableId,
    ).map(out)
  }

  get(id: string): View | undefined {
    const r = one<ViewRow>(this.db, 'SELECT * FROM views WHERE id = ?', id)
    return r ? out(r) : undefined
  }

  save(input: SaveInput, ctx: WriteCtx): View {
    return tx(this.db, () => {
      const table = this.shape.table(input.table)
      if (!table) throw new Refused('That table is not there.')
      const name = input.name.trim()
      if (!name) throw new Refused('A view needs a name.')
      if (name.toLowerCase() === 'all' || name.toLowerCase() === table.name.toLowerCase())
        throw new Refused(`"${name}" is taken by the table itself; give the view its own name.`)
      const before = input.id ? this.get(input.id) : undefined
      if (input.id && (!before || before.table !== table.id))
        throw new Refused('That view is not there.')
      const clash = one<{ id: string }>(
        this.db,
        'SELECT id FROM views WHERE table_id = ? AND lower(name) = lower(?)',
        table.id,
        name,
      )
      if (clash && clash.id !== before?.id)
        throw new Refused(`${table.name} already has a view called ${name}.`)
      const config = resolveConfig(table, input.config)
      const isDefault = input.isDefault ?? before?.isDefault ?? false
      if (isDefault) run(this.db, 'UPDATE views SET is_default = 0 WHERE table_id = ?', table.id)
      const at = now()
      const id = before?.id ?? newId('v')
      if (before)
        run(
          this.db,
          `UPDATE views SET name = ?, config = ?, is_default = ?, kit_hash = ?, about = ?, updated_at = ?
           WHERE id = ?`,
          name,
          json(config),
          isDefault ? 1 : 0,
          // a kit's view that someone changed is theirs from now on: the kit's updates pass it by
          input.kitHash !== undefined ? input.kitHash : null,
          input.about !== undefined ? input.about?.trim() || null : before.about,
          at,
          id,
        )
      else
        run(
          this.db,
          `INSERT INTO views (id, table_id, name, config, is_default, made_by, kit_hash, about,
             created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          id,
          table.id,
          name,
          json(config),
          isDefault ? 1 : 0,
          input.madeBy ?? (ctx.actor.kind === 'person' ? 'person' : 'alpha'),
          input.kitHash ?? null,
          input.about?.trim() || null,
          at,
          at,
        )
      append(this.db, {
        actor: ctx.actor,
        kind: 'view',
        words: before
          ? before.name !== name
            ? `Renamed the view ${before.name} on ${table.name} to ${name}.`
            : `Saved the view ${name} on ${table.name}.`
          : `Made the view ${name} on ${table.name}.`,
        data: { table: table.id, view: id, name, config },
        user: ctx.user ?? null,
        turn: ctx.turn ?? null,
        module: table.module.id,
        run: ctx.run ?? null,
      })
      this.shape.writeManifest(table.module)
      return this.get(id) as View
    })
  }

  remove(id: string, ctx: WriteCtx): void {
    tx(this.db, () => {
      const was = this.get(id)
      if (was?.kitHash) {
        const t = this.shape.table(was.table)
        if (t) this.shape.tombstone(t.module.id, 'view', `${t.name}:${was.name}`, ctx)
      }
      const v = this.get(id)
      if (!v) throw new Refused('That view is not there.')
      const table = this.shape.table(v.table)
      run(this.db, 'DELETE FROM views WHERE id = ?', id)
      append(this.db, {
        actor: ctx.actor,
        kind: 'view',
        words: `Removed the view ${v.name}${table ? ` on ${table.name}` : ''}.`,
        data: { table: v.table, view: id, name: v.name, removed: true },
        user: ctx.user ?? null,
        turn: ctx.turn ?? null,
        module: table?.module.id ?? null,
        run: ctx.run ?? null,
      })
      if (table) this.shape.writeManifest(table.module)
    })
  }
}

function out(r: ViewRow): View {
  return {
    id: r.id,
    table: r.table_id,
    name: r.name,
    config: ViewConfig.parse(parse(r.config, {})),
    isDefault: r.is_default === 1,
    madeBy: r.made_by,
    kitHash: r.kit_hash,
    about: r.about,
  }
}
