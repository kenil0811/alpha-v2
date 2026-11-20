// Every module, table and row has a number, and the numbers down from the top make its address:
// 1.3.4 is the fourth row of the third table of the first module, and 1.2.3.4 the same in module 1's
// second, a module inside it. A module's modules and tables count in one run, so an address never
// reads two ways. A number is given once, by the database as a thing is made, and never given
// again: a table or row that goes leaves a gap, and the rest keep theirs. A module moved into
// another takes the next number there.
import { all, type Db, one } from '../db.ts'

// the next number among a module's modules and tables (`parent` null: the top level's modules)
const next = (parent: string, self: string) =>
  `coalesce((SELECT max(n) FROM (SELECT number AS n FROM modules WHERE parent_id IS ${parent} AND id != ${self} UNION ALL SELECT number FROM tables WHERE module_id IS ${parent} AND id != ${self})), 0) + 1`

const TRIGGERS = `
CREATE TRIGGER IF NOT EXISTS modules_number AFTER INSERT ON modules WHEN NEW.number IS NULL BEGIN
  UPDATE modules SET number = ${next('NEW.parent_id', 'NEW.id')} WHERE id = NEW.id;
END;
CREATE TRIGGER IF NOT EXISTS modules_moved AFTER UPDATE OF parent_id ON modules
WHEN NEW.parent_id IS NOT OLD.parent_id BEGIN
  UPDATE modules SET number = ${next('NEW.parent_id', 'NEW.id')} WHERE id = NEW.id;
END;
CREATE TRIGGER IF NOT EXISTS tables_number AFTER INSERT ON tables WHEN NEW.number IS NULL BEGIN
  UPDATE tables SET number = ${next('NEW.module_id', 'NEW.id')} WHERE id = NEW.id;
END;
CREATE TRIGGER IF NOT EXISTS records_number AFTER INSERT ON records WHEN NEW.number IS NULL BEGIN
  UPDATE records SET number = coalesce((SELECT max(number) FROM records WHERE table_id = NEW.table_id), 0) + 1 WHERE id = NEW.id;
END;
CREATE INDEX IF NOT EXISTS records_numbered ON records (table_id, number);
`

// Migration 7: the columns (a world made from schema.sql has them already), what was there
// numbered in the order it was made, then the triggers that number what comes.
export function numbers(db: Db): void {
  for (const t of ['modules', 'tables', 'records']) {
    const has = all<{ name: string }>(db, `SELECT name FROM pragma_table_info('${t}')`)
    if (!has.some((c) => c.name === 'number')) db.exec(`ALTER TABLE ${t} ADD COLUMN number INTEGER`)
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
  `)
  db.exec(TRIGGERS)
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
