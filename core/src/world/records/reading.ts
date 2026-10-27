// Reading rows: a table's rows with their values by field and the provenance of each, one row,
// a column, ids by a value or a key, a value's history, the count; and the row readers under
// them (a stored row, its lists, its provenance).
import { all, one, parse } from '../db.ts'
import { columnsOf, junctionName, quote } from '../ddl.ts'
import { isPersonsOwn, type Provenance } from '../kinds.ts'
import { findField, spec, type Table } from '../shape/index.ts'
import type { Records } from './records.ts'
import { snapshot } from './storing.ts'
import { summaries, summaryProvenance } from './summary.ts'
import type { ProvRow, RecordOut, Row, Stored } from './types.ts'
import { CHUNK, resolve } from './types.ts'

export function list(records: Records, tableId: string): RecordOut[] {
  const table = records.mustTable(tableId)
  const rows = all<Row>(records.db, `SELECT * FROM ${quote(table.slug)} ORDER BY created_at, rowid`)
  const lists = listsOf(records, table, null)
  const prov = provenanceOfTable(records, table)
  const sums = summed(records, table, rows)
  return rows.map((r) => {
    const vals = rowVals(records, table, r, lists.get(r.id))
    return out(records, table, r, vals, resolve(prov.get(r.id), vals), sums(r.id))
  })
}

export function get(records: Records, id: string): { table: Table; record: RecordOut } | undefined {
  const table = tableOf(records, id)
  if (!table) return undefined
  const r = readRow(records, table, id)
  if (!r) return undefined
  const s = snapshot(records, table, r)
  return { table, record: out(records, table, r, s.vals, s.prov, summed(records, table, [r])(id)) }
}

// A table's summaries for these rows (core step 3c), each with its computed provenance; they
// are read out with the row, never kept in it, its versions or its words.
function summed(records: Records, table: Table, rows: Row[]) {
  const fields = table.fields.filter((f) => f.kind === 'summary')
  const sums = fields.length
    ? summaries(
        records,
        table,
        rows.map((r) => r.id),
      )
    : new Map()
  const prov = Object.fromEntries(fields.map((f) => [f.id, summaryProvenance(records.shape, f)]))
  return (id: string) => ({ vals: (sums.get(id) ?? {}) as Record<string, unknown>, prov })
}

// The table a row is in, by the registry.
export function tableOf(records: Records, id: string): Table | undefined {
  const r = one<{ table_id: string }>(records.db, 'SELECT table_id FROM records WHERE id = ?', id)
  return r ? records.shape.table(r.table_id) : undefined
}

// A row's values keyed by field id, for the readers that derive from them (people).
export function rawValues(
  records: Records,
  id: string,
): { table: Table; vals: Record<string, unknown> } | undefined {
  const table = tableOf(records, id)
  if (!table) return undefined
  const r = readRow(records, table, id)
  return r ? { table, vals: rowVals(records, table, r, undefined) } : undefined
}

// A table's row ids, oldest first.
export function ids(records: Records, tableId: string): string[] {
  const table = records.mustTable(tableId)
  return all<{ id: string }>(
    records.db,
    `SELECT id FROM ${quote(table.slug)} ORDER BY created_at, rowid`,
  ).map((r) => r.id)
}

// One field's value on every row of a table (a column, read whole).
export function column(
  records: Records,
  tableId: string,
  field: string,
): { id: string; value: unknown }[] {
  const table = records.mustTable(tableId)
  const f = findField(table, field)
  if (f.kind === 'relation' && f.many)
    return [...listsOf(records, table, null)].map(([id, by]) => ({ id, value: by[f.id] ?? [] }))
  if (f.kind === 'summary') {
    const all = ids(records, table.id)
    const sums = summaries(records, table, all)
    return all.map((id) => ({ id, value: sums.get(id)?.[f.id] }))
  }
  return all<Row>(
    records.db,
    `SELECT id, ${columnsOf(spec(f))
      .map((c) => quote(c.name))
      .join(', ')} FROM ${quote(table.slug)}`,
  ).map((r) => ({ id: r.id, value: rowVals(records, table, r, {})[f.id] }))
}

// One field's value on these rows, in their order.
export function valuesOf(records: Records, ids: string[], field: string): unknown[] {
  const out: unknown[] = []
  for (const id of ids) {
    const r = rawValues(records, id)
    const f = r ? r.table.fields.find((x) => x.id === field || x.slug === field) : undefined
    out.push(r && f ? r.vals[f.id] : undefined)
  }
  return out
}

// The rows whose field holds one of these values, newest change first (case apart).
export function idsWhere(
  records: Records,
  tableId: string,
  field: string,
  values: string[],
): string[] {
  if (!values.length) return []
  const table = records.mustTable(tableId)
  const f = findField(table, field)
  if (f.kind === 'money' || f.kind === 'summary' || (f.kind === 'relation' && f.many)) return []
  // a tags field holds a list: a row holding any of the values
  const out: string[] = []
  for (let i = 0; i < values.length; i += CHUNK) {
    const part = values.slice(i, i + CHUNK)
    out.push(
      ...all<{ id: string }>(
        records.db,
        f.tags
          ? `SELECT id FROM ${quote(table.slug)} WHERE EXISTS (SELECT 1 FROM json_each(${quote(f.slug)}) WHERE lower(value) IN (${part.map(() => '?').join(', ')})) ORDER BY updated_at DESC`
          : `SELECT id FROM ${quote(table.slug)} WHERE lower(${quote(f.slug)}) IN (${part.map(() => '?').join(', ')}) ORDER BY updated_at DESC`,
        ...part.map((v) => v.toLowerCase()),
      ).map((r) => r.id),
    )
  }
  return out
}

// The row a connection's item landed as, by the item's own id.
export function byKey(records: Records, tableId: string, key: string): string | undefined {
  const table = records.mustTable(tableId)
  return one<{ id: string }>(
    records.db,
    `SELECT id FROM ${quote(table.slug)} WHERE item_key = ?`,
    key,
  )?.id
}

// Each row's item key (none for a row a person or a script added), by row id.
export function itemKeys(records: Records, tableId: string): Map<string, string | null> {
  const table = records.mustTable(tableId)
  return new Map(
    all<{ id: string; item_key: string | null }>(
      records.db,
      `SELECT id, item_key FROM ${quote(table.slug)}`,
    ).map((x) => [x.id, x.item_key]),
  )
}

// Every item key a table holds.
export function keys(records: Records, tableId: string): string[] {
  const table = records.mustTable(tableId)
  return all<{ item_key: string }>(
    records.db,
    `SELECT item_key FROM ${quote(table.slug)} WHERE item_key IS NOT NULL`,
  ).map((r) => r.item_key)
}

// One value's history, newest first: each value it held, with where it came from. A value
// that stayed the same across versions shows once, at the first time it was there.
export function history(
  records: Records,
  id: string,
  slug: string,
): { value: unknown; provenance: Provenance | null }[] {
  const table = tableOf(records, id)
  const r = table ? readRow(records, table, id) : undefined
  if (!table || !r) return []
  const field = table.fields.find((f) => f.slug === slug)?.id
  if (!field) return []
  const current = snapshot(records, table, r)
  const states = [
    ...all<{ vals: string; provenance: string }>(
      records.db,
      'SELECT vals, provenance FROM versions WHERE record_id = ? ORDER BY version',
      id,
    ).map((v) => ({
      value: parse<Record<string, unknown>>(v.vals, {})[field],
      provenance: parse<Record<string, Provenance>>(v.provenance, {})[field] ?? null,
    })),
    { value: current.vals[field], provenance: current.prov[field] ?? null },
  ]
  const out: typeof states = []
  for (const s of states) {
    if (s.value === undefined) continue
    const last = out.at(-1)
    if (last && JSON.stringify(last.value) === JSON.stringify(s.value)) continue
    out.push(s)
  }
  return out.reverse()
}

export function count(records: Records, tableId: string): number {
  const table = records.mustTable(tableId)
  return Number(
    one<{ n: number }>(records.db, `SELECT count(*) AS n FROM ${quote(table.slug)}`)?.n ?? 0,
  )
}

// Whether any of these rows holds a value that is the person's own (gate 2).
export function personsOwn(records: Records, ids: string[]): boolean {
  for (let i = 0; i < ids.length; i += CHUNK) {
    const part = ids.slice(i, i + CHUNK)
    const rows = all<ProvRow>(
      records.db,
      `SELECT * FROM provenance WHERE record_id IN (${part.map(() => '?').join(', ')})`,
      ...part,
    )
    if (rows.some((p) => isPersonsOwn(toProvenance(records, p)))) return true
  }
  return false
}

export function readRow(records: Records, table: Table, id: string): Row | undefined {
  return one<Row>(records.db, `SELECT * FROM ${quote(table.slug)} WHERE id = ?`, id)
}

// A row's values by field id, from its columns and its junction rows. Nothing is a value
// that is not there: a NULL column is left out, as a missing key was in the JSON.
export function rowVals(
  records: Records,
  table: Table,
  row: Row,
  lists: Record<string, string[]> | undefined,
): Record<string, unknown> {
  const vals: Record<string, unknown> = {}
  for (const f of table.fields) {
    if (f.kind === 'relation' && f.many) {
      const l = lists === undefined ? listsOf(records, table, [row.id]).get(row.id) : lists
      if (l?.[f.id]?.length) vals[f.id] = l[f.id]
    } else if (f.kind === 'money') {
      const amount = row[f.slug]
      if (amount !== null && amount !== undefined)
        vals[f.id] = { amount, currency: row[`${f.slug}_currency`] ?? '' }
    } else if (f.tags) {
      const l = parse<string[]>(row[f.slug] as string | null, [])
      if (l.length) vals[f.id] = l
    } else if (row[f.slug] !== null && row[f.slug] !== undefined) vals[f.id] = row[f.slug]
  }
  return vals
}

// The list relations of a table's rows (all of them, or these), by row then field id.
export function listsOf(
  records: Records,
  table: Table,
  ids: string[] | null,
): Map<string, Record<string, string[]>> {
  const out = new Map<string, Record<string, string[]>>()
  for (const f of table.fields) {
    if (!(f.kind === 'relation' && f.many)) continue
    const j = quote(junctionName(table.slug, f.slug))
    const parts: (string[] | null)[] = ids === null ? [null] : []
    if (ids !== null)
      for (let i = 0; i < ids.length; i += CHUNK) parts.push(ids.slice(i, i + CHUNK))
    for (const part of parts) {
      const rows = part
        ? all<{ record_id: string; other_id: string }>(
            records.db,
            `SELECT record_id, other_id FROM ${j} WHERE record_id IN (${part.map(() => '?').join(', ')}) ORDER BY record_id, position`,
            ...part,
          )
        : all<{ record_id: string; other_id: string }>(
            records.db,
            `SELECT record_id, other_id FROM ${j} ORDER BY record_id, position`,
          )
      for (const r of rows) {
        const by = out.get(r.record_id) ?? {}
        const l = by[f.id] ?? []
        l.push(r.other_id)
        by[f.id] = l
        out.set(r.record_id, by)
      }
    }
  }
  return out
}

export function toProvenance(_records: Records, p: ProvRow): Provenance {
  const beside = parse<Provenance['beside']>(p.beside, undefined)
  return {
    kind: p.kind,
    source: parse(p.source, {}),
    ...(p.basis ? { basis: p.basis } : {}),
    at: p.at,
    ...(beside ? { beside } : {}),
  }
}

export function keep(records: Records, out: Map<string, Stored>, p: ProvRow): void {
  const s = out.get(p.record_id) ?? { all: null, own: {} }
  if (p.field_id === '') s.all = toProvenance(records, p)
  else s.own[p.field_id] = toProvenance(records, p)
  out.set(p.record_id, s)
}

export function provenanceOf(records: Records, ids: string[]): Map<string, Stored> {
  const out = new Map<string, Stored>()
  for (let i = 0; i < ids.length; i += CHUNK) {
    const part = ids.slice(i, i + CHUNK)
    for (const p of all<ProvRow>(
      records.db,
      `SELECT * FROM provenance WHERE record_id IN (${part.map(() => '?').join(', ')})`,
      ...part,
    ))
      keep(records, out, p)
  }
  return out
}

export function provenanceOfTable(records: Records, table: Table): Map<string, Stored> {
  const out = new Map<string, Stored>()
  for (const p of all<ProvRow>(
    records.db,
    'SELECT p.* FROM provenance p JOIN records r ON r.id = p.record_id WHERE r.table_id = ?',
    table.id,
  ))
    keep(records, out, p)
  return out
}

// Stored by field id, so a rename keeps every value; read out by the fields' current names.
export function out(
  _records: Records,
  table: Table,
  r: Row,
  vals: Record<string, unknown>,
  prov: Record<string, Provenance>,
  sums?: { vals: Record<string, unknown>; prov: Record<string, Provenance> },
): RecordOut {
  const values: Record<string, unknown> = {}
  const provenance: Record<string, Provenance> = {}
  for (const f of table.fields) {
    const v = f.kind === 'summary' ? sums?.vals : vals
    const p = f.kind === 'summary' ? sums?.prov : prov
    if (v && f.id in v) values[f.slug] = v[f.id]
    if (p && f.id in p && v && f.id in v) provenance[f.slug] = p[f.id] as Provenance
  }
  return {
    id: r.id,
    version: r.version,
    values,
    provenance,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }
}
