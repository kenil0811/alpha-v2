// Migration 13 (Kenil, 22 Oct: real tables, switch now): every kit table's rows leave the JSON
// in `records` for a real table of their own, their provenance for the `provenance` table and
// their versions for `versions`; `records` stays as the registry of which table a row is in.
// Runs inside the backup every migration gets. A relation that holds a list anywhere becomes a
// list relation (a junction table). Values that do not fit their column (a number in a text
// field) are left out rather than cast, and a pointer at a row that is gone is cleared.
import { all, type Db, json, one, parse, run } from './db.ts'
import {
  type ColumnSpec,
  columnsOf,
  createTableSql,
  junctionName,
  lit,
  OWN_COLUMNS,
  quote,
} from './ddl.ts'
import type { FieldKind } from './kinds.ts'
import { MODEL_VIEWS } from './modelsql.ts'

interface FieldRow {
  id: string
  table_id: string
  slug: string
  kind: FieldKind
  options: string
}

export function toRealTables(db: Db): void {
  db.exec(`
    CREATE TABLE provenance (
      record_id TEXT NOT NULL REFERENCES records (id),
      field_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      source TEXT NOT NULL,
      basis TEXT,
      at TEXT NOT NULL,
      beside TEXT,
      PRIMARY KEY (record_id, field_id)
    ) STRICT;
    ALTER TABLE record_versions RENAME TO versions;
  `)
  const tables = all<{ id: string; slug: string }>(db, 'SELECT id, slug FROM tables')
  const slugOf = new Map<string, string>()
  const taken = (name: string) =>
    (MODEL_VIEWS as readonly string[]).includes(name) ||
    [...slugOf.values()].includes(name) ||
    !!one(db, 'SELECT 1 FROM sqlite_master WHERE name = ?', name)
  const specsOf = new Map<string, (ColumnSpec & { relatesTo: string | null })[]>()
  // names first: a slug the file already uses (a table called Views) gets a longer one
  for (const t of tables) {
    let slug = t.slug
    while (taken(slug)) slug = `${slug}_table`
    if (slug !== t.slug) run(db, 'UPDATE tables SET slug = ? WHERE id = ?', slug, t.id)
    slugOf.set(t.id, slug)
  }
  for (const t of tables) {
    const fields = all<FieldRow>(
      db,
      'SELECT id, table_id, slug, kind, options FROM fields WHERE table_id = ? ORDER BY position',
      t.id,
    )
    const used = new Set<string>(OWN_COLUMNS)
    const specs: (ColumnSpec & { relatesTo: string | null })[] = []
    for (const f of fields) {
      const o = parse<{ many?: boolean; relatesTo?: string }>(f.options, {})
      let many = !!o.many
      if (f.kind === 'relation' && !many) {
        const n = one<{ n: number }>(
          db,
          "SELECT count(*) AS n FROM records WHERE table_id = ? AND json_type(vals, ?) = 'array'",
          t.id,
          `$."${f.id}"`,
        )
        if (Number(n?.n ?? 0) > 0) {
          many = true
          run(db, 'UPDATE fields SET options = ? WHERE id = ?', json({ ...o, many: true }), f.id)
        }
      }
      // a field whose slug is a column every table has, or another field's currency column
      let slug = f.slug
      const names = (s: string) =>
        columnsOf({ id: f.id, slug: s, kind: f.kind, many, indexed: false }).map((c) => c.name)
      while (names(slug).some((n) => used.has(n))) slug = `${slug}_field`
      if (slug !== f.slug) run(db, 'UPDATE fields SET slug = ? WHERE id = ?', slug, f.id)
      for (const n of names(slug)) used.add(n)
      specs.push({
        id: f.id,
        slug,
        kind: f.kind,
        many,
        indexed: false,
        relatesTo: o.relatesTo ?? null,
      })
    }
    specsOf.set(t.id, specs)
  }
  for (const t of tables) {
    const slug = slugOf.get(t.id) as string
    const specs = specsOf.get(t.id) as (ColumnSpec & { relatesTo: string | null })[]
    for (const sql of createTableSql(slug, t.id, specs)) db.exec(sql)
    const cols: string[] = []
    const exprs: string[] = []
    for (const f of specs) {
      if (f.kind === 'relation' && f.many) continue
      const path = (sub = '') => lit(`$."${f.id}"${sub}`)
      if (f.kind === 'money') {
        cols.push(quote(f.slug), quote(`${f.slug}_currency`))
        exprs.push(
          `CASE WHEN json_type(vals, ${path('.amount')}) IN ('integer', 'real') THEN json_extract(vals, ${path('.amount')}) END`,
          `CASE WHEN json_type(vals, ${path('.currency')}) = 'text' THEN json_extract(vals, ${path('.currency')}) END`,
        )
      } else if (f.kind === 'number') {
        cols.push(quote(f.slug))
        exprs.push(
          `CASE WHEN json_type(vals, ${path()}) IN ('integer', 'real') THEN json_extract(vals, ${path()}) END`,
        )
      } else {
        cols.push(quote(f.slug))
        exprs.push(
          `CASE WHEN json_type(vals, ${path()}) = 'text' THEN json_extract(vals, ${path()}) END`,
        )
      }
    }
    db.exec(
      `INSERT INTO ${quote(slug)} (id, version, made_by, created_at, updated_at, item_key${cols.map((c) => `, ${c}`).join('')})
       SELECT id, version, made_by, created_at, updated_at, item_key${exprs.map((e) => `, ${e}`).join('')}
       FROM records WHERE table_id = ${lit(t.id)}`,
    )
    for (const f of specs) {
      if (!(f.kind === 'relation' && f.many)) continue
      const j = quote(junctionName(slug, f.slug))
      const path = lit(`$."${f.id}"`)
      db.exec(
        `INSERT OR IGNORE INTO ${j} (record_id, other_id, position)
         SELECT r.id, j.value, j.key FROM records r, json_each(r.vals, ${path}) j
         WHERE r.table_id = ${lit(t.id)} AND json_type(r.vals, ${path}) = 'array' AND j.type = 'text'`,
      )
      db.exec(
        `INSERT OR IGNORE INTO ${j} (record_id, other_id, position)
         SELECT r.id, json_extract(r.vals, ${path}), 0 FROM records r
         WHERE r.table_id = ${lit(t.id)} AND json_type(r.vals, ${path}) = 'text'`,
      )
    }
    db.exec(
      `INSERT OR IGNORE INTO provenance (record_id, field_id, kind, source, basis, at, beside)
       SELECT r.id, j.key, json_extract(j.value, '$.kind'), coalesce(json_extract(j.value, '$.source'), '{}'),
         json_extract(j.value, '$.basis'), coalesce(json_extract(j.value, '$.at'), r.updated_at),
         json_extract(j.value, '$.beside')
       FROM records r, json_each(r.provenance) j
       WHERE r.table_id = ${lit(t.id)} AND json_type(j.value, '$.kind') = 'text'
         AND j.key IN (SELECT id FROM fields WHERE table_id = ${lit(t.id)})`,
    )
  }
  // a pointer at a row that is gone is cleared, as a removal clears it from now on
  for (const t of tables) {
    const slug = slugOf.get(t.id) as string
    for (const f of specsOf.get(t.id) ?? []) {
      if (f.kind !== 'relation') continue
      const other = f.relatesTo ? slugOf.get(f.relatesTo) : undefined
      if (f.many) {
        const j = quote(junctionName(slug, f.slug))
        if (other)
          db.exec(`DELETE FROM ${j} WHERE other_id NOT IN (SELECT id FROM ${quote(other)})`)
        else db.exec(`DELETE FROM ${j}`)
      } else if (other) {
        db.exec(
          `UPDATE ${quote(slug)} SET ${quote(f.slug)} = NULL WHERE ${quote(f.slug)} IS NOT NULL AND ${quote(f.slug)} NOT IN (SELECT id FROM ${quote(other)})`,
        )
      } else db.exec(`UPDATE ${quote(slug)} SET ${quote(f.slug)} = NULL`)
    }
  }
  db.exec('DROP INDEX IF EXISTS records_item')
  for (const c of ['vals', 'provenance', 'version', 'made_by', 'updated_at', 'item_key'])
    db.exec(`ALTER TABLE records DROP COLUMN ${c}`)
}

// Migration 15: a row whose values all came the same way keeps one provenance for all of them
// (field id ''), the rest a row per field; a field's provenance is its own row, else the row's.
export function foldProvenance(db: Db): void {
  db.exec(`
    INSERT INTO provenance (record_id, field_id, kind, source, basis, at, beside)
      SELECT record_id, '', kind, source, basis, at, beside FROM provenance
      WHERE field_id != '' AND record_id IN (
        SELECT record_id FROM provenance WHERE field_id != '' GROUP BY record_id
        HAVING count(DISTINCT kind || '|' || source || '|' || coalesce(basis, '') || '|' || at || '|' || coalesce(beside, '')) = 1
          )
      GROUP BY record_id;
    DELETE FROM provenance WHERE field_id != ''
      AND record_id IN (SELECT record_id FROM provenance WHERE field_id = '');
  `)
}

// Migration 14: each row gets a number that never changes (not its rowid, which a VACUUM may
// renumber), and its full-text entry moves under it, where a change or a removal finds it at
// once instead of reading the whole index. And a value that is not there has no provenance:
// the rows migration 13 kept for a value it left out, or a pointer it cleared, go.
export function addSeq(db: Db): void {
  for (const t of all<{ id: string; slug: string }>(db, 'SELECT id, slug FROM tables')) {
    for (const f of all<FieldRow>(
      db,
      'SELECT id, table_id, slug, kind, options FROM fields WHERE table_id = ?',
      t.id,
    )) {
      const o = parse<{ many?: boolean }>(f.options, {})
      if (f.kind === 'relation' && o.many)
        db.exec(
          `DELETE FROM provenance WHERE field_id = ${lit(f.id)} AND NOT EXISTS (SELECT 1 FROM ${quote(junctionName(t.slug, f.slug))} j WHERE j.record_id = provenance.record_id)`,
        )
      else
        db.exec(
          `DELETE FROM provenance WHERE field_id = ${lit(f.id)} AND record_id IN (SELECT id FROM ${quote(t.slug)} WHERE ${quote(f.slug)} IS NULL)`,
        )
    }
  }
  db.exec(`
    ALTER TABLE records ADD COLUMN seq INTEGER;
    UPDATE records SET seq = rowid;
    CREATE UNIQUE INDEX records_seq ON records (seq);
    CREATE TEMP TABLE fts_was AS SELECT record_id, table_id, words FROM records_fts;
    DELETE FROM records_fts;
    INSERT INTO records_fts (rowid, record_id, table_id, words)
      SELECT r.seq, w.record_id, w.table_id, w.words FROM fts_was w JOIN records r ON r.id = w.record_id;
    DROP TABLE fts_was;
  `)
}
