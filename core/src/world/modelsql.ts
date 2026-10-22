// The model reads the world in SQL through a read-only view per table, on a read-only connection
// whose authorizer lets it read those views and nothing else (design §4, §7: a wall). Since the
// tables are real (22 Oct) a table's view is thin: its id, when it was added, and its fields'
// columns, without the row's own bookkeeping; a list relation shows as a junction view.
import { constants } from 'node:sqlite'
import { all, type Db, one, openDb } from './db.ts'
import { junctionName, quote } from './ddl.ts'
import { Refused } from './kinds.ts'
import type { Table } from './shape.ts'

export interface QueryResult {
  columns: string[]
  rows: Record<string, unknown>[]
  total: number
  offset: number
}

// The names the model's own views take: no kit table may take one.
export const MODEL_VIEWS = [
  'provenance',
  'journal',
  'tasks',
  'people',
  'companies',
  'exchanges',
  'people_at',
  'people_at_lines',
  'people_up',
] as const

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

  // What the model sees: one view per table, named as the table, a view per list relation,
  // provenance, the journal, tasks and people.
  describe(): { view: string; table: string; columns: string[] }[] {
    return [
      ...this.tables().flatMap((t) => [
        {
          view: t.slug,
          table: t.name,
          columns: ['id', 'added', ...columnsOf(t)],
        },
        ...t.fields
          .filter((f) => f.kind === 'relation' && f.many)
          .map((f) => ({
            view: junctionName(t.slug, f.slug),
            table: `${t.name}: the rows each one's ${f.name} points at`,
            columns: ['record_id', 'other_id', 'position'],
          })),
      ]),
      {
        view: 'provenance',
        table: 'where every value came from (a row per value: its record, field, kind, source, at)',
        columns: ['record_id', 'table_id', 'field', 'kind', 'source', 'basis', 'at'],
      },
      {
        view: 'journal',
        table: 'the journal',
        columns: ['id', 'at', 'actor', 'kind', 'words', 'module'],
      },
      ...PEOPLE_VIEWS,
    ]
  }

  query(sql: string, offset = 0): QueryResult {
    const text = sql.trim().replace(/;+\s*$/, '')
    if (!text) throw new Refused('There is no query.')
    if (text.includes(';')) throw new Refused('One statement at a time.')
    // the one name the world's own views use for a table expression is the world's alone
    if (/alpha_up_/i.test(text)) throw new Refused('That name is taken by the world’s own views.')
    this.refreshViews()
    this.db.setAuthorizer((action, arg1, column, db, triggerOrView) => {
      if (action === constants.SQLITE_SELECT || action === constants.SQLITE_RECURSIVE)
        return constants.SQLITE_OK
      if (action === constants.SQLITE_FUNCTION) return constants.SQLITE_OK
      if (action === constants.SQLITE_READ) {
        // a read a view's own SQL makes, a temp view by name, or SQLite's JSON tables; never a
        // column of a table of the file itself, even under a view's name (main.deals). A read
        // with no column (count(*) over a view) carries no value and passes under the view's name.
        if (triggerOrView && (this.views.has(triggerOrView) || triggerOrView === 'alpha_up_'))
          return constants.SQLITE_OK
        if (arg1 === 'json_each' || arg1 === 'json_tree') return constants.SQLITE_OK
        if (arg1 && this.views.has(arg1) && (db === 'temp' || column === ''))
          return constants.SQLITE_OK
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
      tables.map((t) => [t.id, t.slug, t.fields.map((f) => [f.id, f.slug, f.kind, f.many])]),
    )
    if (signature === this.signature) return
    for (const v of all<{ name: string }>(
      this.db,
      "SELECT name FROM temp.sqlite_master WHERE type = 'view'",
    ))
      this.db.exec(`DROP VIEW temp.${quote(v.name)}`)
    this.views.clear()
    for (const t of tables) {
      const cols = ['id', 'created_at AS added', ...columnsOf(t).map(quote)]
      this.db.exec(
        `CREATE TEMP VIEW ${quote(t.slug)} AS SELECT ${cols.join(', ')} FROM main.${quote(t.slug)}`,
      )
      this.views.add(t.slug)
      for (const f of t.fields) {
        if (!(f.kind === 'relation' && f.many)) continue
        const j = junctionName(t.slug, f.slug)
        this.db.exec(
          `CREATE TEMP VIEW ${quote(j)} AS SELECT record_id, other_id, position FROM main.${quote(j)}`,
        )
        this.views.add(j)
      }
    }
    this.db.exec(
      `CREATE TEMP VIEW provenance AS SELECT p.record_id, r.table_id, f.slug AS field, p.kind,
         p.source, p.basis, p.at FROM main.provenance p JOIN main.records r ON r.id = p.record_id
         JOIN main.fields f ON f.id = p.field_id
           OR (p.field_id = '' AND f.table_id = r.table_id AND NOT EXISTS
             (SELECT 1 FROM main.provenance o WHERE o.record_id = p.record_id AND o.field_id = f.id))`,
    )
    this.views.add('provenance')
    this.db.exec(
      'CREATE TEMP VIEW journal AS SELECT id, at, actor_kind AS actor, kind, words, module_id AS module FROM main.journal',
    )
    this.views.add('journal')
    for (const [name, sql] of PEOPLE_SQL) {
      this.db.exec(`CREATE TEMP VIEW ${name} AS ${sql}`)
      this.views.add(name)
    }
    this.signature = signature
  }
}

function columnsOf(t: Table): string[] {
  return t.fields.flatMap((f) =>
    f.kind === 'money'
      ? [f.slug, `${f.slug}_currency`]
      : f.kind === 'relation' && f.many
        ? []
        : [f.slug],
  )
}

// People and companies as the model reads them (design §4): each as one, through merges.
const PEOPLE_VIEWS = [
  {
    view: 'tasks',
    table: 'tasks: one list of all work, each on the place it concerns',
    columns: [
      'id',
      'title',
      'state',
      'due',
      'remind_at',
      'repeat',
      'priority',
      'owner',
      'module',
      'table_name',
      'row',
      'field',
      'page',
      'parent',
      'notes',
      'touches',
      'made_by',
      'added',
      'done_at',
    ],
  },
  {
    view: 'people',
    table: 'people',
    columns: ['id', 'name', 'emails', 'phones', 'profile', 'companies', 'added'],
  },
  { view: 'companies', table: 'companies', columns: ['id', 'name', 'domains', 'people', 'added'] },
  {
    view: 'people_at',
    table: 'who works where, ended ones kept',
    columns: ['person', 'person_name', 'company', 'company_name', 'title', 'since', 'ended'],
  },
  {
    view: 'exchanges',
    table:
      "each message or meeting with someone (started_by: you or them; row and view: the message's or event's row)",
    columns: ['person', 'name', 'channel', 'at', 'started_by', 'address', 'row', 'view'],
  },
]

const keyList = (key: string) =>
  `(SELECT group_concat(k.value, ', ') FROM main.people_keys k JOIN people_up u ON u.id = k.person_id
    WHERE u.root = p.id AND k.key = '${key}')`

const PEOPLE_SQL: [string, string][] = [
  [
    'tasks',
    `SELECT k.id, k.title,
       CASE k.state WHEN 'todo' THEN 'To do' WHEN 'doing' THEN 'In progress' WHEN 'waiting' THEN 'Waiting'
         WHEN 'done' THEN 'Done' ELSE 'Dropped' END AS state,
       k.due, k.remind_at, k.repeat, k.priority,
       CASE k.owner_kind WHEN 'alpha' THEN 'Alpha'
         WHEN 'agent' THEN (SELECT a.name FROM main.agents a WHERE a.id = k.owner_id)
         ELSE 'the person' END AS owner,
       (SELECT m.name FROM main.modules m WHERE m.id = k.module_id) AS module,
       (SELECT t.name FROM main.tables t WHERE t.id = k.table_id) AS table_name,
       k.record_id AS row,
       (SELECT f.name FROM main.fields f WHERE f.id = k.field_id) AS field,
       k.page, k.parent_id AS parent, k.notes,
       (SELECT group_concat(r.kind || ':' || r.ref, ', ') FROM main.task_refs r WHERE r.task_id = k.id)
         AS touches,
       k.made_by, k.created_at AS added, k.done_at
     FROM main.tasks k`,
  ],
  [
    'people_up',
    `WITH RECURSIVE alpha_up_ (id, root) AS (
       SELECT id, id FROM main.people WHERE merged_into IS NULL
       UNION ALL SELECT x.id, alpha_up_.root FROM main.people x JOIN alpha_up_ ON x.merged_into = alpha_up_.id
     ) SELECT id, root FROM alpha_up_`,
  ],
  [
    'people_at_lines',
    `SELECT a.root AS person, b.root AS company, l.title, min(l.started_at) AS since,
       CASE WHEN sum(l.ended_at IS NULL) > 0 THEN NULL ELSE max(l.ended_at) END AS ended
     FROM main.people_links l JOIN people_up a ON a.id = l.person_id
       JOIN people_up b ON b.id = l.company_id
     GROUP BY a.root, b.root, l.title`,
  ],
  [
    'people_at',
    // a line with no title says nothing a titled line at the same company doesn't
    `SELECT g.person, pp.name AS person_name, g.company, cc.name AS company_name, g.title, g.since,
       g.ended
     FROM people_at_lines g JOIN main.people pp ON pp.id = g.person
       JOIN main.people cc ON cc.id = g.company
     WHERE g.title IS NOT NULL OR NOT EXISTS (
       SELECT 1 FROM people_at_lines h
       WHERE h.person = g.person AND h.company = g.company AND h.title IS NOT NULL)`,
  ],
  [
    'people',
    `SELECT p.id, p.name, ${keyList('email')} AS emails, ${keyList('phone')} AS phones,
       ${keyList('profile')} AS profile,
       (SELECT group_concat(DISTINCT w.company_name) FROM people_at w
         WHERE w.person = p.id AND w.ended IS NULL) AS companies,
       p.created_at AS added
     FROM main.people p WHERE p.merged_into IS NULL AND p.kind = 'person'`,
  ],
  [
    'companies',
    `SELECT p.id, p.name, ${keyList('domain')} AS domains,
       (SELECT count(DISTINCT w.person) FROM people_at w WHERE w.company = p.id AND w.ended IS NULL)
         AS people,
       p.created_at AS added
     FROM main.people p WHERE p.merged_into IS NULL AND p.kind = 'company'`,
  ],
  [
    'exchanges',
    `SELECT u.root AS person, p.name, e.channel, e.at, e.started_by, e.value AS address,
       e.record_id AS row, t.slug AS view
     FROM main.exchanges e JOIN main.people_keys k ON k.key = e.key AND k.value = e.value
       JOIN people_up u ON u.id = k.person_id JOIN main.people p ON p.id = u.root
       JOIN main.records r ON r.id = e.record_id JOIN main.tables t ON t.id = r.table_id`,
  ],
]
