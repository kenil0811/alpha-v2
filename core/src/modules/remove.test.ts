// Deleting a module (Kenil, 10 Nov): its data kept, or all of it, the modules inside it too, and
// the journal keeps saying what went.
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { World } from '../world/world.ts'
import { install } from './kits/index.ts'
import { deleteModule } from './remove.ts'
import { schedules } from './schedules.ts'

let home: string
let world: World
const ctx = { actor: { kind: 'person' as const, id: 'u_1' }, user: 'u_1' }

beforeEach(async () => {
  home = mkdtempSync(join(tmpdir(), 'alpha-remove-'))
  world = await World.open(join(home, 'tenants', 't_test'))
})
afterEach(() => {
  world.close()
  rmSync(home, { recursive: true, force: true })
})

// The test kit, with a module inside it and a card waiting on it.
async function bakery() {
  const m = await install(world, join(import.meta.dirname, 'test-kit'), ctx)
  const inner = world.shape.makeModule('Ovens', ctx)
  world.shape.place(inner.id, m.id, ctx)
  world.shape.makeTable(inner.id, 'Bakes', [{ name: 'Name', kind: 'text' }], ctx)
  const card = world.cards.open({
    kind: 'permission',
    gate: 'sign_in',
    words: 'mill.example wants you to sign in',
    options: ['Sign in', 'Not now'],
    actor: { kind: 'schedule', id: 'n_1' },
    user: 'u_1',
    module: m.id,
  })
  return { m, inner, card }
}

describe('deleting a module', () => {
  it('keeping its data: nothing runs any more, and its tables and rows stay', async () => {
    const { m, card } = await bakery()
    const tables = world.shape.tables(m.id).length
    expect(schedules(world, m.id).length).toBeGreaterThan(0)
    const words = await deleteModule(world, m.id, true, ctx)
    expect(words).toMatch(/its schedules, scripts and pages\. Its tables and rows are kept\./)
    expect(schedules(world, m.id)).toEqual([])
    expect(existsSync(join(m.dir, 'schedules'))).toBe(false)
    expect(existsSync(join(m.dir, 'skills'))).toBe(false)
    expect(world.shape.module(m.id)).toBeDefined()
    expect(world.shape.tables(m.id).length).toBe(tables)
    expect(world.cards.get(card.id)?.state).toBe('withdrawn')
  }, 60_000)

  it('all of it: the module, the modules inside it, their tables, rows and folder', async () => {
    const { m, inner } = await bakery()
    const tables = [...world.shape.tables(m.id), ...world.shape.tables(inner.id)].map((t) => t.id)
    const words = await deleteModule(world, m.id, false, ctx)
    expect(words).toMatch(/^Deleted the module Bakery and the 1 module inside it, with \d+ tables/)
    expect(world.shape.module(m.id)).toBeUndefined()
    expect(world.shape.module(inner.id)).toBeUndefined()
    for (const t of tables) expect(world.shape.table(t)).toBeUndefined()
    expect(existsSync(m.dir)).toBe(false)
    expect(world.lines({ kinds: ['removed'] }).at(-1)?.words).toBe(words)
  }, 60_000)
})
