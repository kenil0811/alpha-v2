// One schema (the clean base, step 3, Kenil's yes 9 Nov): a fresh world is schema.sql and nothing
// else, at version 1; what the delete left behind is absent.
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
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
  it('is one version, and a fresh world is exactly schema.sql', () => {
    expect(MIGRATIONS).toHaveLength(1)
    expect(world.db.prepare('PRAGMA user_version').get()).toEqual({ user_version: 1 })
    expect(made('table')).toEqual(named('TABLE'))
    expect(made('index')).toEqual(named('INDEX'))
    expect(made('trigger')).toEqual(named('TRIGGER'))
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
