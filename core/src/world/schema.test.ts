// One schema: a fresh world is schema.sql and nothing else, at the newest version; a world made
// before a migration takes it; what the delete left behind is absent.

import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { MIGRATIONS, SCHEMA } from './migrations.ts'
import { World } from './world.ts'

let home: string
let world: World
beforeEach(async () => {
  home = mkdtempSync(join(tmpdir(), 'alpha-schema-'))
  world = await World.open(join(home, 'tenants', 't_test'))
})
afterEach(() => {
  world.close()
  rmSync(home, { recursive: true, force: true })
})

const named = (kind: string) =>
  [...SCHEMA.matchAll(new RegExp(`CREATE (?:VIRTUAL |UNIQUE )?${kind} (\\w+)`, 'g'))]
    .map((m) => m[1] as string)
    .sort()
const made = (type: string) =>
  (
    world.db
      .prepare(
        `SELECT name FROM sqlite_master m WHERE type = ? AND name NOT LIKE 'sqlite_%'
         AND name NOT IN (SELECT name FROM pragma_table_list WHERE type = 'shadow') ORDER BY name`,
      )
      .all(type) as { name: string }[]
  ).map((r) => r.name)
const columns = (t: string) =>
  (world.db.prepare(`PRAGMA table_info(${t})`).all() as { name: string }[]).map((c) => c.name)

describe('the world’s shape', () => {
  it('is schema.sql and its migrations, and a fresh world is exactly schema.sql', () => {
    expect(MIGRATIONS).toHaveLength(12)
    expect(world.db.prepare('PRAGMA user_version').get()).toEqual({ user_version: 12 })
    expect(made('table')).toEqual(named('TABLE'))
    expect(made('index')).toEqual(named('INDEX'))
    expect(made('trigger')).toEqual(named('TRIGGER'))
  })

  it('gives a world made before migration 2 where its connections signed in to', async () => {
    const file = join(home, 'old.sqlite')
    const old = new DatabaseSync(file)
    old.exec(SCHEMA.replace(/\n\s*place TEXT,[^\n]*/, ''))
    old.exec('PRAGMA user_version = 1')
    old.exec(
      "INSERT INTO connections (id, connector, account, state, made_by, created_at) VALUES ('c1', 'outlook', 'a@b.example', 'connected', 'system', 'now')",
    )
    old.close()
    const again = new DatabaseSync(file)
    expect(
      (again.prepare('PRAGMA table_info(connections)').all() as { name: string }[]).map(
        (c) => c.name,
      ),
    ).not.toContain('place')
    const { migrate } = await import('./schema.ts')
    expect(await migrate(again as never, file, join(home, 'backups'))).toBe(MIGRATIONS.length)
    expect(again.prepare("SELECT account, place FROM connections WHERE id = 'c1'").get()).toEqual({
      account: 'a@b.example',
      place: null,
    })
    again.close()
  })

  it('gives a world made before migration 3 its computers, and a computer to each connection', async () => {
    const file = join(home, 'older.sqlite')
    const old = new DatabaseSync(file)
    old.exec(
      SCHEMA.replace(/\n\s*computer TEXT,[^\n]*/, '').replace(
        /\n-- A person's paired computers[\s\S]*$/,
        '\n',
      ),
    )
    old.exec('PRAGMA user_version = 2')
    old.exec(
      "INSERT INTO connections (id, connector, account, state, made_by, created_at) VALUES ('c1', 'folder', '/x', 'connected', 'system', 'now')",
    )
    old.close()
    const again = new DatabaseSync(file)
    const { migrate } = await import('./schema.ts')
    expect(await migrate(again as never, file, join(home, 'backups'))).toBe(MIGRATIONS.length)
    expect(again.prepare("SELECT computer FROM connections WHERE id = 'c1'").get()).toEqual({
      computer: null,
    })
    expect(again.prepare('SELECT count(*) AS n FROM computers').get()).toEqual({ n: 0 })
    expect(again.prepare('SELECT count(*) AS n FROM computer_links').get()).toEqual({ n: 0 })
    again.close()
  })

  it('gives a world made before migration 4 what a read left out on the never-use list', async () => {
    const file = join(home, 'oldest.sqlite')
    const old = new DatabaseSync(file)
    old.exec(SCHEMA.replace(/\n\s*left_out INTEGER,[^\n]*/, ''))
    old.exec('PRAGMA user_version = 3')
    old.exec(
      "INSERT INTO connections (id, connector, account, state, made_by, created_at) VALUES ('c1', 'gmail', 'a@b.example', 'connected', 'system', 'now')",
    )
    old.close()
    const again = new DatabaseSync(file)
    const { migrate } = await import('./schema.ts')
    expect(await migrate(again as never, file, join(home, 'backups'))).toBe(MIGRATIONS.length)
    expect(again.prepare("SELECT left_out FROM connections WHERE id = 'c1'").get()).toEqual({
      left_out: null,
    })
    again.close()
  })

  it('gives a world made before migration 5 the plugin a kit is of', async () => {
    const file = join(home, 'kits.sqlite')
    const old = new DatabaseSync(file)
    old.exec(SCHEMA.replace(/,\n\s*plugin TEXT[^\n]*/, ''))
    old.exec('PRAGMA user_version = 4')
    old.close()
    const again = new DatabaseSync(file)
    const { migrate } = await import('./schema.ts')
    expect(await migrate(again as never, file, join(home, 'backups'))).toBe(MIGRATIONS.length)
    const cols = again.prepare("SELECT name FROM pragma_table_info('kits')").all() as {
      name: string
    }[]
    expect(cols.map((c) => c.name)).toContain('plugin')
    again.close()
  })

  it('gives a world made before migration 7 the way a table first opens', async () => {
    const file = join(home, 'tables.sqlite')
    const old = new DatabaseSync(file)
    old.exec(SCHEMA.replace(/,\n\s*start_view TEXT[^\n]*/, ''))
    old.exec('PRAGMA user_version = 6')
    old.close()
    const again = new DatabaseSync(file)
    const { migrate } = await import('./schema.ts')
    expect(await migrate(again as never, file, join(home, 'backups'))).toBe(MIGRATIONS.length)
    const cols = again.prepare("SELECT name FROM pragma_table_info('tables')").all() as {
      name: string
    }[]
    expect(cols.map((c) => c.name)).toContain('start_view')
    again.close()
  })

  it('marks everyone in a world made before migration 11 as through Set up Alpha', async () => {
    const file = join(home, 'story.sqlite')
    const old = new DatabaseSync(file)
    old.exec(SCHEMA.replace(/CREATE TABLE story \([^;]*;/, ''))
    old.exec('PRAGMA user_version = 10')
    old.exec(
      "INSERT INTO users (id, name, role, created_at) VALUES ('u1', 'Kenil', 'owner', 'now'), ('u2', 'Priya', 'member', 'now')",
    )
    old.close()
    const again = new DatabaseSync(file)
    const { migrate } = await import('./schema.ts')
    expect(await migrate(again as never, file, join(home, 'backups'))).toBe(MIGRATIONS.length)
    const rows = again.prepare('SELECT user_id, done_at FROM story ORDER BY user_id').all() as {
      user_id: string
      done_at: string | null
    }[]
    expect(rows.map((r) => r.user_id)).toEqual(['u1', 'u2'])
    expect(rows.every((r) => r.done_at)).toBe(true)
    again.close()
  })

  it('gives a world made before migration 12 its reads and what they added, from the journal', async () => {
    const file = join(home, 'reads.sqlite')
    const old = new DatabaseSync(file)
    old.exec(
      SCHEMA.replace(/CREATE TABLE read_totals \([^;]*;/, '')
        .replace(/\n\s*reads INTEGER[^\n]*/, '')
        .replace(/\n\s*reads_failed INTEGER[^\n]*/, ''),
    )
    old.exec('PRAGMA user_version = 11')
    old.exec(
      "INSERT INTO connections (id, connector, account, state, made_by, created_at) VALUES ('c1', 'gmail', 'sam@oak.example', 'connected', 'system', 'now')",
    )
    const line = (kind: string, data: object) =>
      old
        .prepare(
          "INSERT INTO journal (at, actor_kind, kind, words, data) VALUES ('now', 'connector', ?, 'x', ?)",
        )
        .run(kind, JSON.stringify(data))
    line('connection_read', { connection: 'c1', state: 'ok' })
    line('connection_read', { connection: 'c1', state: 'failed' })
    line('connection_read', { connection: 'c1', state: 'ok' })
    line('connection_read', { connection: 'other', state: 'ok' })
    line('landed', {
      table: 't1',
      added: 3,
      changed: 1,
      connector: 'gmail',
      account: 'sam@oak.example',
    })
    line('landed', {
      table: 't1',
      added: 2,
      changed: 0,
      connector: 'gmail',
      account: 'sam@oak.example',
    })
    line('landed', {
      table: 't1',
      added: 9,
      changed: 0,
      connector: 'gmail',
      account: 'jo@oak.example',
    })
    old.close()
    const again = new DatabaseSync(file)
    const { migrate } = await import('./schema.ts')
    expect(await migrate(again as never, file, join(home, 'backups'))).toBe(MIGRATIONS.length)
    expect(again.prepare('SELECT reads, reads_failed FROM connections').get()).toEqual({
      reads: 3,
      reads_failed: 1,
    })
    expect(
      again.prepare('SELECT connection_id, tbl, read, added, changed FROM read_totals').all(),
    ).toEqual([{ connection_id: 'c1', tbl: 't1', read: 0, added: 5, changed: 1 }])
    again.close()
  })

  it('holds nothing the clean base took away', () => {
    expect(made('table')).not.toContain('desk_messages')
    expect(columns('connections')).not.toContain('never')
    expect(columns('schedules')).not.toContain('tasks')
    expect(columns('runs')).not.toContain('task_id')
    expect(world.db.prepare("SELECT 1 FROM meta WHERE key = 'undo_since'").get()).toBeUndefined()
    expect(readFileSync(join(import.meta.dirname, 'schema.sql'), 'utf8')).not.toMatch(/'priced'/)
  })

  it('takes a task only for the person or Alpha', () => {
    const add = world.db.prepare(
      "INSERT INTO tasks (id, title, state, owner_kind, made_by, created_at, updated_at) VALUES ('t', 'x', 'todo', ?, 'a', 'now', 'now')",
    )
    expect(() => add.run('schedule')).toThrow(/CHECK/)
  })
})
