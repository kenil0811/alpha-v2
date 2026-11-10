// One tenant's world: the SQLite file and what lives beside it. Every write is a
// function of the world that writes its journal line in the same transaction.

import { existsSync, mkdirSync, readdirSync } from 'node:fs'
import { userInfo } from 'node:os'
import { join } from 'node:path'
import { config } from '../config.ts'
import { Accounts } from './accounts.ts'
import { AgentAsks } from './agents/asks.ts'
import { Agents, CHIEF } from './agents/index.ts'
import { Memories } from './agents/memory.ts'
import { Cards } from './cards.ts'
import { Connections } from './connections.ts'
import { all, type Db, newId, now, one, openDb, run, tx } from './db.ts'
import { type FileOut, Files } from './files.ts'
import {
  type Actor,
  append,
  keepOut,
  type Line,
  type LineInput,
  lastId,
  lines,
  read,
} from './journal.ts'
import { Refused } from './kinds.ts'
import { askMaintainer } from './maintained.ts'
import { ModelSql } from './modelsql.ts'
import { People } from './people/index.ts'
import { FOLD_PICK, foldPeople, pickFolded, unfoldPeople } from './records/fold.ts'
import { Records } from './records/index.ts'
import { Rules } from './rules.ts'
import { migrate } from './schema.ts'
import { actorName, rowName, Shape, type Table, type WriteCtx } from './shape/index.ts'
import { type Place, placeOf } from './shape/parts.ts'
import { peopleTables } from './shape/per.ts'
import { Spend } from './spend.ts'
import { Tasks } from './tasks/index.ts'
import { Views } from './views.ts'

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

// A file on a row: a deal's CIM, a client's export.
export interface RowFile {
  file: FileOut
  record: string
  table: string
  kind: string | null
  placedBy: string
  placedAt: string
  document: string | null // its document when it has been read
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
  agents: string
  instructions: string
  backups: string
  envs: string // per Mac, beside the tenants: Docling's environment
}

export function tenantPaths(dir: string): TenantPaths {
  return {
    dir,
    world: join(dir, 'world.sqlite'),
    files: join(dir, 'files'),
    modules: join(dir, 'modules'),
    desks: join(dir, 'desk'),
    agents: join(dir, 'agents'),
    instructions: join(dir, 'instructions'),
    backups: join(dir, 'backups'),
    envs: join(dir, '..', '..', 'envs'),
  }
}

export class World {
  readonly shape: Shape
  readonly records: Records
  readonly cards: Cards
  readonly views: Views
  readonly files: Files
  readonly connections: Connections
  readonly rules: Rules
  readonly spend: Spend
  readonly agents: Agents
  readonly memories: Memories
  readonly asks: AgentAsks
  readonly people: People
  readonly tasks: Tasks
  readonly accounts: Accounts
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
    this.views = new Views(db, this.shape)
    this.files = new Files(db, paths.files)
    this.records = new Records(db, this.shape, (f) => this.files.findFile(f)?.hash)
    this.connections = new Connections(db)
    this.rules = new Rules(db, this.shape)
    this.spend = new Spend(db)
    this.agents = new Agents(db, paths.agents)
    this.memories = new Memories(db, () => config.limits().memory_characters)
    this.asks = new AgentAsks(db)
    this.people = new People(db, this.shape, this.cards)
    this.records.watch = this.people
    this.people.records = this.records
    this.records.personOf = (said) => this.people.ref(said)
    // one row per person, and the fold of a merge
    this.records.peopleRoot = (id) => this.people.root(id)
    this.records.personName = (id) => this.people.names([id])[id] ?? 'them'
    this.records.ask = (card) => this.cards.open(card)
    this.people.onMerge = (keep, other, names, ctx) =>
      foldPeople(this.records, keep, other, names, ctx)
    this.people.onUnmerge = (id, ctx) => unfoldPeople(this.records, id, ctx)
    this.cards.onAnswered = (card, answer, by) => {
      if (card.call?.tool === FOLD_PICK) pickFolded(this.records, card, answer, by)
    }
    this.tasks = new Tasks(db, this.shape, (id) => this.user(id)?.name ?? null)
    this.accounts = new Accounts(db)
    this.shape.onGone = (ids) => this.people.gone(ids)
    this.shape.asks = (module, redo, ctx) => askMaintainer(this, module, redo, ctx)
  }

  static async open(dir: string, options: { pageRows?: number } = {}): Promise<World> {
    const paths = tenantPaths(dir)
    for (const d of [
      paths.dir,
      paths.files,
      paths.modules,
      paths.desks,
      paths.agents,
      paths.instructions,
    ])
      mkdirSync(d, { recursive: true })
    const db = openDb(paths.world)
    await migrate(db, paths.world, paths.backups)
    const tenant = dir.split('/').filter(Boolean).pop() as string
    const world = new World(db, paths, tenant, options.pageRows ?? 500)
    const drift = world.shape.check()
    if (drift.length)
      throw new Error(
        `This world's tables do not match its catalogue (${drift.join('; ')}). Restore a backup, or send Kenil a report.`,
      )
    // people read again when this Alpha reads them by newer rules
    world.people.keepRules({ actor: { kind: 'system' } })
    return world
  }

  get sql(): ModelSql {
    this.modelSql ??= new ModelSql(
      this.paths.world,
      () => this.shape.tables(),
      this.pageRows,
      () => peopleTables(this.shape),
    )
    return this.modelSql
  }

  // A journal line on its own (a sentence said, a reply, a step); writes add theirs themselves.
  line(input: LineInput): Line {
    return tx(this.db, () => append(this.db, input))
  }

  // A secret the person signed in with: never in a line from now on.
  keepOut(secret: string): void {
    keepOut(secret)
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

  // A person's preference in the window (their Appearance): theirs, kept with them.
  preference(user: string, key: string): string | null {
    return (
      one<{ value: string }>(
        this.db,
        'SELECT value FROM preferences WHERE user_id = ? AND key = ?',
        user,
        key,
      )?.value ?? null
    )
  }

  setPreference(user: string, key: string, value: string | null): void {
    if (value === null)
      run(this.db, 'DELETE FROM preferences WHERE user_id = ? AND key = ?', user, key)
    else
      run(
        this.db,
        'INSERT INTO preferences (user_id, key, value) VALUES (?, ?, ?) ON CONFLICT (user_id, key) DO UPDATE SET value = excluded.value',
        user,
        key,
        value,
      )
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

  deskDir(user: string, agent = CHIEF): string {
    const d =
      agent === CHIEF ? join(this.paths.desks, user) : join(this.paths.desks, user, 'agents', agent)
    mkdirSync(d, { recursive: true })
    return d
  }

  desk(user: string, agent = CHIEF): DeskSession | undefined {
    const r = one<{ user_id: string; session_id: string; tools: string; seen_journal_id: number }>(
      this.db,
      'SELECT user_id, session_id, tools, seen_journal_id FROM desk_sessions WHERE user_id = ? AND agent_id = ?',
      user,
      agent,
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

  keepDesk(user: string, sessionId: string, tools: string, actor: Actor, agent = CHIEF): void {
    tx(this.db, () => {
      const known = this.desk(user, agent)
      if (known?.sessionId === sessionId) return
      run(
        this.db,
        `INSERT INTO desk_sessions (user_id, agent_id, session_id, tools, seen_journal_id, started_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT (user_id, agent_id) DO UPDATE SET session_id = excluded.session_id, tools = excluded.tools,
           started_at = excluded.started_at`,
        user,
        agent,
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
        agent: agent === CHIEF ? null : agent,
      })
    })
  }

  forgetDesk(user: string, agent = CHIEF): void {
    run(this.db, 'DELETE FROM desk_sessions WHERE user_id = ? AND agent_id = ?', user, agent)
  }

  markSeen(user: string, journalId: number, agent = CHIEF): void {
    run(
      this.db,
      'UPDATE desk_sessions SET seen_journal_id = ?, last_turn_at = ? WHERE user_id = ? AND agent_id = ?',
      journalId,
      now(),
      user,
      agent,
    )
  }

  // A file put on a row, with its kind (one the row's table takes, when it names them). The same
  // file on the same row again only changes its kind. Journaled as filed, so the schedules waiting
  // on a filing read it with the rows it sits on.
  placeFile(hash: string, recordId: string, kind: string | null, ctx: WriteCtx): RowFile {
    return tx(this.db, () => {
      const file = this.files.file(hash)
      if (!file) throw new Refused('That file is not there.')
      const rec = this.records.get(recordId)
      if (!rec) throw new Refused('That row is not there.')
      const { table, record } = rec
      const k = kind?.trim() || null
      if (k && table.documents?.length && !table.documents.includes(k))
        throw new Refused(
          `${table.name}'s rows take ${table.documents.join(', ')}; ${k} is not one of them.`,
        )
      const known = one<{ kind: string | null }>(
        this.db,
        'SELECT kind FROM row_files WHERE record_id = ? AND file_hash = ?',
        record.id,
        hash,
      )
      if (known && known.kind === k) return this.rowFile(record.id, hash) as RowFile
      if (known)
        run(
          this.db,
          'UPDATE row_files SET kind = ? WHERE record_id = ? AND file_hash = ?',
          k,
          record.id,
          hash,
        )
      else
        run(
          this.db,
          'INSERT INTO row_files (record_id, file_hash, kind, placed_by, placed_at) VALUES (?, ?, ?, ?, ?)',
          record.id,
          hash,
          k,
          actorName(ctx.actor),
          now(),
        )
      const name = rowName(table, record.values)
      append(this.db, {
        actor: ctx.actor,
        kind: 'filed',
        words: known
          ? `${file.name} on ${name} is ${k ? `a ${k}` : 'of no kind named'} now.`
          : `Filed ${file.name} on ${name} in ${table.name}${k ? `, as a ${k}` : ''}.`,
        data: {
          file: hash,
          record: record.id,
          table: table.id,
          kind: k,
          document: this.files.document(hash)?.id ?? null,
        },
        user: ctx.user ?? null,
        turn: ctx.turn ?? null,
        run: ctx.run ?? null,
        module: table.module.id,
      })
      return this.rowFile(record.id, hash) as RowFile
    })
  }

  // A file taken off a row: the file stays in the world, and the journal says it was there.
  unplaceFile(hash: string, recordId: string, ctx: WriteCtx): void {
    tx(this.db, () => {
      const on = this.rowFile(recordId, hash)
      if (!on) throw new Refused('That file is not on that row.')
      const rec = this.records.get(recordId)
      run(this.db, 'DELETE FROM row_files WHERE record_id = ? AND file_hash = ?', recordId, hash)
      append(this.db, {
        actor: ctx.actor,
        kind: 'filed',
        words: `Took ${on.file.name} off ${rec ? rowName(rec.table, rec.record.values) : 'a row'}.`,
        data: { file: hash, record: recordId, table: on.table, off: true },
        user: ctx.user ?? null,
        turn: ctx.turn ?? null,
        run: ctx.run ?? null,
        module: rec?.table.module.id ?? null,
      })
    })
  }

  private rowFile(recordId: string, hash: string): RowFile | undefined {
    return this.rowFilesWhere('rf.record_id = ? AND rf.file_hash = ?', recordId, hash)[0]
  }

  // The files on a row, newest first; or the rows a file sits on.
  rowFiles(recordId: string): RowFile[] {
    return this.rowFilesWhere('rf.record_id = ?', recordId)
  }

  rowsOfFile(hash: string): RowFile[] {
    return this.rowFilesWhere('rf.file_hash = ?', hash)
  }

  private rowFilesWhere(where: string, ...args: string[]): RowFile[] {
    return all<{
      record_id: string
      file_hash: string
      kind: string | null
      placed_by: string
      placed_at: string
      table_id: string
      document: string | null
    }>(
      this.db,
      `SELECT rf.record_id, rf.file_hash, rf.kind, rf.placed_by, rf.placed_at, r.table_id,
         d.id AS document
       FROM row_files rf JOIN records r ON r.id = rf.record_id
       LEFT JOIN documents d ON d.file_hash = rf.file_hash
       WHERE ${where} ORDER BY rf.placed_at DESC`,
      ...args,
    ).map((r) => ({
      file: this.files.file(r.file_hash) as FileOut,
      record: r.record_id,
      table: r.table_id,
      kind: r.kind,
      placedBy: r.placed_by,
      placedAt: r.placed_at,
      document: r.document,
    }))
  }

  // A row as the person names it: its first text, or the person its first person field holds
  // when that comes first (a circle's member is the person, not why they are there).
  rowName(t: Table, values: Record<string, unknown>): string {
    for (const f of t.fields) {
      const v = values[f.slug]
      if (typeof v !== 'string' || !v) continue
      if (f.kind === 'person') return this.people.names([v])[v] ?? v
      if (f.kind === 'text') return v
    }
    return rowName(t, values)
  }

  // Modules and tables with their row counts: the map in the start layer.
  map(): {
    module: string
    within: string | null // the module it sits inside
    notes: string
    dir: string
    tables: {
      name: string
      view: string
      rows: number
      fields: string[]
      documents: string[] | null
      about: string | null
      place: Place
      of: string | null // the table its rows are part of
    }[]
  }[] {
    const modules = this.shape.modules()
    return modules.map((m) => ({
      module: m.name,
      within: modules.find((p) => p.id === m.parent)?.name ?? null,
      notes: join(m.dir, 'NOTES.md'),
      dir: m.dir,
      tables: this.shape.tables(m.id).map((t) => ({
        name: t.name,
        view: t.slug,
        rows: this.records.count(t.id),
        fields: t.fields.map((f) => `${f.name} (${f.kind})`),
        documents: t.documents,
        about: t.about,
        place: placeOf(t),
        of: this.shape.table(t.fields.find((f) => f.partOf)?.relatesTo ?? '')?.name ?? null,
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

// The account name, when the platform gave none (its own name for the person is the
// platform's to know).
function fullName(): string {
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
export function tenantDir(home: string, id: string | null = null): string {
  const tenants = join(home, 'tenants')
  mkdirSync(tenants, { recursive: true })
  if (id) return join(tenants, id)
  const found = readdirSync(tenants, { withFileTypes: true }).find(
    (d) =>
      d.isDirectory() &&
      d.name.startsWith('t_') &&
      existsSync(join(tenants, d.name, 'world.sqlite')),
  )
  return join(tenants, found ? found.name : newId('t'))
}
