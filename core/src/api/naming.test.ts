// Renaming from the window: a table's name in the bar and a module's in
// the rail, each through the one core rename Alpha's tool uses, walled and journaled the same.
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Engine } from '../engine/engine.ts'
import { applyShape } from '../engine/tools/shape.ts'
import { World } from '../world/world.ts'
import { buildServer } from './server.ts'
import type { TableView } from './types.ts'

let home: string
let world: World
let engine: Engine
const token = 'secret-token'
const ok = { host: '127.0.0.1:4700', 'x-alpha-token': token }
const alpha = { actor: { kind: 'alpha' as const } }

beforeEach(async () => {
  home = mkdtempSync(join(tmpdir(), 'alpha-naming-'))
  world = await World.open(join(home, 'tenants', 't_test'))
  engine = new Engine(world)
})

afterEach(() => {
  engine.close()
  world.close()
  rmSync(home, { recursive: true, force: true })
})

const app = () => buildServer({ engine, user: world.owner('Kenil'), token, ports: [4700] })

describe('renaming a table from the bar', () => {
  it('renames it as the person, journaled as Alpha’s rename is, and the table says its new name', async () => {
    const m = world.shape.makeModule('Bakery', alpha)
    const t = world.shape.makeTable(m.id, 'Orders', [{ name: 'Item', kind: 'text' }], alpha)
    const a = app()
    const res = await a.inject({
      method: 'POST',
      url: `/api/tables/${t.id}/name`,
      headers: ok,
      payload: { name: 'Purchases' },
    })
    expect(res.json()).toEqual({ id: t.id, name: 'Purchases' })
    const view = (await a.inject({ url: `/api/tables/${t.id}`, headers: ok })).json() as TableView
    expect(view.name).toBe('Purchases')
    const line = world.lines({ kinds: ['shaped'] }).at(-1)
    expect(line?.words).toBe('Renamed the table Orders to Purchases.')
    expect(line?.actor).toMatchObject({ kind: 'person' })
    await a.close()
  })

  it('refuses a name for a period, and one another table has, in the same words Alpha meets', async () => {
    const m = world.shape.makeModule('Bakery', alpha)
    const t = world.shape.makeTable(m.id, 'Orders', [{ name: 'Item', kind: 'text' }], alpha)
    world.shape.makeTable(m.id, 'Suppliers', [{ name: 'Name', kind: 'text' }], alpha)
    const a = app()
    const rename = (name: string) =>
      a.inject({
        method: 'POST',
        url: `/api/tables/${t.id}/name`,
        headers: ok,
        payload: { name },
      })
    const period = await rename('March orders')
    expect(period.statusCode).toBe(409)
    expect(period.json().problem).toMatch(
      /names a period \(march\): make one table for every period/,
    )
    expect((await rename('suppliers')).json().problem).toBe(
      'There is already a table called Suppliers.',
    )
    // Alpha's tool reaches the same wall through the same rename
    expect(() =>
      applyShape(world, { action: 'rename', table: 'Orders', to: 'October orders' }, alpha),
    ).toThrow(/names a period \(october\)/)
    expect(world.shape.table(t.id)?.name).toBe('Orders')
    await a.close()
  })
})

describe('renaming a module from the rail', () => {
  it('changes its name alone: its id, key and folder stay, and the journal says so', async () => {
    const connector = { actor: { kind: 'connector' as const, id: 'gmail' } }
    const m = world.shape.makeModule('Mail', connector, 'Mail')
    const a = app()
    const res = await a.inject({
      method: 'POST',
      url: `/api/modules/${m.id}/name`,
      headers: ok,
      payload: { name: 'Inbox' },
    })
    expect(res.json()).toEqual({ id: m.id, name: 'Inbox' })
    const now = world.shape.module(m.id)
    expect([now?.name, now?.slug, now?.dir]).toEqual(['Inbox', m.slug, m.dir])
    expect(world.shape.ownModule('Mail')?.id).toBe(m.id)
    expect(world.lines({ kinds: ['shaped'] }).at(-1)?.words).toBe(
      'Renamed the module Mail to Inbox.',
    )
    await a.close()
  })

  it('refuses an empty name and one another module has', async () => {
    const m = world.shape.makeModule('Bakery', alpha)
    world.shape.makeModule('Shops', alpha)
    const a = app()
    const rename = async (name: string) =>
      (
        await a.inject({
          method: 'POST',
          url: `/api/modules/${m.id}/name`,
          headers: ok,
          payload: { name },
        })
      ).json().problem
    expect(await rename('  ')).toBe('A new name is needed.')
    expect(await rename('shops')).toBe('There is already a module called Shops.')
    expect(world.shape.module(m.id)?.name).toBe('Bakery')
    await a.close()
  })
})
