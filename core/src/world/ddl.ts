// Real tables (Kenil, 22 Oct: "real tables, switch now"). A kit table is a SQLite
// table named by its slug, STRICT, with a typed column per field named by the field's slug; a
// money field takes an amount and a currency column; a list relation (many) is a junction table
// `<table>__<field>` of (record_id, other_id, position). Provenance and versions sit in two
// generic tables beside them, and `records` stays as the registry of which table a row is in.
// Pointers between rows are kept whole by Alpha's own writes in the same transaction, not by
// SQL foreign keys, so a shape change never fights a cascade. The DDL lives here, shared by the
// shape store and by the migration that made the switch.
import type { FieldKind } from './kinds.ts'

export const quote = (name: string) => `"${name.replace(/"/g, '""')}"`
export const lit = (s: string) => `'${s.replace(/'/g, "''")}'`

// The columns every kit table has before its fields; a field's slug never takes one of these.
export const OWN_COLUMNS = new Set([
  'id',
  'version',
  'made_by',
  'created_at',
  'updated_at',
  'item_key',
  'rowid',
  'oid',
  '_rowid_',
])

export interface ColumnSpec {
  id: string // the field's id: index names rest on it, so a rename moves nothing
  slug: string
  kind: FieldKind
  many: boolean // a relation holding a list: a junction table instead of a column
  indexed: boolean // the kit asked for an index on it (a relation column always has one)
}

export function sqlType(kind: FieldKind): 'TEXT' | 'REAL' {
  return kind === 'number' || kind === 'money' ? 'REAL' : 'TEXT'
}

// The columns a field takes: none for a list relation or a summary, two for money, else one
// (a choice holding several keeps them as a JSON list in its one column).
export function columnsOf(f: ColumnSpec): { name: string; type: 'TEXT' | 'REAL' }[] {
  if ((f.kind === 'relation' && f.many) || f.kind === 'summary') return []
  if (f.kind === 'money')
    return [
      { name: f.slug, type: 'REAL' },
      { name: `${f.slug}_currency`, type: 'TEXT' },
    ]
  return [{ name: f.slug, type: sqlType(f.kind) }]
}

export function junctionName(tableSlug: string, fieldSlug: string): string {
  return `${tableSlug}__${fieldSlug}`
}

// Indexes are named by ids, so renaming a table or a field moves nothing.
export const indexName = (tableId: string, what: string) => `idx_${tableId}_${what}`

export function junctionSql(tableSlug: string, f: ColumnSpec, tableId: string): string[] {
  const j = quote(junctionName(tableSlug, f.slug))
  return [
    `CREATE TABLE ${j} (record_id TEXT NOT NULL, other_id TEXT NOT NULL, position INTEGER NOT NULL, PRIMARY KEY (record_id, other_id)) STRICT`,
    `CREATE INDEX ${quote(indexName(tableId, `${f.id}_other`))} ON ${j} (other_id)`,
  ]
}

// A field's own statements on an existing table: its columns, or its junction table; a relation
// column is indexed, as the rows pointing at one are asked for often.
export function addFieldSql(tableSlug: string, tableId: string, f: ColumnSpec): string[] {
  if (f.kind === 'relation' && f.many) return junctionSql(tableSlug, f, tableId)
  const t = quote(tableSlug)
  const out = columnsOf(f).map((c) => `ALTER TABLE ${t} ADD COLUMN ${quote(c.name)} ${c.type}`)
  if (f.kind === 'relation' || f.indexed)
    out.push(`CREATE INDEX ${quote(indexName(tableId, f.id))} ON ${t} (${quote(f.slug)})`)
  return out
}

export function dropFieldSql(tableSlug: string, tableId: string, f: ColumnSpec): string[] {
  if (f.kind === 'relation' && f.many)
    return [`DROP TABLE IF EXISTS ${quote(junctionName(tableSlug, f.slug))}`]
  const t = quote(tableSlug)
  const out: string[] = []
  if (f.kind === 'relation' || f.indexed)
    out.push(`DROP INDEX IF EXISTS ${quote(indexName(tableId, f.id))}`)
  for (const c of columnsOf(f)) out.push(`ALTER TABLE ${t} DROP COLUMN ${quote(c.name)}`)
  return out
}

// A whole table: its own columns, a column per field, its indexes and its junction tables.
export function createTableSql(tableSlug: string, tableId: string, fields: ColumnSpec[]): string[] {
  const t = quote(tableSlug)
  const cols = [
    'id TEXT PRIMARY KEY',
    'version INTEGER NOT NULL DEFAULT 1',
    'made_by TEXT NOT NULL',
    'created_at TEXT NOT NULL',
    'updated_at TEXT NOT NULL',
    'item_key TEXT',
    ...fields.flatMap((f) => columnsOf(f).map((c) => `${quote(c.name)} ${c.type}`)),
  ]
  const out = [
    `CREATE TABLE ${t} (${cols.join(', ')}) STRICT`,
    `CREATE INDEX ${quote(indexName(tableId, 'created'))} ON ${t} (created_at)`,
    `CREATE UNIQUE INDEX ${quote(indexName(tableId, 'item'))} ON ${t} (item_key) WHERE item_key IS NOT NULL`,
  ]
  for (const f of fields) {
    if (f.kind === 'relation' && f.many) out.push(...junctionSql(tableSlug, f, tableId))
    else if (f.kind === 'relation' || f.indexed)
      out.push(`CREATE INDEX ${quote(indexName(tableId, f.id))} ON ${t} (${quote(f.slug)})`)
  }
  return out
}

export function dropTableSql(tableSlug: string, fields: ColumnSpec[]): string[] {
  return [
    ...fields
      .filter((f) => f.kind === 'relation' && f.many)
      .map((f) => `DROP TABLE IF EXISTS ${quote(junctionName(tableSlug, f.slug))}`),
    `DROP TABLE ${quote(tableSlug)}`,
  ]
}
