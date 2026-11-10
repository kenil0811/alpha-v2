// One row per person: a person field can say `per: person`, and its table then holds at most one
// row for each person. The shape keeps the mark and its walls; the record store refuses a second
// row and folds rows when two people merge (records/fold.ts).
import { json, one, parse, run, tx } from '../db.ts'
import { quote } from '../ddl.ts'
import { append } from '../journal.ts'
import { Refused } from '../kinds.ts'
import { asks } from './asks.ts'
import { manifestSays, writeManifest } from './manifest.ts'
import type { Shape } from './shape.ts'
import type { Table, WriteCtx } from './types.ts'
import { findField } from './types.ts'

// The person field a table's rows are one per, if any.
export const perField = (t: Table) => t.fields.find((f) => f.per === 'person')

// The one-row-per-person tables of the module People lives in (Network's): their fields join
// People's own columns, a person's page and the model's people view.
export const peopleTables = (shape: Shape): Table[] =>
  shape
    .modules()
    .filter((m) => manifestSays(m, 'people'))
    .flatMap((m) => shape.tables(m.id))
    .filter((t) => !!perField(t))

// Only a person field, once a table, and only while every row has its person.
export function perAllowed(shape: Shape, table: Table, name: string, kind: string, made: boolean) {
  if (kind !== 'person')
    throw new Refused(
      `${name} is not a person field: only a person field holds one row per person.`,
    )
  const was = perField(table)
  if (was && was.name !== name)
    throw new Refused(`${table.name} holds one row per person already, by ${was.name}.`)
  // a new field on a table with rows is empty on each of them
  if (made && one(shape.db, `SELECT 1 FROM ${quote(table.slug)} LIMIT 1`))
    throw new Refused(
      `${table.name} has rows already; add ${name} as a person field, fill it in, then make the table one row per person.`,
    )
}

// The mark set or taken off. Rows that share a person must be folded first: the record store's
// setPer does that, then calls this.
export function setPer(
  shape: Shape,
  tableId: string,
  field: string,
  per: boolean,
  ctx: WriteCtx,
): Table {
  asks(
    shape,
    { table: tableId },
    (t) => ({
      words: `${per ? 'keep' : 'stop keeping'} one row per person in ${t?.name}`,
      method: 'setPer',
      args: [tableId, field, per],
    }),
    ctx,
  )
  return tx(shape.db, () => {
    const table = shape.table(tableId)
    if (!table) throw new Refused('That table is not there.')
    const f = findField(table, field)
    if ((f.per === 'person') === per) return table
    if (per) {
      perAllowed(shape, table, f.name, f.kind, false)
      if (one(shape.db, `SELECT 1 FROM ${quote(table.slug)} WHERE ${quote(f.slug)} IS NULL`))
        throw new Refused(
          `Some rows of ${table.name} name no one in ${f.name}; give each its person first.`,
        )
    }
    const o = parse<Record<string, unknown>>(
      one<{ options: string }>(shape.db, 'SELECT options FROM fields WHERE id = ?', f.id)?.options,
      {},
    )
    const { per: _was, ...rest } = o
    run(
      shape.db,
      'UPDATE fields SET options = ? WHERE id = ?',
      json(per ? { ...rest, per: 'person' } : rest),
      f.id,
    )
    append(shape.db, {
      actor: ctx.actor,
      kind: 'shaped',
      words: per
        ? `${table.name} holds one row per person now, by ${f.name}.`
        : `${table.name} may hold more than one row per person again.`,
      data: { table: table.id, field: f.id, per: per ? 'person' : null },
      user: ctx.user ?? null,
      turn: ctx.turn ?? null,
      module: table.module.id,
      run: ctx.run ?? null,
    })
    writeManifest(shape, table.module)
    return shape.table(table.id) as Table
  })
}
