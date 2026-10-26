// The trash (design §4, core step 1, Kenil 26 Oct): a removed row leaves its table at once, so no
// reader anywhere has to learn to skip it, and its whole state waits in `removed_rows` for
// keep_removed_days: its values by field id, their provenance, its versions, its files, its kit
// row, and the rows that pointed at it. Bring back puts it back with the same id; the daily work
// deletes it for good after that. Removing its table deletes its trash with it.
import { all, json, one, parse, run, tx } from '../db.ts'
import { junctionName, lit, quote } from '../ddl.ts'
import { append } from '../journal.ts'
import { Refused } from '../kinds.ts'
import type { Shape, Table, WriteCtx } from '../shape/index.ts'
import type { Records } from './records.ts'
import { columnValues, index, setLists } from './storing.ts'
import type { Row, Snapshot } from './types.ts'
import { CHUNK } from './types.ts'

type Raw = Record<string, unknown>

// A row that pointed at a removed one: its table, field and id, and its place in a list.
export interface Pointer {
  table: string
  field: string
  record: string
  position: number | null
}

export interface Kept {
  meta: { version: number; made_by: string; created_at: string; updated_at: string }
  itemKey: string | null
  vals: Record<string, unknown> // by field id, list relations as lists of row ids
  names: Record<string, string> // each field's name when it went, to say which were left out
  provenance: Raw[]
  versions: Raw[]
  files: Raw[]
  kit: Raw | null
  pointers: Pointer[]
}

// A row's whole state, read before anything of it is cleared.
export function keep(records: Records, table: Table, row: Row): Omit<Kept, 'pointers'> {
  const id = row.id
  return {
    meta: {
      version: Number(row.version),
      made_by: String(row.made_by),
      created_at: String(row.created_at),
      updated_at: String(row.updated_at),
    },
    itemKey: (row.item_key as string | null) ?? null,
    vals: records.rowVals(table, row, undefined),
    names: Object.fromEntries(table.fields.map((f) => [f.id, f.name])),
    provenance: all(records.db, 'SELECT * FROM provenance WHERE record_id = ?', id),
    versions: all(records.db, 'SELECT * FROM versions WHERE record_id = ?', id),
    files: all(records.db, 'SELECT * FROM row_files WHERE record_id = ?', id),
    kit: one(records.db, 'SELECT * FROM kit_rows WHERE record_id = ?', id) ?? null,
  }
}

// The rows of every table pointing at these, by the one they point at; read before they let go.
export function pointersTo(shape: Shape, tableId: string, ids: string[]): Map<string, Pointer[]> {
  const out = new Map<string, Pointer[]>()
  const add = (to: string, p: Pointer) => out.set(to, [...(out.get(to) ?? []), p])
  for (const t of shape.tables())
    for (const f of t.fields) {
      if (f.kind !== 'relation' || f.relatesTo !== tableId) continue
      for (let i = 0; i < ids.length; i += CHUNK) {
        const set = `(${ids
          .slice(i, i + CHUNK)
          .map(lit)
          .join(', ')})`
        if (f.many)
          for (const r of all<{ record_id: string; other_id: string; position: number }>(
            shape.db,
            `SELECT record_id, other_id, position FROM ${quote(junctionName(t.slug, f.slug))} WHERE other_id IN ${set}`,
          ))
            add(r.other_id, { table: t.id, field: f.id, record: r.record_id, position: r.position })
        else
          for (const r of all<{ id: string; to: string }>(
            shape.db,
            `SELECT id, ${quote(f.slug)} AS "to" FROM ${quote(t.slug)} WHERE ${quote(f.slug)} IN ${set}`,
          ))
            add(r.to, { table: t.id, field: f.id, record: r.id, position: null })
      }
    }
  return out
}

// Rows taken out of their table, in the caller's transaction: their whole state read first, then
// the rows pointing at them let go, then the rows and everything of theirs deleted. The caller
// journals it and puts the kept states in the trash under that line.
export function takeOut(
  records: Records,
  table: Table,
  ids: string[],
  ctx: WriteCtx,
): {
  gone: { id: string; values: Record<string, unknown> }[]
  cleared: number
  kept: Map<string, Kept>
} {
  const pointers = pointersTo(records.shape, table.id, ids)
  const kept = new Map<string, Kept>()
  for (const id of ids) {
    const row = records.readRow(table, id)
    if (!row) throw new Refused(`${table.name} has no row ${id}.`)
    kept.set(id, { ...keep(records, table, row), pointers: pointers.get(id) ?? [] })
  }
  let cleared = 0
  for (let i = 0; i < ids.length; i += CHUNK)
    cleared += records.shape.clearPointers(
      table.id,
      `(${ids
        .slice(i, i + CHUNK)
        .map(lit)
        .join(', ')})`,
    )
  for (const id of ids) {
    const k = kept.get(id) as Kept
    records.watch?.gone([id])
    // a kit's setup row the person removes stays removed through the kit's updates
    if (k.itemKey && k.kit) records.shape.tombstone(table.module.id, 'row', k.itemKey, ctx)
    for (const f of table.fields)
      if (f.kind === 'relation' && f.many)
        run(
          records.db,
          `DELETE FROM ${quote(junctionName(table.slug, f.slug))} WHERE record_id = ?`,
          id,
        )
    records.unindex(id)
    for (const side of ['versions', 'provenance', 'row_files', 'kit_rows'])
      run(records.db, `DELETE FROM ${side} WHERE record_id = ?`, id)
    run(records.db, `DELETE FROM ${quote(table.slug)} WHERE id = ?`, id)
    run(records.db, 'DELETE FROM records WHERE id = ?', id)
  }
  return { gone: ids.map((id) => ({ id, values: kept.get(id)?.vals ?? {} })), cleared, kept }
}

// The versions a write kept, tied to the journal line that wrote it, with what it wrote: the
// values a revert puts back, and only where they are still what it wrote.
export function tagVersions(
  records: Records,
  kept: [string, number, Snapshot][],
  lineId: number,
): void {
  for (const [id, version, wrote] of kept)
    run(
      records.db,
      'UPDATE versions SET line_id = ?, wrote = ? WHERE record_id = ? AND version = ?',
      lineId,
      json(wrote),
      id,
      version,
    )
}

export function putInTrash(
  records: Records,
  table: Table,
  id: string,
  kept: Kept,
  line: { id: number; at: string },
): void {
  run(
    records.db,
    'INSERT OR REPLACE INTO removed_rows (record_id, table_id, line_id, removed_at, state) VALUES (?, ?, ?, ?, ?)',
    id,
    table.id,
    line.id,
    line.at,
    json(kept),
  )
}

// The rows a removal put in the trash, still there, with when.
export function inTrash(
  records: Records,
  lineId: number,
): { id: string; table: string; at: string }[] {
  return all<{ record_id: string; table_id: string; removed_at: string }>(
    records.db,
    'SELECT record_id, table_id, removed_at FROM removed_rows WHERE line_id = ? ORDER BY rowid',
    lineId,
  ).map((r) => ({ id: r.record_id, table: r.table_id, at: r.removed_at }))
}

// Put rows back from the trash, with the same ids, inside the caller's transaction. A field
// removed since is left out and named; links go back only where the row that held one is still
// there and still points nowhere. Returns what came back, by table, and what was left out.
export function bringBack(
  records: Records,
  ids: string[],
): { back: Map<string, string[]>; leftOut: string[] } {
  const back = new Map<string, string[]>()
  const leftOut = new Set<string>()
  const exists = (id: string) => !!one(records.db, 'SELECT 1 FROM records WHERE id = ?', id)
  const rows = ids.flatMap((id) => {
    const r = one<{ table_id: string; state: string }>(
      records.db,
      'SELECT table_id, state FROM removed_rows WHERE record_id = ?',
      id,
    )
    const table = r ? records.shape.table(r.table_id) : undefined
    return r && table ? [{ id, table, kept: parse<Kept>(r.state, {} as Kept) }] : []
  })
  // every row first, so links between rows coming back together hold
  for (const { id, table, kept } of rows) {
    if (exists(id)) continue
    run(
      records.db,
      'INSERT INTO records (id, table_id, created_at, seq) VALUES (?, ?, ?, (SELECT coalesce(max(seq), 0) + 1 FROM records))',
      id,
      table.id,
      kept.meta.created_at,
    )
    const cols = ['id', 'version', 'made_by', 'created_at', 'updated_at', 'item_key']
    const args: unknown[] = [
      id,
      kept.meta.version,
      kept.meta.made_by,
      kept.meta.created_at,
      kept.meta.updated_at,
      kept.itemKey,
    ]
    for (const [fid, v] of Object.entries(kept.vals)) {
      const f = table.fields.find((x) => x.id === fid)
      if (!f) {
        leftOut.add(kept.names[fid] ?? 'a field removed since')
        continue
      }
      if (f.kind === 'relation' && f.many) continue
      for (const [col, cv] of columnValues(records, f, v)) {
        cols.push(quote(col))
        args.push(cv)
      }
    }
    run(
      records.db,
      `INSERT INTO ${quote(table.slug)} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`,
      ...(args as (string | number | null)[]),
    )
    back.set(table.id, [...(back.get(table.id) ?? []), id])
  }
  for (const { id, table, kept } of rows) {
    if (!back.get(table.id)?.includes(id)) continue
    const fields = new Set(table.fields.map((f) => f.id))
    // its own links, to rows that are there now
    const vals: Record<string, unknown> = {}
    for (const f of table.fields) {
      if (!(f.id in kept.vals)) continue
      const v = kept.vals[f.id]
      if (f.kind === 'relation' && f.many)
        vals[f.id] = (v as string[]).filter((other) => exists(other))
      else if (f.kind === 'relation' && typeof v === 'string' && !exists(v)) {
        run(records.db, `UPDATE ${quote(table.slug)} SET ${quote(f.slug)} = NULL WHERE id = ?`, id)
      }
    }
    setLists(records, table, id, vals)
    for (const p of kept.provenance)
      if (p.field_id === '' || fields.has(String(p.field_id)))
        run(
          records.db,
          'INSERT OR REPLACE INTO provenance (record_id, field_id, kind, source, basis, at, beside) VALUES (?, ?, ?, ?, ?, ?, ?)',
          id,
          String(p.field_id),
          String(p.kind),
          String(p.source),
          (p.basis as string | null) ?? null,
          String(p.at),
          (p.beside as string | null) ?? null,
        )
    for (const v of kept.versions)
      run(
        records.db,
        'INSERT OR IGNORE INTO versions (record_id, version, vals, provenance, replaced_at, replaced_by, line_id, wrote) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        id,
        Number(v.version),
        String(v.vals),
        String(v.provenance),
        String(v.replaced_at),
        String(v.replaced_by),
        (v.line_id as number | null) ?? null,
        (v.wrote as string | null) ?? null,
      )
    for (const fl of kept.files)
      if (one(records.db, 'SELECT 1 FROM files WHERE hash = ?', String(fl.file_hash)))
        run(
          records.db,
          'INSERT OR IGNORE INTO row_files (record_id, file_hash, kind, placed_by, placed_at) VALUES (?, ?, ?, ?, ?)',
          id,
          String(fl.file_hash),
          (fl.kind as string | null) ?? null,
          String(fl.placed_by),
          String(fl.placed_at),
        )
    if (kept.kit) {
      run(
        records.db,
        'INSERT OR IGNORE INTO kit_rows (record_id, installed_hash) VALUES (?, ?)',
        id,
        String(kept.kit.installed_hash),
      )
      // a kit's setup row brought back is the kit's again: its update no longer skips it
      if (kept.itemKey)
        run(
          records.db,
          "DELETE FROM tombstones WHERE module_id = ? AND kind = 'row' AND key = ?",
          table.module.id,
          kept.itemKey,
        )
    }
    // the rows that pointed at it point at it again, where they still point nowhere
    for (const p of kept.pointers) {
      const t = records.shape.table(p.table)
      const f = t?.fields.find((x) => x.id === p.field)
      if (!t || !f || !exists(p.record)) continue
      if (f.many)
        run(
          records.db,
          `INSERT OR IGNORE INTO ${quote(junctionName(t.slug, f.slug))} (record_id, other_id, position) VALUES (?, ?, ?)`,
          p.record,
          id,
          p.position ?? 0,
        )
      else
        run(
          records.db,
          `UPDATE ${quote(t.slug)} SET ${quote(f.slug)} = ? WHERE id = ? AND ${quote(f.slug)} IS NULL`,
          id,
          p.record,
        )
    }
    const row = records.readRow(table, id)
    if (row) index(records, table, id, records.rowVals(table, row, undefined), true)
    run(records.db, 'DELETE FROM removed_rows WHERE record_id = ?', id)
  }
  return { back, leftOut: [...leftOut] }
}

// Rows kept longer than `days`, deleted for good in one transaction, with a line saying how many
// and from when; nothing is written when none are. Returns how many went.
export function expire(records: Records, days: number, at = new Date()): number {
  const before = new Date(at.getTime() - days * 86_400_000).toISOString()
  return tx(records.db, () => {
    const r = one<{ n: number; oldest: string | null }>(
      records.db,
      'SELECT count(*) AS n, min(removed_at) AS oldest FROM removed_rows WHERE removed_at < ?',
      before,
    )
    const count = Number(r?.n ?? 0)
    if (!count) return 0
    run(records.db, 'DELETE FROM removed_rows WHERE removed_at < ?', before)
    append(records.db, {
      actor: { kind: 'system' },
      kind: 'expired',
      words: `Deleted for good ${count === 1 ? 'a row' : `${count} rows`} removed more than ${days} days ago, the oldest on ${new Date(r?.oldest ?? before).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}.`,
      data: { rows: count, before },
    })
    return count
  })
}
