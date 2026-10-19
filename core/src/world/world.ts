// One tenant's world: the SQLite file and what lives beside it (design §3, §4). Every write is a
// function of the world that writes its journal line in the same transaction.
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync } from 'node:fs'
import { userInfo } from 'node:os'
import { join } from 'node:path'
import { Cards } from './cards.ts'
import { all, type Db, newId, now, one, openDb, run, tx } from './db.ts'
import { Files } from './files.ts'
import { type Actor, append, type Line, type LineInput, lastId, lines, read } from './journal.ts'
import { ModelSql } from './modelsql.ts'
import { Records } from './records.ts'
import { migrate } from './schema.ts'
import { Shape } from './shape.ts'

export interface User {
  id: string
  name: string
  role: 'owner' | 'member'
}

export interface DeskSession {
  user: string
  sessionId: string
  tools: string
  seenJournalId: number
}

export interface Hit {
  what: 'journal' | 'record' | 'document'
  id: string
  words: string
  where: string
}

export interface TenantPaths {
  dir: string
  world: string
  files: string
  modules: string
  desks: string
  instructions: string
  backups: string
}

export function tenantPaths(dir: string): TenantPaths {
  return {
    dir,
    world: join(dir, 'world.sqlite'),
    files: join(dir, 'files'),
    modules: join(dir, 'modules'),
    desks: join(dir, 'desk'),
    instructions: join(dir, 'instructions'),
    backups: join(dir, 'backups'),
  }
}

export class World {
  readonly shape: Shape
  readonly records: Records
  readonly cards: Cards
  readonly files: Files
  readonly db: Db
  readonly paths: TenantPaths
  readonly tenant: string
  private pageRows: number
  private modelSql: ModelSql | null = null

  private constructor(db: Db, paths: TenantPaths, tenant: string, pageRows: number) {
    this.db = db
    this.paths = paths
    this.tenant = tenant
    this.pageRows = pageRows
    this.shape = new Shape(db, paths.modules)
    this.cards = new Cards(db)
    this.files = new Files(db, paths.files)
    this.records = new Records(db, this.shape, (f) => this.files.findFile(f)?.hash)
  }

  static async open(dir: string, options: { pageRows?: number } = {}): Promise<World> {
    const paths = tenantPaths(dir)
    for (const d of [paths.dir, paths.files, paths.modules, paths.desks, paths.instructions])
      mkdirSync(d, { recursive: true })
    const db = openDb(paths.world)
    await migrate(db, paths.world, paths.backups)
    const tenant = dir.split('/').filter(Boolean).pop() as string
    return new World(db, paths, tenant, options.pageRows ?? 500)
  }

  get sql(): ModelSql {
    this.modelSql ??= new ModelSql(this.paths.world, () => this.shape.tables(), this.pageRows)
    return this.modelSql
  }

  // A journal line on its own (a sentence said, a reply, a step); writes add theirs themselves.
  line(input: LineInput): Line {
    return tx(this.db, () => append(this.db, input))
  }

  lines(where: Parameters<typeof lines>[1]): Line[] {
    return lines(this.db, where)
  }

  lineById(id: number): Line | undefined {
    return read(this.db, id)
  }

  lastLineId(): number {
    return lastId(this.db)
  }

  users(): User[] {
    return all<User>(this.db, 'SELECT id, name, role FROM users ORDER BY created_at')
  }

  user(id: string): User | undefined {
    return one<User>(this.db, 'SELECT id, name, role FROM users WHERE id = ?', id)
  }

  // The first start makes the owner; a single person on their own Mac is that owner.
  owner(name?: string): User {
    return tx(this.db, () => {
      const found = one<User>(
        this.db,
        "SELECT id, name, role FROM users WHERE role = 'owner' ORDER BY created_at",
      )
      if (found) return found
      const id = newId('u')
      const who = name?.trim() || fullName()
      run(
        this.db,
        "INSERT INTO users (id, name, role, created_at) VALUES (?, ?, 'owner', ?)",
        id,
        who,
        now(),
      )
      append(this.db, {
        actor: { kind: 'system' },
        kind: 'joined',
        words: `${who} owns this world.`,
        user: id,
      })
      return { id, name: who, role: 'owner' }
    })
  }

  deskDir(user: string): string {
    const d = join(this.paths.desks, user)
    mkdirSync(d, { recursive: true })
    return d
  }

  desk(user: string): DeskSession | undefined {
    const r = one<{ user_id: string; session_id: string; tools: string; seen_journal_id: number }>(
      this.db,
      'SELECT user_id, session_id, tools, seen_journal_id FROM desk_sessions WHERE user_id = ?',
      user,
    )
    return r
      ? {
          user: r.user_id,
          sessionId: r.session_id,
          tools: r.tools,
          seenJournalId: r.seen_journal_id,
        }
      : undefined
  }

  keepDesk(user: string, sessionId: string, tools: string, actor: Actor): void {
    tx(this.db, () => {
      const known = this.desk(user)
      if (known?.sessionId === sessionId) return
      run(
        this.db,
        `INSERT INTO desk_sessions (user_id, session_id, tools, seen_journal_id, started_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT (user_id) DO UPDATE SET session_id = excluded.session_id, tools = excluded.tools,
           started_at = excluded.started_at`,
        user,
        sessionId,
        tools,
        known?.seenJournalId ?? 0,
        now(),
      )
      append(this.db, {
        actor,
        kind: 'session',
        words: known ? 'Started a fresh desk session.' : 'Started the desk session.',
        data: { session: sessionId, tools },
        user,
      })
    })
  }

  forgetDesk(user: string): void {
    run(this.db, 'DELETE FROM desk_sessions WHERE user_id = ?', user)
  }

  markSeen(user: string, journalId: number): void {
    run(
      this.db,
      'UPDATE desk_sessions SET seen_journal_id = ?, last_turn_at = ? WHERE user_id = ?',
      journalId,
      now(),
      user,
    )
  }

  // Modules and tables with their row counts: the map in the start layer.
  map(): {
    module: string
    notes: string
    tables: { name: string; view: string; rows: number; fields: string[] }[]
  }[] {
    return this.shape.modules().map((m) => ({
      module: m.name,
      notes: join(m.dir, 'NOTES.md'),
      tables: this.shape.tables(m.id).map((t) => ({
        name: t.name,
        view: t.slug,
        rows: this.records.count(t.id),
        fields: t.fields.map((f) => `${f.name} (${f.kind})`),
      })),
    }))
  }

  // Full-text over the journal, records and documents, best first.
  search(words: string, limit = 20): Hit[] {
    const q = ftsQuery(words)
    if (!q) return []
    const hits: (Hit & { rank: number })[] = []
    for (const r of all<{ id: number; words: string; kind: string; rank: number }>(
      this.db,
      `SELECT j.id, j.words, j.kind, bm25(journal_fts) AS rank FROM journal_fts
       JOIN journal j ON j.id = journal_fts.rowid WHERE journal_fts MATCH ? ORDER BY rank LIMIT ?`,
      q,
      limit,
    ))
      hits.push({ what: 'journal', id: String(r.id), words: r.words, where: r.kind, rank: r.rank })
    for (const r of all<{ record_id: string; table_id: string; words: string; rank: number }>(
      this.db,
      `SELECT record_id, table_id, words, bm25(records_fts) AS rank FROM records_fts
       WHERE records_fts MATCH ? ORDER BY rank LIMIT ?`,
      q,
      limit,
    ))
      hits.push({
        what: 'record',
        id: r.record_id,
        words: r.words,
        where: this.shape.table(r.table_id)?.name ?? '',
        rank: r.rank,
      })
    for (const r of all<{
      document_id: string
      position: string
      words: string
      title: string
      rank: number
    }>(
      this.db,
      `SELECT c.document_id, c.position, c.words, d.title, bm25(chunks_fts) AS rank FROM chunks_fts
       JOIN chunks c ON c.id = chunks_fts.rowid JOIN documents d ON d.id = c.document_id
       WHERE chunks_fts MATCH ? ORDER BY rank LIMIT ?`,
      q,
      limit,
    ))
      hits.push({
        what: 'document',
        id: r.document_id,
        words: r.words,
        where: `${r.title} ${r.position}`,
        rank: r.rank,
      })
    return hits
      .sort((a, b) => a.rank - b.rank)
      .slice(0, limit)
      .map(({ rank: _rank, ...h }) => h)
  }

  close(): void {
    this.modelSql?.close()
    this.db.close()
  }
}

// The Mac's own name for its user ("Kenil Shah"), else the account name.
function fullName(): string {
  if (process.platform === 'darwin') {
    try {
      const n = execFileSync('/usr/bin/id', ['-F'], { encoding: 'utf8' }).trim()
      if (n) return n
    } catch {
      // the account name below
    }
  }
  return userInfo().username
}

// The person's words as an FTS5 query: each word quoted, any of them.
export function ftsQuery(words: string): string {
  const tokens = words
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((t) => t.length > 1)
  return [...new Set(tokens)].map((t) => `"${t}"`).join(' OR ')
}

// The tenant on this machine: single-tenant in features, a tenant id on every path.
export function tenantDir(home: string): string {
  const tenants = join(home, 'tenants')
  mkdirSync(tenants, { recursive: true })
  const found = readdirSync(tenants, { withFileTypes: true }).find(
    (d) =>
      d.isDirectory() &&
      d.name.startsWith('t_') &&
      existsSync(join(tenants, d.name, 'world.sqlite')),
  )
  return join(tenants, found ? found.name : newId('t'))
}
