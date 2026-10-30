// A goal's task is made once and kept up to date; a page's arrangement is kept per person.
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, expect, it } from 'vitest'
import { Engine } from '../engine/engine.ts'
import { World } from '../world/world.ts'
import { buildServer } from './server.ts'

let home: string
let world: World
let engine: Engine
const token = 'secret-token'
const ok = { host: '127.0.0.1:4700', 'x-alpha-token': token }

beforeEach(async () => {
  home = mkdtempSync(join(tmpdir(), 'alpha-goal-'))
  world = await World.open(join(home, 'tenants', 't_test'))
  engine = new Engine(world)
})
afterEach(() => {
  engine.close()
  world.close()
  rmSync(home, { recursive: true, force: true })
})

it('makes a goal’s task once, renames it as the goal moves, and closes it when met', async () => {
  const user = world.owner('Kenil')
  const alpha = { actor: { kind: 'alpha' as const } }
  const m = world.shape.makeModule('Deals', alpha)
  const t = world.shape.makeTable(m.id, 'Goals', [{ name: 'Measure', kind: 'text' }], alpha)
  const said = world.line({
    actor: { kind: 'person', id: user.id },
    kind: 'said',
    words: 'listings reviewed',
    user: user.id,
  })
  const [row] = world.records.add(
    t.id,
    [{ values: { Measure: 'Listings reviewed' }, provenance: { kind: 'stated' } }],
    {
      actor: { kind: 'person', id: user.id },
      user: user.id,
      turn: String(said.id),
      said: { message: said.id, user: user.id },
    },
  )
  const a = buildServer({ engine, user, token, ports: [4700] })
  const on = { module: m.id, table: t.id, row: String(row) }
  const ensure = async (title: string, met = false) =>
    (
      await a.inject({
        method: 'POST',
        url: '/api/tasks/ensure',
        headers: ok,
        payload: { title, on, met },
      })
    ).json() as { id: string; title: string; state: string } | null
  const first = await ensure('Review 10 more listings this week')
  const again = await ensure('Review 8 more listings this week')
  expect(again?.id).toBe(first?.id)
  expect(world.tasks.list({ on: { ...on, field: null, page: null } }).map((x) => x.title)).toEqual([
    'Review 8 more listings this week',
  ])
  await ensure('Review 0 more listings this week', true)
  expect(world.tasks.get(String(first?.id))?.state).toBe('done')
  // closed this week: not made again until next week
  expect(await ensure('Review 3 more listings this week')).toBeNull()

  await a.inject({
    method: 'POST',
    url: '/api/layout',
    headers: ok,
    payload: { arrange: { home: [['needs', 'tasks'], ['changed']] } },
  })
  const me = (await a.inject({ url: '/api/me', headers: ok })).json() as {
    layout: { arrange?: Record<string, string[][]> }
  }
  expect(me.layout.arrange).toEqual({ home: [['needs', 'tasks'], ['changed']] })
  await a.inject({
    method: 'POST',
    url: '/api/layout',
    headers: ok,
    payload: { arrange: { home: null } },
  })
  expect((await a.inject({ url: '/api/me', headers: ok })).json().layout.arrange).toBeUndefined()
  await a.close()
})
