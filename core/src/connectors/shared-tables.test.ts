// Alpha's own Calendar and People (core/kits) as every calendar and address book finds them: a
// connector lands in their Events and Contacts by lasting keys, so there is one of each, the
// Calendar opening on its calendar and People with its People tabs.
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { calendar, contactsConnector } from '@alpha/connector-mac'
import { CONTACTS } from '@alpha/connector-sdk'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { livesPeople } from '../api/views.ts'
import { keepDefaults } from '../modules/defaults.ts'
import { MIGRATIONS } from '../world/migrations.ts'
import type { Table } from '../world/shape/index.ts'
import { placeOf } from '../world/shape/parts.ts'
import { World } from '../world/world.ts'
import { landIn } from './places.ts'

let home: string
let world: World
const system = { actor: { kind: 'system' as const } }

beforeEach(async () => {
  home = mkdtempSync(join(tmpdir(), 'alpha-shared-'))
  world = await World.open(join(home, 'tenants', 't_test'))
})
afterEach(() => {
  world.close()
  rmSync(home, { recursive: true, force: true })
})

describe('Calendar and People, Alpha’s own', () => {
  it('are there from the start, and a calendar and an address book land in them', async () => {
    const said = await keepDefaults(world, system)
    expect(said).toEqual([
      "Installed Calendar 0.2.1, Alpha's own.",
      "Installed People 0.1.2, Alpha's own.",
    ])
    const cal = world.shape.ownModule('Calendar')
    const people = world.shape.ownModule('People')
    expect(people && livesPeople(people)).toBe(true)
    const events = world.shape.ownTable(cal?.id ?? '', 'Events')
    expect(events?.hidden).toBe(false)
    // Events opens as a calendar, as its kit says (ui-rules T27): a view, not a list
    expect(events?.startView?.kind).toBe('calendar')
    // the connectors find them by their keys: one Events, one Contacts
    landIn(world, calendar)
    landIn(world, contactsConnector)
    expect(world.shape.tables(cal?.id ?? '').map((t) => t.name)).toEqual(['Events'])
    expect(world.shape.tables(people?.id ?? '').map((t) => t.name)).toEqual(['Contacts'])
    expect(world.shape.ownTable(cal?.id ?? '', 'Events')?.id).toBe(events?.id)
    expect(world.shape.ownModule('Contacts')).toBeUndefined()
    // People's module reads Network; its own Contacts keeps its key, every connector's and every
    // Bridge's, and is People's source, never a place of its own: no tab, and none can be made
    expect(people?.name).toBe('Network')
    const book = world.shape.ownTable(people?.id ?? '', CONTACTS.name) as Table
    expect(book.key).toBe('Contacts')
    expect(placeOf(book)).toBe('people')
    expect(() => world.shape.setTab(book.id, true, system)).toThrow(/not as a tab/)
  })

  it('adopt the Events a calendar made before them, rows and all', async () => {
    const [made] = landIn(world, calendar)
    world.records.land(
      made?.id ?? '',
      [{ key: 'e1', values: { Title: 'Harbor call', Starts: '2026-11-17T15:00:00Z' } }],
      { connector: 'calendar', account: 'This Mac' },
      { actor: { kind: 'connector', id: 'calendar' } },
    )
    await keepDefaults(world, system)
    const cal = world.shape.modules().filter((m) => m.name === 'Calendar')
    expect(cal).toHaveLength(1)
    const events = world.shape.ownTable(cal[0]?.id ?? '', 'Events')
    expect(events?.id).toBe(made?.id)
    expect(world.records.count(events?.id ?? '')).toBe(1)
    expect(events?.hidden).toBe(false)
    expect(events?.startView?.kind).toBe('calendar')
  })

  it('take the module a connector kept contacts in before, under People', async () => {
    const before = landIn(world, {
      ...contactsConnector,
      module: 'Contacts',
      tables: [{ ...CONTACTS, module: 'Contacts' }],
    })
    await keepDefaults(world, system)
    const people = world.shape.ownModule('People')
    expect(people?.name).toBe('Network')
    expect(world.shape.ownModule('Contacts')).toBeUndefined()
    expect(world.shape.ownTable(people?.id ?? '', 'Contacts')?.id).toBe(before[0]?.id)
    expect(people && livesPeople(people)).toBe(true)
  })
})

// Migration 10: People's module, named People before, reads Network; a name the person gave it,
// or a Network already there, is left as it is.
describe('People’s module, named before it read Network', () => {
  const migrate = () => (MIGRATIONS[9] as (db: typeof world.db) => void)(world.db)
  const named = (name: string) =>
    world.db.prepare("UPDATE modules SET name = ? WHERE key = 'People'").run(name)
  const name = () => world.shape.ownModule('People')?.name

  it('reads Network, and keeps a name the person gave it', async () => {
    await keepDefaults(world, system)
    named('People')
    migrate()
    expect(name()).toBe('Network')
    named('Friends')
    migrate()
    expect(name()).toBe('Friends')
  })

  it('leaves it People when the person has a module called Network', async () => {
    world.shape.makeModule('Network', system)
    await keepDefaults(world, system)
    expect(name()).toBe('People')
    migrate()
    expect(name()).toBe('People')
  })
})
