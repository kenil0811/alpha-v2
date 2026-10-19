// The model reads the world in SQL through a read-only view per table, on a read-only connection
// whose authorizer lets it read those views and nothing else (design §4, §7: a wall).
import { constants } from 'node:sqlite'
import { all, type Db, one, openDb } from './db.ts'
import { Refused } from './kinds.ts'
import type { Table } from './shape.ts'

export interface QueryResult {
  columns: string[]
  rows: Record<string, unknown>[]
  total: number
  offset: number
}

const quote = (name: string) => `"${name.replace(/"/g, '""')}"`
const lit = (s: string) => `'${s.replace(/'/g, "''")}'`

export class ModelSql {
  private db: Db
  private tables: () => Table[]
  private pageRows: number
  private signature = ''
  private views = new Set<string>()

  constructor(file: string, tables: () => Table[], pageRows: number) {
    this.db = openDb(file, { readOnly: true })
    this.tables = tables
    this.pageRows = pageRows
  }

  // What the model sees: one view per table, named as the table, plus the journal.
  describe(): { view: string; table: string; columns: string[] }[] {
    return [
      ...this.tables().map((t) => ({
        view: t.slug,
        table: t.name,
        columns: ['id', 'added', ...columnsOf(t)],
      })),
      {
        view: 'journal',
        table: 'the journal',
        columns: ['id', 'at', 'actor', 'kind', 'words', 'module'],
      },
    ]
  }

  query(sql: string, offset = 0): QueryResult {
    const text = sql.trim().replace(/;+\s*$/, '')
    if (!text) throw new Refused('There is no query.')
    if (text.includes(';')) throw new Refused('One statement at a time.')
    this.refreshViews()
    this.db.setAuthorizer((action, arg1, _arg2, _db, triggerOrView) => {
      if (action === constants.SQLITE_SELECT || action === constants.SQLITE_RECURSIVE)
        return constants.SQLITE_OK
      if (action === constants.SQLITE_FUNCTION) return constants.SQLITE_OK
      if (action === constants.SQLITE_READ) {
        if (triggerOrView && this.views.has(triggerOrView)) return constants.SQLITE_OK
        if (arg1 && this.views.has(arg1)) return constants.SQLITE_OK
        return constants.SQLITE_DENY
      }
      return constants.SQLITE_DENY
    })
    try {
      const total = Number(
        one<{ n: number }>(this.db, `SELECT count(*) AS n FROM (${text})`)?.n ?? 0,
      )
      const stmt = this.db.prepare(`SELECT * FROM (${text}) LIMIT ? OFFSET ?`)
      const rows = stmt.all(this.pageRows, Math.max(0, Math.trunc(offset))) as Record<
        string,
        unknown
      >[]
      const columns = stmt.columns().map((c) => c.name)
      return { columns, rows, total, offset }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (/not authorized|prohibited|readonly/i.test(msg))
        throw new Refused(
          `The world is read here through its views only: ${this.describe()
            .map((v) => v.view)
            .join(', ')}.`,
        )
      throw new Refused(`The query did not run: ${msg}`)
    } finally {
      this.db.setAuthorizer(null)
    }
  }

  close(): void {
    this.db.close()
  }

  private refreshViews(): void {
    const tables = this.tables()
    const signature = JSON.stringify(
      tables.map((t) => [t.id, t.slug, t.fields.map((f) => [f.id, f.slug, f.kind])]),
    )
    if (signature === this.signature) return
    for (const v of all<{ name: string }>(
      this.db,
      "SELECT name FROM temp.sqlite_master WHERE type = 'view'",
    ))
      this.db.exec(`DROP VIEW temp.${quote(v.name)}`)
    this.views.clear()
    for (const t of tables) {
      const cols = ['id', 'created_at AS added']
      for (const f of t.fields) {
        const path = lit(`$."${f.id}"`)
        if (f.kind === 'money') {
          cols.push(`json_extract(vals, ${lit(`$."${f.id}".amount`)}) AS ${quote(f.slug)}`)
          cols.push(
            `json_extract(vals, ${lit(`$."${f.id}".currency`)}) AS ${quote(`${f.slug}_currency`)}`,
          )
        } else {
          cols.push(`json_extract(vals, ${path}) AS ${quote(f.slug)}`)
        }
      }
      this.db.exec(
        `CREATE TEMP VIEW ${quote(t.slug)} AS SELECT ${cols.join(', ')} FROM main.records WHERE table_id = ${lit(t.id)}`,
      )
      this.views.add(t.slug)
    }
    this.db.exec(
      'CREATE TEMP VIEW journal AS SELECT id, at, actor_kind AS actor, kind, words, module_id AS module FROM main.journal',
    )
    this.views.add('journal')
    this.signature = signature
  }
}

function columnsOf(t: Table): string[] {
  return t.fields.flatMap((f) => (f.kind === 'money' ? [f.slug, `${f.slug}_currency`] : [f.slug]))
}
