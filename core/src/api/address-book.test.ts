// People's Address book is its storage, no place: no module list, Setup's Tables card or
// /api/modules shows it, yet People still lists everyone from its rows.
import { appendFileSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, expect, it } from 'vitest'
import { Engine } from '../engine/engine.ts'
import { World } from '../world/world.ts'
import { buildServer } from './server.ts'
import type { ModuleSummary, ModuleView } from './types.ts'

const alpha = { actor: { kind: 'alpha' as const } }
const looked = { kind: 'looked_up' as const, source: { url: 'https://example.com' } }
const ok = { host: '127.0.0.1:4700', 'x-alpha-token': 'secret-token' }
let home: string
let world: World
let engine: Engine
beforeEach(async () => {
  home = mkdtempSync(join(tmpdir(), 'alpha-book-api-'))
  world = await World.open(join(home, 'tenants', 't_test'))
  engine = new Engine(world)
})
afterEach(() => {
  engine.close()
  world.close()
  rmSync(home, { recursive: true, force: true })
})

it('keeps the Address book out of every list of a module’s tables, and People lists everyone', async () => {
  const m = world.shape.makeModule('People', alpha)
  appendFileSync(join(m.dir, 'module.yaml'), 'people: true\n')
  const book = world.shape.makeTable(
    m.id,
    'Address book',
    [
      { name: 'Name', kind: 'text' },
      { name: 'Emails', kind: 'text' },
    ],
    alpha,
    { key: 'Address book' },
  )
  world.people.mapTable(book.id, { each: 'person', name: 'Name', emails: 'Emails' }, alpha)
  world.records.add(
    book.id,
    [{ values: { Name: 'Ann Lee', Emails: 'ann@lee.example' }, provenance: looked }],
    alpha,
  )
  const a = buildServer({
    engine,
    user: world.owner('Kenil'),
    token: 'secret-token',
    ports: [4700],
  })
  const view = (await a.inject({ url: `/api/modules/${m.id}`, headers: ok })).json() as ModuleView
  expect(view.tables).toEqual([])
  const list = (await a.inject({ url: '/api/modules', headers: ok })).json() as ModuleSummary[]
  const summary = list.find((x) => x.id === m.id)
  expect(summary?.tables).toEqual([])
  expect(summary?.people).toBe(true) // People still shows in the rail
  expect(world.people.list('person').map((p) => p.name)).toEqual(['Ann Lee'])
})
