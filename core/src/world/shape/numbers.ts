// Every module, table and row has a number, and the numbers down from the top make its address:
// 1.3.4 is the fourth row of the third table of the first module, and 1.2.3.4 the same in module
// 1's second, a module inside it. A module's modules and tables count in one run, so an address
// never reads two ways. A number is given in code, in the transaction that makes the thing, from a
// counter that only goes up: the top level keeps one for its modules, each module one for what is
// made in it, each table one for its rows. So a number is never given again: what goes leaves a
// gap, Bring back returns a row with its own number, which nothing has had since, and the
// database holds a row's number unique in its table. A module moved into another takes the next
// number there, and its move's journal line says its new address.
import { all, type Db, one, run } from '../db.ts'

const TOP = 'next_module_number' // the top level's counter, in meta

// The next number in a module (its modules and tables), or at the top level (none).
export function nextIn(db: Db, module: string | null): number {
  if (!module) {
    const n = Number(
      one<{ value: string }>(db, 'SELECT value FROM meta WHERE key = ?', TOP)?.value ?? 1,
    )
    run(
      db,
      'INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value',
      TOP,
      String(n + 1),
    )
    return n
  }
  const n =
    one<{ next_number: number }>(db, 'SELECT next_number FROM modules WHERE id = ?', module)
      ?.next_number ?? 1
  run(db, 'UPDATE modules SET next_number = ? WHERE id = ?', n + 1, module)
  return n
}

// The next number for a row of a table.
export function nextRow(db: Db, table: string): number {
  const n =
    one<{ next_row: number }>(db, 'SELECT next_row FROM tables WHERE id = ?', table)?.next_row ?? 1
  run(db, 'UPDATE tables SET next_row = ? WHERE id = ?', n + 1, table)
  return n
}

// Migration 9: the columns (a world made from schema.sql has them already), what was there
// numbered in the order it was made, each counter set past the numbers given, and a row's number
// held unique in its table.
export function numbers(db: Db): void {
  const cols: Record<string, string[]> = {
    modules: ['number', 'next_number'],
    tables: ['number', 'next_row'],
    records: ['number'],
  }
  for (const [t, want] of Object.entries(cols)) {
    const has = all<{ name: string }>(db, `SELECT name FROM pragma_table_info('${t}')`).map(
      (c) => c.name,
    )
    for (const c of want)
      if (!has.includes(c))
        db.exec(
          `ALTER TABLE ${t} ADD COLUMN ${c} INTEGER${c.startsWith('next') ? ' NOT NULL DEFAULT 1' : ''}`,
        )
  }
  db.exec(`
    UPDATE records SET number = x.n FROM (
      SELECT id, row_number() OVER (PARTITION BY table_id ORDER BY seq) AS n FROM records
    ) AS x WHERE x.id = records.id AND records.number IS NULL;
    CREATE TEMP TABLE kids AS
      SELECT id, 'm' AS kind, parent_id AS parent, created_at FROM modules
      UNION ALL SELECT id, 't', module_id, created_at FROM tables;
    CREATE TEMP TABLE kid_numbers AS SELECT id, kind,
      row_number() OVER (PARTITION BY parent ORDER BY created_at, kind, id) AS n FROM kids;
    UPDATE modules SET number = (SELECT n FROM kid_numbers k WHERE k.id = modules.id)
      WHERE number IS NULL;
    UPDATE tables SET number = (SELECT n FROM kid_numbers k WHERE k.id = tables.id)
      WHERE number IS NULL;
    DROP TABLE kids;
    DROP TABLE kid_numbers;
    UPDATE tables SET next_row = coalesce(
      (SELECT max(number) FROM records WHERE records.table_id = tables.id), 0) + 1;
    UPDATE modules SET next_number = coalesce((SELECT max(n) FROM (
      SELECT number AS n FROM modules AS m WHERE m.parent_id = modules.id
      UNION ALL SELECT number FROM tables WHERE tables.module_id = modules.id)), 0) + 1;
    INSERT INTO meta (key, value) VALUES ('${TOP}',
      coalesce((SELECT max(number) FROM modules WHERE parent_id IS NULL), 0) + 1)
      ON CONFLICT (key) DO UPDATE SET value = excluded.value;
    CREATE UNIQUE INDEX IF NOT EXISTS records_number ON records (table_id, number)
      WHERE number IS NOT NULL;
  `)
}

// A module's address: its number after its parents'.
export function moduleNumber(db: Db, id: string): string | null {
  const parts: number[] = []
  for (let at: string | null = id, seen = 0; at && seen < 32; seen++) {
    const m: { number: number | null; parent_id: string | null } | undefined = one(
      db,
      'SELECT number, parent_id FROM modules WHERE id = ?',
      at,
    )
    if (!m || m.number === null) return null
    parts.unshift(m.number)
    at = m.parent_id
  }
  return parts.join('.')
}

export function tableNumber(db: Db, id: string): string | null {
  const t = one<{ number: number | null; module_id: string }>(
    db,
    'SELECT number, module_id FROM tables WHERE id = ?',
    id,
  )
  const m = t ? moduleNumber(db, t.module_id) : null
  return m && t?.number ? `${m}.${t.number}` : null
}

export function rowNumber(db: Db, id: string): string | null {
  const r = one<{ number: number | null; table_id: string }>(
    db,
    'SELECT number, table_id FROM records WHERE id = ?',
    id,
  )
  const t = r ? tableNumber(db, r.table_id) : null
  return t && r?.number ? `${t}.${r.number}` : null
}

export type Numbered =
  | { kind: 'module'; id: string }
  | { kind: 'table'; id: string }
  | { kind: 'row'; id: string; table: string }

// What an address names, read down from the top: modules, then a table, then a row of it.
export function atNumber(db: Db, address: string): Numbered | null {
  const ns = address.split('.').map(Number)
  if (!ns.length || ns.some((n) => !Number.isInteger(n) || n < 1)) return null
  let at = null as Numbered | null
  for (const n of ns) {
    if (at?.kind === 'row') return null
    if (at?.kind === 'table') {
      const r: { id: string } | undefined = one(
        db,
        'SELECT id FROM records WHERE table_id = ? AND number = ?',
        at.id,
        n,
      )
      if (!r) return null
      at = { kind: 'row', id: r.id, table: at.id }
      continue
    }
    const parent: string | null = at?.id ?? null
    const m: { id: string } | undefined = one(
      db,
      'SELECT id FROM modules WHERE parent_id IS ? AND number = ?',
      parent,
      n,
    )
    const t: { id: string } | undefined = parent
      ? one(db, 'SELECT id FROM tables WHERE module_id = ? AND number = ?', parent, n)
      : undefined
    if (m) at = { kind: 'module', id: m.id }
    else if (t) at = { kind: 'table', id: t.id }
    else return null
  }
  return at
}
