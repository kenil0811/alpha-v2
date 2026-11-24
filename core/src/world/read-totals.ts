// What each connection's reads brought, kept as running totals: by table, what they met, added,
// changed, found the same, passed over and left out on the never-use list, and how many reads it
// had and how many failed. Added to as each read ends (connectors/service.ts); What Alpha read reads
// them (api/read-report.ts). They go with their connection.
import type { Tally } from '../connectors/tally.ts'
import { all, type Db, one, run, tx } from './db.ts'

export interface ReadTotal {
  tbl: string // a table's id, or 'files'
  name: string
  read: number
  added: number
  changed: number
  same: number
  skipped: number
  leftOut: number
}

// One read ended: its counts added to its connection's, and the read counted.
export function addRead(db: Db, connection: string, tally: Tally, failed: boolean): void {
  tx(db, () => {
    for (const [tbl, c] of Object.entries(tally))
      run(
        db,
        `INSERT INTO read_totals (connection_id, tbl, name, read, added, changed, same, skipped, left_out)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (connection_id, tbl) DO UPDATE SET name = excluded.name,
           read = read + excluded.read, added = added + excluded.added,
           changed = changed + excluded.changed, same = same + excluded.same,
           skipped = skipped + excluded.skipped, left_out = left_out + excluded.left_out`,
        connection,
        tbl,
        c.name,
        c.read,
        c.added,
        c.changed,
        c.same,
        c.skipped,
        c.leftOut,
      )
    run(
      db,
      'UPDATE connections SET reads = reads + 1, reads_failed = reads_failed + ? WHERE id = ?',
      failed ? 1 : 0,
      connection,
    )
  })
}

export function totalsOf(db: Db, connection: string): ReadTotal[] {
  return all<{
    tbl: string
    name: string
    read: number
    added: number
    changed: number
    same: number
    skipped: number
    left_out: number
  }>(db, 'SELECT * FROM read_totals WHERE connection_id = ? ORDER BY rowid', connection).map(
    (r) => ({
      tbl: r.tbl,
      name: r.name,
      read: r.read,
      added: r.added,
      changed: r.changed,
      same: r.same,
      skipped: r.skipped,
      leftOut: r.left_out,
    }),
  )
}

export function readsOf(db: Db, connection: string): { reads: number; failed: number } {
  const r = one<{ reads: number; reads_failed: number }>(
    db,
    'SELECT reads, reads_failed FROM connections WHERE id = ?',
    connection,
  )
  return { reads: r?.reads ?? 0, failed: r?.reads_failed ?? 0 }
}
