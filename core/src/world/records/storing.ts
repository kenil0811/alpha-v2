// Storing rows: a row's values checked and typed for its columns, inserted or updated with its
// lists and provenance, the version it had kept, its words in the index, and what a change is
// described as in the journal.
import { json, run } from '../db.ts'
import { junctionName, quote } from '../ddl.ts'
import {
  checkTags,
  checkValue,
  type Provenance,
  type ProvenanceInput,
  provenanceFor,
  Refused,
  type Said,
  valueWords,
} from '../kinds.ts'
import { type Field, findField, type Table } from '../shape/index.ts'
import { provenanceOf, rowVals } from './reading.ts'
import type { Records } from './records.ts'
import type { Row, Snapshot } from './types.ts'
import { resolve, same } from './types.ts'

export function snapshot(records: Records, table: Table, row: Row): Snapshot {
  const vals = rowVals(records, table, row, undefined)
  return { vals, prov: resolve(provenanceOf(records, [row.id]).get(row.id), vals) }
}

export function keepVersion(
  records: Records,
  row: Row,
  was: Snapshot,
  at: string,
  by: string,
): void {
  run(
    records.db,
    'INSERT INTO versions (record_id, version, vals, provenance, replaced_at, replaced_by) VALUES (?, ?, ?, ?, ?, ?)',
    row.id,
    row.version,
    json(was.vals),
    json(was.prov),
    at,
    by,
  )
}

// A field's value as its columns hold it.
export function columnValues(_records: Records, f: Field, value: unknown): [string, unknown][] {
  if (f.kind === 'money') {
    const m = value as { amount: number; currency: string } | null
    return [
      [f.slug, m ? m.amount : null],
      [`${f.slug}_currency`, m ? m.currency : null],
    ]
  }
  if (f.tags) return [[f.slug, Array.isArray(value) && value.length ? json(value) : null]]
  return [[f.slug, value ?? null]]
}

export function setLists(
  records: Records,
  table: Table,
  id: string,
  vals: Record<string, unknown>,
): void {
  for (const f of table.fields) {
    if (!(f.kind === 'relation' && f.many) || !(f.id in vals)) continue
    const j = quote(junctionName(table.slug, f.slug))
    run(records.db, `DELETE FROM ${j} WHERE record_id = ?`, id)
    const others = (vals[f.id] as string[] | null) ?? []
    others.forEach((other, i) => {
      run(
        records.db,
        `INSERT OR IGNORE INTO ${j} (record_id, other_id, position) VALUES (?, ?, ?)`,
        id,
        other,
        i,
      )
    })
  }
}

export function putProvenance(records: Records, id: string, field: string, p: Provenance): void {
  run(
    records.db,
    `INSERT INTO provenance (record_id, field_id, kind, source, basis, at, beside)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (record_id, field_id) DO UPDATE SET kind = excluded.kind, source = excluded.source,
       basis = excluded.basis, at = excluded.at, beside = excluded.beside`,
    id,
    field,
    p.kind,
    json(p.source),
    p.basis ?? null,
    p.at,
    p.beside ? json(p.beside) : null,
  )
}

// A fresh row whose values all came the same way keeps one provenance for all of them; on a
// row already there, a field's provenance is written only where it differs from the row's.
export function setProvenance(
  records: Records,
  id: string,
  prov: Record<string, Provenance>,
  fresh: boolean,
): void {
  const entries = Object.entries(prov)
  if (!entries.length) return
  if (fresh) {
    const first = entries[0]?.[1] as Provenance
    if (entries.every(([, p]) => same(p, first))) {
      putProvenance(records, id, '', first)
      return
    }
    for (const [field, p] of entries) putProvenance(records, id, field, p)
    return
  }
  const stored = provenanceOf(records, [id]).get(id) ?? { all: null, own: {} }
  for (const [field, p] of entries) {
    if (stored.all && same(p, stored.all))
      run(records.db, 'DELETE FROM provenance WHERE record_id = ? AND field_id = ?', id, field)
    else putProvenance(records, id, field, p)
  }
}

export function insert(
  records: Records,
  table: Table,
  id: string,
  vals: Record<string, unknown>,
  prov: Record<string, Provenance>,
  at: string,
  by: string,
  itemKey: string | null,
): void {
  // its place in the registry: a number that never changes, under which its words are indexed
  run(
    records.db,
    'INSERT INTO records (id, table_id, created_at, seq) VALUES (?, ?, ?, (SELECT coalesce(max(seq), 0) + 1 FROM records))',
    id,
    table.id,
    at,
  )
  const cols: string[] = ['id', 'version', 'made_by', 'created_at', 'updated_at', 'item_key']
  const args: unknown[] = [id, 1, by, at, at, itemKey]
  for (const f of table.fields) {
    if (!(f.id in vals) || (f.kind === 'relation' && f.many)) continue
    for (const [col, v] of columnValues(records, f, vals[f.id])) {
      cols.push(quote(col))
      args.push(v)
    }
  }
  run(
    records.db,
    `INSERT INTO ${quote(table.slug)} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`,
    ...(args as (string | number | null)[]),
  )
  setLists(records, table, id, vals)
  setProvenance(records, id, prov, true)
  index(records, table, id, vals, true)
}

// Columns given in `vals` change; the version goes up; the row's time is now.
export function update(
  records: Records,
  table: Table,
  id: string,
  vals: Record<string, unknown>,
  prov: Record<string, Provenance>,
  at: string,
): void {
  const sets: string[] = ['version = version + 1', 'updated_at = ?']
  const args: unknown[] = [at]
  for (const f of table.fields) {
    if (!(f.id in vals) || (f.kind === 'relation' && f.many)) continue
    for (const [col, v] of columnValues(records, f, vals[f.id])) {
      sets.push(`${quote(col)} = ?`)
      args.push(v)
    }
  }
  args.push(id)
  run(
    records.db,
    `UPDATE ${quote(table.slug)} SET ${sets.join(', ')} WHERE id = ?`,
    ...(args as (string | number | null)[]),
  )
  setLists(records, table, id, vals)
  setProvenance(records, id, prov, false)
  for (const [field, v] of Object.entries(vals))
    if (v === null)
      run(records.db, 'DELETE FROM provenance WHERE record_id = ? AND field_id = ?', id, field)
}

export function prepare(
  records: Records,
  table: Table,
  values: Record<string, unknown>,
  rowProv: ProvenanceInput,
  perField: Record<string, ProvenanceInput> | undefined,
  said: Said | null,
  at: string,
  byKey = false, // code's values, by the lasting keys of its fields (rules M5)
): Snapshot {
  if (!values || typeof values !== 'object' || !Object.keys(values).length)
    throw new Refused('A row needs values.')
  const vals: Record<string, unknown> = {}
  const prov: Record<string, Provenance> = {}
  for (const [name, value] of Object.entries(values)) {
    const f = findField(table, name, byKey)
    let v = f.tags
      ? checkTags(f.name, value, f.choices)
      : checkValue(f.kind, f.name, value, f.choices)
    if (f.kind === 'relation' && v !== null) {
      // a list relation takes a list; one row's relation takes one row
      if (f.many) v = Array.isArray(v) ? v : [v]
      else if (Array.isArray(v)) {
        if (v.length > 1) throw new Refused(`${f.name} holds one row, not ${v.length}.`)
        v = v[0] ?? null
      }
      // each a row of the table it points at, whoever sets it: never one not there
      for (const id of (Array.isArray(v) ? v : [v]) as unknown[])
        if (id !== null && records.tableOf(String(id))?.id !== f.relatesTo)
          throw new Refused(
            `${f.name} points at a row of ${records.shape.table(f.relatesTo ?? '')?.name ?? 'a table removed since'} that is not there.`,
          )
    }
    if (f.kind === 'person' && typeof v === 'string' && records.personOf) v = records.personOf(v)
    vals[f.id] = v
    // nothing is a value that is not there: a null clears the column and carries no provenance
    if (v === null) continue
    const own = perField
      ? Object.entries(perField).find(([k]) => findField(table, k, byKey).id === f.id)?.[1]
      : undefined
    const p = own ?? rowProv
    if (!p)
      throw new Refused(
        `${f.name} needs its provenance: stated, looked up, estimated, assumed or computed.`,
      )
    const made = provenanceFor(p, said, at)
    if (made.source.file !== undefined) {
      const hash = records.fileOf(made.source.file)
      if (!hash) throw new Refused(`There is no file called ${made.source.file}.`)
      made.source.file = hash
    }
    prov[f.id] = made
  }
  return { vals, prov }
}

// A row's words in full-text search, under the registry row's sequence number (not its rowid,
// which a VACUUM may renumber), so a change or a removal finds the one entry at once (a search
// by record_id reads the whole index: 200,000 rows took over an hour to add that way).
export function index(
  records: Records,
  table: Table,
  id: string,
  vals: Record<string, unknown>,
  fresh = false,
): void {
  if (!fresh) unindex(records, id)
  const words = [table.name, ...Object.values(vals).map(valueWords)].filter(Boolean).join(' ')
  run(
    records.db,
    'INSERT INTO records_fts (rowid, record_id, table_id, words) VALUES ((SELECT seq FROM records WHERE id = ?), ?, ?, ?)',
    id,
    id,
    table.id,
    words,
  )
}

export function unindex(records: Records, id: string): void {
  run(
    records.db,
    'DELETE FROM records_fts WHERE rowid = (SELECT seq FROM records WHERE id = ?)',
    id,
  )
}

export function describe(_records: Records, table: Table, values: Record<string, unknown>): string {
  return Object.entries(values)
    .map(([k, v]) => `${findField(table, k).name} ${valueWords(v)}`)
    .join(', ')
}

export function describeStored(
  _records: Records,
  table: Table,
  vals: Record<string, unknown>,
): string {
  return Object.entries(vals)
    .map(([id, v]) => `${table.fields.find((f) => f.id === id)?.name ?? id} ${valueWords(v)}`)
    .join(', ')
}
