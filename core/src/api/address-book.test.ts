// People's own Contacts, where every address book lands, is People's source and no place: no module
// list, Setup or Find shows it, while People lists everyone from its rows and the module stays in
// the rail as Network.
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { contactsConnector } from '@alpha/connector-mac'
import { CONTACTS } from '@alpha/connector-sdk'
import { afterEach, beforeEach, expect, it } from 'vitest'
import { landIn } from '../connectors/places.ts'
import { Engine } from '../engine/engine.ts'
import { keepDefaults } from '../modules/defaults.ts'
import { World } from '../world/world.ts'
import { buildServer } from './server.ts'
import type { FoundRow, ModuleSummary, ModuleView } from './types.ts'

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

it('keeps People’s Contacts out of every place a person browses, and People lists everyone', async () => {
  await keepDefaults(world, { actor: { kind: 'system' } })
  const [book] = landIn(world, contactsConnector)
  world.records.land(
    book?.id ?? '',
    [{ key: 'p1', values: { Name: 'Ann Lee', Emails: 'ann@lee.example' } }],
    { connector: 'mac', account: 'This Mac' },
    { actor: { kind: 'connector', id: 'mac' } },
  )
  const m = world.shape.ownModule('People')
  expect(book?.key).toBe(CONTACTS.name)
  const a = buildServer({
    engine,
    user: world.owner('Kenil'),
    token: 'secret-token',
    ports: [4700],
  })
  const view = (await a.inject({ url: `/api/modules/${m?.id}`, headers: ok })).json() as ModuleView
  expect(view.tables.map((t) => t.name)).not.toContain('Contacts')
  const list = (await a.inject({ url: '/api/modules', headers: ok })).json() as ModuleSummary[]
  const summary = list.find((x) => x.id === m?.id)
  expect(summary?.name).toBe('Network')
  expect(summary?.people).toBe(true) // still in the rail, People and Organizations its tabs
  expect(summary?.tables.map((t) => t.name)).not.toContain('Contacts')
  const found = (await a.inject({ url: '/api/find?words=Ann', headers: ok })).json() as FoundRow[]
  expect(found.map((f) => f.hint)).not.toContain('Contacts')
  expect(world.people.list('person').map((p) => p.name)).toEqual(['Ann Lee'])
  await a.close()
})
