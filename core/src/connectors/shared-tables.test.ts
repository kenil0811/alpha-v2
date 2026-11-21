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
      "Installed Calendar 0.1.0, Alpha's own.",
      "Installed People 0.2.0, Alpha's own.",
    ])
    const cal = world.shape.ownModule('Calendar')
    const people = world.shape.ownModule('People')
    expect(people && livesPeople(people)).toBe(true)
    const events = world.shape.ownTable(cal?.id ?? '', 'Events')
    expect(events?.hidden).toBe(false)
    const first = world.views.list(events?.id ?? '').find((v) => v.isDefault)
    expect(first?.config.kind).toBe('calendar')
    // the connectors find them by their keys: one Events, one Contacts
    landIn(world, calendar)
    landIn(world, contactsConnector)
    expect(world.shape.tables(cal?.id ?? '').map((t) => t.name)).toEqual(['Events'])
    expect(world.shape.tables(people?.id ?? '').map((t) => t.name)).toEqual(['Address book'])
    expect(world.shape.ownTable(cal?.id ?? '', 'Events')?.id).toBe(events?.id)
    expect(world.shape.ownModule('Contacts')).toBeUndefined()
    // People's storage, not a place: no tab, and it cannot be made one
    const book = world.shape.ownTable(people?.id ?? '', 'Address book') as Table
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
    expect(world.views.list(events?.id ?? '').find((v) => v.isDefault)?.config.kind).toBe(
      'calendar',
    )
  })

  it('take the module a connector kept contacts in before, under People', async () => {
    const before = landIn(world, {
      ...contactsConnector,
      module: 'Contacts',
      tables: [{ ...CONTACTS, module: 'Contacts' }],
    })
    await keepDefaults(world, system)
    const people = world.shape.ownModule('People')
    expect(people?.name).toBe('People')
    expect(world.shape.ownModule('Contacts')).toBeUndefined()
    expect(world.shape.ownTable(people?.id ?? '', 'Address book')?.id).toBe(before[0]?.id)
    expect(people && livesPeople(people)).toBe(true)
  })
})

// Contacts goes: People's own source is its Address book (migration 6), the same table renamed
// in place, so its rows, people and history are the ones they were.
describe('Contacts, before People kept its own Address book', () => {
  const connector = { kind: 'connector' as const, id: 'mac' }
  const source = { connector: 'mac', account: 'This Mac' }
  const cards = [
    { key: 'p1', values: { Name: 'Priya Rao', Company: 'Harbor', Emails: 'priya@harbor.example' } },
    { key: 'p2', values: { Name: 'Sam Lee', Emails: 'sam@lee.example' } },
  ]
  const migrate = () => (MIGRATIONS[5] as (db: typeof world.db) => void)(world.db)
  // a world as it was before: the table called Contacts under its old key, slug and view
  const asBefore = () => {
    world.db.exec('ALTER TABLE address_book RENAME TO contacts')
    world.db.exec(
      "UPDATE tables SET name = 'Contacts', key = 'Contacts', slug = 'contacts' WHERE key = 'Address book'",
    )
    world.db.exec("UPDATE views SET name = 'All contacts' WHERE name = 'Everyone'")
  }
  const people = () => world.people.list('person').map((p) => `${p.id} ${p.name}`)

  it('keeps every person, row and id, and a sync after it updates the rows', async () => {
    await keepDefaults(world, system)
    const [t] = landIn(world, contactsConnector)
    world.records.land(t?.id ?? '', cards, source, { actor: connector })
    const before = people()
    expect(before).toHaveLength(2)
    asBefore()
    expect(world.shape.table(t?.id ?? '')?.name).toBe('Contacts')

    migrate()
    const home = world.shape.ownModule('People')
    expect(world.shape.tables(home?.id ?? '').map((x) => x.name)).toEqual(['Address book'])
    expect(world.shape.ownTable(home?.id ?? '', 'Address book')?.id).toBe(t?.id)
    expect(world.shape.ownTable(home?.id ?? '', 'Contacts')).toBeUndefined()
    expect(world.views.list(t?.id ?? '').map((v) => v.name)).toEqual(['Everyone'])
    expect(world.records.count(t?.id ?? '')).toBe(2)
    expect(people()).toEqual(before)
    expect(placeOf(world.shape.table(t?.id ?? '') as Table)).toBe('people')

    // the connector finds the moved table by its key: the same cards update, none repeats
    const [again] = landIn(world, contactsConnector)
    expect(again?.id).toBe(t?.id)
    world.records.land(
      again?.id ?? '',
      [{ key: 'p1', values: { ...cards[0]?.values, Title: 'Director' } }, ...cards.slice(1)],
      source,
      { actor: connector },
    )
    expect(world.records.count(t?.id ?? '')).toBe(2)
    expect(people()).toEqual(before)
    // the kit's update (0.1.0 to 0.2.0) adds no second table, and the migration again changes nothing
    world.db.exec("UPDATE kits SET version = '0.1.0' WHERE kit = 'People'")
    expect(await keepDefaults(world, system)).toEqual([expect.stringContaining('People')])
    migrate()
    expect(world.shape.tables(home?.id ?? '').map((x) => x.name)).toEqual(['Address book'])
  })

  it('leaves a world with no Contacts as it is', async () => {
    const tables = () => world.db.prepare('SELECT id, name, key, slug FROM tables').all()
    const none = tables()
    migrate()
    expect(tables()).toEqual(none)
    await keepDefaults(world, system)
    const kept = tables()
    migrate()
    expect(tables()).toEqual(kept)
  })
})
