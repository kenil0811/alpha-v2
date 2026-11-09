// Where a table sits in its module (core step 3a, Kenil's yes 27 Oct): a relation can be part of
// the row it points at (a deal's Financials are part of the deal), and a table can be setup (what
// the module's schedules read). A module's tabs are its main tables: neither part of another nor
// setup. No roles, no order to keep, no cap: the place falls out of what the rows are.
import { all, json, one, parse, run, tx } from '../db.ts'
import { quote } from '../ddl.ts'
import { append } from '../journal.ts'
import { Refused } from '../kinds.ts'
import { asks } from './asks.ts'
import { manifestSays, writeManifest } from './manifest.ts'
import type { Shape } from './shape.ts'
import type { Table, WriteCtx } from './types.ts'
import { findField } from './types.ts'

// people: a one-row-per-person table of the module People lives in (step 4, Network): its rows
// are People's columns and a person's page, so it is no tab of its own either
export type Place = 'main' | 'part' | 'setup' | 'people'

export function placeOf(t: Table): Place {
  if (t.setup) return 'setup'
  if (t.fields.some((f) => f.partOf)) return 'part'
  return t.fields.some((f) => f.per === 'person') && manifestSays(t.module, 'people')
    ? 'people'
    : 'main'
}

// The tables whose rows are part of this one's, each with the relation that says so.
export function partsOf(shape: Shape, tableId: string): { table: Table; field: string }[] {
  const out: { table: Table; field: string }[] = []
  for (const t of shape.tables())
    for (const f of t.fields)
      if (f.partOf && f.relatesTo === tableId) out.push({ table: t, field: f.id })
  return out
}

export function setSetup(shape: Shape, tableId: string, setup: boolean, ctx: WriteCtx): Table {
  return tx(shape.db, () => {
    const table = shape.table(tableId)
    if (!table) throw new Refused('That table is not there.')
    if (table.setup === setup) return table
    run(shape.db, 'UPDATE tables SET setup = ? WHERE id = ?', setup ? 1 : 0, table.id)
    append(shape.db, {
      actor: ctx.actor,
      kind: 'shaped',
      words: setup
        ? `${table.name} is setup for ${table.module.name}'s schedules now, under Schedules and notes.`
        : `${table.name} is one of ${table.module.name}'s own tables again.`,
      data: { table: table.id, setup },
      user: ctx.user ?? null,
      turn: ctx.turn ?? null,
      module: table.module.id,
      run: ctx.run ?? null,
    })
    writeManifest(shape, table.module)
    return shape.table(table.id) as Table
  })
}

// A table kept as a tab of its module, or not (28 Oct): a part or a setup table shown among the
// tabs too, every row of it; where it sits and what goes with its rows don't change. A main table
// is a tab already, and People's columns live on People.
export function setTab(shape: Shape, tableId: string, tab: boolean, ctx: WriteCtx): Table {
  return tx(shape.db, () => {
    const table = shape.table(tableId)
    if (!table) throw new Refused('That table is not there.')
    const place = placeOf(table)
    if (place === 'main')
      throw new Refused(`${table.name} is one of ${table.module.name}'s tabs already.`)
    if (place === 'people')
      throw new Refused(`${table.name} is People's columns: it shows on People, not as a tab.`)
    if (table.tab === tab) return table
    run(shape.db, 'UPDATE tables SET tab = ? WHERE id = ?', tab ? 1 : 0, table.id)
    append(shape.db, {
      actor: ctx.actor,
      kind: 'shaped',
      words: tab
        ? `${table.name} is a tab of ${table.module.name} now, every row of it; its rows stay where they are.`
        : `${table.name} is no longer a tab of ${table.module.name}.`,
      data: { table: table.id, tab },
      user: ctx.user ?? null,
      turn: ctx.turn ?? null,
      module: table.module.id,
      run: ctx.run ?? null,
    })
    writeManifest(shape, table.module)
    return shape.table(table.id) as Table
  })
}

// A relation made part of its row, or not. Made part of only when every row has its row: a part
// is never on its own.
export function setPartOf(
  shape: Shape,
  tableId: string,
  field: string,
  partOf: boolean,
  ctx: WriteCtx,
): Table {
  asks(
    shape,
    { table: tableId },
    (t) => ({
      words: `make ${t?.name}'s rows ${partOf ? '' : 'no longer '}part of the row its ${field} names`,
      method: 'setPartOf',
      args: [tableId, field, partOf],
    }),
    ctx,
  )
  return tx(shape.db, () => {
    const table = shape.table(tableId)
    if (!table) throw new Refused('That table is not there.')
    const f = findField(table, field)
    if (f.kind !== 'relation' || f.many)
      throw new Refused(`${f.name} can be part of a row only as a relation to one row.`)
    if (f.partOf === partOf) return table
    const parent = shape.table(f.relatesTo ?? '')
    if (partOf) {
      if (f.relatesTo === table.id)
        throw new Refused(`A row of ${table.name} can't be part of itself.`)
      const other = table.fields.find((x) => x.partOf && x.id !== f.id)
      if (other)
        throw new Refused(
          `${table.name} is part of ${shape.table(other.relatesTo ?? '')?.name} already.`,
        )
      const empty = Number(
        one<{ n: number }>(
          shape.db,
          `SELECT count(*) AS n FROM ${quote(table.slug)} WHERE ${quote(f.slug)} IS NULL`,
        )?.n ?? 0,
      )
      if (empty)
        throw new Refused(
          `${empty} row${empty === 1 ? '' : 's'} of ${table.name} ${empty === 1 ? 'has' : 'have'} no ${f.name}; a part is never on its own, so fill ${empty === 1 ? 'it' : 'them'} in first.`,
        )
    }
    const o = parse<Record<string, unknown>>(
      one<{ options: string }>(shape.db, 'SELECT options FROM fields WHERE id = ?', f.id)?.options,
      {},
    )
    const { partOf: _was, ...rest } = o
    run(
      shape.db,
      'UPDATE fields SET options = ? WHERE id = ?',
      json(partOf ? { ...rest, partOf: true } : rest),
      f.id,
    )
    append(shape.db, {
      actor: ctx.actor,
      kind: 'shaped',
      words: partOf
        ? `A row of ${table.name} is part of its ${parent?.name ?? f.name} row now: it shows there, and goes and comes back with it.`
        : `A row of ${table.name} is no longer part of its ${parent?.name ?? f.name} row.`,
      data: { table: table.id, field: f.id, partOf },
      user: ctx.user ?? null,
      turn: ctx.turn ?? null,
      module: table.module.id,
      run: ctx.run ?? null,
    })
    writeManifest(shape, table.module)
    return shape.table(table.id) as Table
  })
}

// The rows that are part of these, and their parts in turn, by table, deepest first: what a
// removal of these takes with it.
export function partRows(
  shape: Shape,
  tableId: string,
  ids: string[],
  seen = new Set<string>(),
): { table: Table; ids: string[] }[] {
  const out: { table: Table; ids: string[] }[] = []
  for (const p of partsOf(shape, tableId)) {
    if (seen.has(p.table.id)) continue
    const f = p.table.fields.find((x) => x.id === p.field)
    if (!f || !ids.length) continue
    const found: string[] = []
    for (let i = 0; i < ids.length; i += 500)
      found.push(
        ...all<{ id: string }>(
          shape.db,
          `SELECT id FROM ${quote(p.table.slug)} WHERE ${quote(f.slug)} IN (${ids
            .slice(i, i + 500)
            .map(() => '?')
            .join(', ')})`,
          ...ids.slice(i, i + 500),
        ).map((r) => r.id),
      )
    if (!found.length) continue
    out.push(...partRows(shape, p.table.id, found, new Set([...seen, tableId])))
    out.push({ table: p.table, ids: found })
  }
  return out
}
