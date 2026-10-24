import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Refused } from './kinds.ts'
import { addressList, profileKey } from './people/index.ts'
import type { Table } from './shape/index.ts'
import { World } from './world.ts'

let home: string
let world: World
const connector = { kind: 'connector' as const, id: 'test' }
const person = { kind: 'person' as const, id: 'u_test' }
const src = { connector: 'test', account: 'me@mine.com' }

beforeEach(async () => {
  home = mkdtempSync(join(tmpdir(), 'alpha-people-'))
  world = await World.open(join(home, 'tenants', 't_test'))
})

afterEach(() => {
  world.close()
  rmSync(home, { recursive: true, force: true })
})

function contacts(): Table {
  const m = world.shape.makeModule('Contacts', { actor: connector })
  const t = world.shape.makeTable(
    m.id,
    'Contacts',
    [
      { name: 'Name', kind: 'text' },
      { name: 'Company', kind: 'text' },
      { name: 'Title', kind: 'text' },
      { name: 'Emails', kind: 'text' },
      { name: 'Phones', kind: 'text' },
      { name: 'Profile', kind: 'text' },
    ],
    { actor: connector },
  )
  return world.people.mapTable(
    t.id,
    {
      each: 'person',
      name: 'Name',
      company: 'Company',
      title: 'Title',
      emails: 'Emails',
      phones: 'Phones',
      profile: 'Profile',
    },
    { actor: connector },
  )
}

function mail(): Table {
  const m = world.shape.makeModule('Gmail', { actor: connector })
  const t = world.shape.makeTable(
    m.id,
    'Mail',
    [
      { name: 'From', kind: 'text' },
      { name: 'To', kind: 'text' },
      { name: 'Cc', kind: 'text' },
      { name: 'Date', kind: 'date' },
      { name: 'Direction', kind: 'choice', choices: ['sent', 'received'] },
    ],
    { actor: connector },
  )
  return world.people.mapTable(
    t.id,
    {
      each: 'exchange',
      channel: 'mail',
      at: 'Date',
      from: 'From',
      to: ['To', 'Cc'],
      sent: { field: 'Direction', is: 'sent' },
    },
    { actor: connector },
  )
}

function events(withOrganizer = false): Table {
  const m = world.shape.makeModule('Calendar', { actor: connector })
  const t = world.shape.makeTable(
    m.id,
    'Events',
    [
      { name: 'Title', kind: 'text' },
      { name: 'Starts', kind: 'date' },
      { name: 'Attendees', kind: 'text' },
      { name: 'Organizer', kind: 'text' },
      { name: 'Your address', kind: 'text' },
    ],
    { actor: connector },
  )
  return world.people.mapTable(
    t.id,
    {
      each: 'exchange',
      channel: 'meeting',
      at: 'Starts',
      with: ['Attendees'],
      ...(withOrganizer ? { by: 'Organizer', you: 'Your address' } : {}),
    },
    { actor: connector },
  )
}

const land = (t: Table, items: { key: string; values: Record<string, unknown> }[]) =>
  world.records.land(t.id, items, src, { actor: connector })

const days = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString()

describe('people from rows', () => {
  it('reads address lists as messages write them', () => {
    expect(
      addressList('Sam Ortiz <SAM@grand.com>, bare@x.com, "Shah, Kenil" <k@y.com>; Lee <lee@z.io>'),
    ).toEqual([
      { email: 'sam@grand.com', name: 'Sam Ortiz' },
      { email: 'bare@x.com', name: null },
      { email: 'k@y.com', name: 'Shah, Kenil' },
      { email: 'lee@z.io', name: 'Lee' },
    ])
    expect(addressList('a@b.com, c@d.com')).toEqual([
      { email: 'a@b.com', name: null },
      { email: 'c@d.com', name: null },
    ])
    expect(profileKey('https://www.LinkedIn.com/in/sam-ortiz/?trk=x')).toBe(
      'linkedin.com/in/sam-ortiz',
    )
  })

  it('makes one person of two rows that share a key, and a company from a work domain', () => {
    const t = contacts()
    land(t, [
      {
        key: 'c1',
        values: { Name: 'Sam Ortiz', Emails: 'sam@grand.com', Company: 'Grand Brokers' },
      },
      { key: 'c2', values: { Name: 'Samuel Ortiz', Emails: 'SAM@grand.com, sam.o@gmail.com' } },
      { key: 'c3', values: { Name: 'Ana Ruiz', Emails: 'ana@gmail.com' } },
    ])
    expect(world.people.count()).toBe(2)
    const sam = world.people.get(world.people.byKey('email', 'sam.o@gmail.com') as string)
    expect(sam?.name).toBe('Sam Ortiz')
    expect(sam?.keys.email).toEqual(['sam.o@gmail.com', 'sam@grand.com'])
    expect(sam?.companies.map((c) => c.name)).toEqual(['Grand Brokers'])
    // a mail service makes no company
    expect(world.people.count('company')).toBe(1)
    const grand = world.people.get(world.people.byKey('domain', 'grand.com') as string)
    expect(grand?.people.map((p) => p.name)).toEqual(['Sam Ortiz'])
    expect(world.lines({ kinds: ['people'] }).map((l) => l.words)).toContain(
      'Met 2 people and 1 company in Contacts.',
    )
  })

  it('reads a phone written two ways as one key', () => {
    const t = contacts()
    land(t, [
      { key: 'c1', values: { Name: 'Priya Nair', Phones: '+44 7911 123456' } },
      { key: 'c2', values: { Name: 'P. Nair', Phones: '+44 20 7946 0958' } },
      { key: 'c3', values: { Name: 'Priya N', Phones: '07911 123456' } },
    ])
    expect(world.people.count()).toBe(2)
    expect(world.people.byKey('phone', '07911 123456')).toBe(
      world.people.byKey('phone', '+447911123456'),
    )
  })

  it('never merges two people a row names both: the pair waits for the person', () => {
    const t = contacts()
    land(t, [
      { key: 'c1', values: { Name: 'Sam Ortiz', Emails: 'sam@grand.com' } },
      { key: 'c2', values: { Name: 'Sam Ortiz', Phones: '+1 415 555 0132' } },
      { key: 'c3', values: { Name: 'Sam O', Emails: 'sam@grand.com', Phones: '+1 415 555 0132' } },
    ])
    expect(world.people.count()).toBe(2)
    expect(world.people.pairs('proposed')).toHaveLength(1)
    expect(world.people.pairs('proposed')[0]?.why).toBe('a row names both')
    // the phone stays with the one that had it
    expect(world.people.get(world.people.byKey('phone', '+14155550132') as string)?.keys).toEqual({
      phone: ['+14155550132'],
    })
  })

  it('takes a contact’s new address on the same person, letting the old one go', () => {
    const t = contacts()
    land(t, [{ key: 'c1', values: { Name: 'Sam Ortiz', Emails: 'sam@old.com' } }])
    const id = world.people.byKey('email', 'sam@old.com')
    land(t, [{ key: 'c1', values: { Name: 'Sam Ortiz', Emails: 'sam@new.com' } }])
    expect(world.people.byKey('email', 'sam@new.com')).toBe(id)
    expect(world.people.byKey('email', 'sam@old.com')).toBeNull()
    expect(world.people.count()).toBe(1)
  })

  it('keeps an old company with its dates when a contact moves', () => {
    const t = contacts()
    land(t, [{ key: 'c1', values: { Name: 'Sam Ortiz', Company: 'Grand', Title: 'Broker' } }])
    land(t, [{ key: 'c1', values: { Name: 'Sam Ortiz', Company: 'Summit', Title: 'Partner' } }])
    const sam = world.people.list()[0]
    expect(sam?.companies).toEqual(['Summit'])
    const page = world.people.get(sam?.id as string)
    expect(page?.companies.map((c) => [c.name, c.title, !!c.ended])).toEqual([
      ['Summit', 'Partner', false],
      ['Grand', 'Broker', true],
    ])
  })

  it('takes away only what a removed row alone brought', () => {
    const t = contacts()
    land(t, [
      { key: 'c1', values: { Name: 'Sam Ortiz', Emails: 'sam@grand.com' } },
      {
        key: 'c2',
        values: { Name: 'Sam Ortiz', Emails: 'sam@grand.com', Phones: '+1 415 555 0132' },
      },
      { key: 'c3', values: { Name: 'Ana Ruiz', Emails: 'ana@ruiz.com' } },
    ])
    const rows = world.records.list(t.id)
    const c2 = rows.find((r) => String(r.values.phones ?? '').includes('415'))?.id as string
    const c3 = rows.find((r) => r.values.name === 'Ana Ruiz')?.id as string
    world.records.remove(t.id, [c2, c3], { actor: person })
    expect(world.people.count()).toBe(1)
    expect(world.people.byKey('phone', '+14155550132')).toBeNull()
    expect(world.people.byKey('email', 'sam@grand.com')).not.toBeNull()
    expect(world.people.count('company')).toBe(1)
    world.shape.removeTable(t.id, { actor: person })
    expect(world.people.count()).toBe(0)
    expect(world.people.count('company')).toBe(0)
  })
})

describe('people from mail and meetings', () => {
  it('makes people only of those the person writes to, and counts every message', () => {
    const t = mail()
    land(t, [
      {
        key: 'm1',
        values: {
          From: 'Stranger <s@spam.io>',
          To: 'Me <me@mine.com>',
          Date: days(30),
          Direction: 'received',
        },
      },
      {
        key: 'm2',
        values: {
          From: 'Sam Ortiz <sam@grand.com>',
          To: 'me@mine.com',
          Date: days(20),
          Direction: 'received',
        },
      },
    ])
    expect(world.people.count()).toBe(0)
    land(t, [
      {
        key: 'm3',
        values: {
          From: 'Kenil <kenil@work.com>',
          To: 'Sam Ortiz <sam@grand.com>',
          Cc: 'kenil@work.com, Ana <ana@ruiz.com>',
          Date: days(10),
          Direction: 'sent',
        },
      },
    ])
    // the sender of a sent message is the person: never someone they know
    expect(
      world.people
        .list()
        .map((p) => p.name)
        .sort(),
    ).toEqual(['Ana', 'Sam Ortiz'])
    const sam = world.people.list().find((p) => p.name === 'Sam Ortiz')
    expect(sam?.count).toBe(2)
    expect(sam?.first).toBe('them')
    expect(world.people.contact(sam?.id as string).channels).toEqual([
      { channel: 'mail', count: 2 },
    ])
    expect(world.people.you().has('kenil@work.com')).toBe(true)
  })

  it('makes people of a small meeting, not of an all-hands', () => {
    // the person's own account is never someone they know
    world.connections.add('gmail', 'me@mine.com', null, 'Gmail', { actor: person })
    const t = events()
    const many = Array.from({ length: 25 }, (_, i) => `P${i} <p${i}@big.com>`).join(', ')
    land(t, [
      {
        key: 'e1',
        values: {
          Title: 'Intro',
          Starts: days(3),
          Attendees: 'me@mine.com, Lee <lee@z.io>, Bo <bo@z.io>',
        },
      },
      { key: 'e2', values: { Title: 'All hands', Starts: days(2), Attendees: many } },
    ])
    expect(
      world.people
        .list()
        .map((p) => p.name)
        .sort(),
    ).toEqual(['Bo', 'Lee'])
    expect(world.people.count('company')).toBe(1)
  })

  it('forgets someone it took for another once the address turns out to be the person’s own', () => {
    const e = events()
    land(e, [
      {
        key: 'e1',
        values: { Title: 'Sync', Starts: days(3), Attendees: 'K <kenil@work.com>, Lee <lee@z.io>' },
      },
    ])
    expect(
      world.people
        .list()
        .map((p) => p.name)
        .sort(),
    ).toEqual(['K', 'Lee'])
    const t = mail()
    land(t, [
      {
        key: 'm1',
        values: {
          From: 'Kenil <kenil@work.com>',
          To: 'lee@z.io',
          Date: days(1),
          Direction: 'sent',
        },
      },
    ])
    expect(world.people.list().map((p) => p.name)).toEqual(['Lee'])
    expect(world.people.list()[0]?.count).toBe(2)
  })
})

describe('the person themselves', () => {
  it('never makes the person one of their people, from their own card or a meeting', () => {
    const t = contacts()
    const m = world.shape.table(t.id) as Table
    world.shape.addFields(m.id, [{ name: 'Is you', kind: 'choice', choices: ['yes', 'no'] }], {
      actor: connector,
    })
    world.people.mapTable(
      t.id,
      { each: 'person', name: 'Name', emails: 'Emails', you: { field: 'Is you', is: 'yes' } },
      { actor: connector },
    )
    const e = events(true)
    land(e, [
      {
        key: 'e1',
        values: {
          Title: 'Intro',
          Starts: days(3),
          Attendees: 'Kenil <k@home.org>, Lee <lee@z.io>',
          Organizer: 'Lee <lee@z.io>',
        },
      },
      {
        key: 'e2',
        values: {
          Title: 'Follow-up',
          Starts: days(1),
          Attendees: 'kenil@work.com, Lee <lee@z.io>',
          Organizer: 'kenil@work.com',
          'Your address': 'kenil@work.com',
        },
      },
    ])
    expect(
      world.people
        .list()
        .map((p) => p.name)
        .sort(),
    ).toEqual(['Kenil', 'Lee'])
    land(t, [{ key: 'me', values: { Name: 'Kenil Shah', Emails: 'k@home.org', 'Is you': 'yes' } }])
    const lee = world.people.list()
    expect(lee.map((p) => p.name)).toEqual(['Lee'])
    expect(lee[0]?.count).toBe(2)
    // the first meeting Lee asked for; the person asked for the second
    expect(lee[0]?.first).toBe('them')
    expect(world.people.you()).toEqual(new Set(['k@home.org', 'kenil@work.com']))
  })
})

describe('the person’s word', () => {
  it('merges, unmerges, and never proposes a decided pair again', () => {
    const t = contacts()
    land(t, [
      { key: 'c1', values: { Name: 'Sam Ortiz', Emails: 'sam@grand.com' } },
      { key: 'c2', values: { Name: 'Sam Ortiz', Phones: '+1 415 555 0132' } },
    ])
    const a = world.people.byKey('email', 'sam@grand.com') as string
    const b = world.people.byKey('phone', '+14155550132') as string
    const one = world.people.merge(a, b, { actor: person })
    expect(world.people.count()).toBe(1)
    expect(one.keys).toEqual({ email: ['sam@grand.com'], phone: ['+14155550132'] })
    expect(world.people.byKey('phone', '+14155550132')).toBe(a)
    expect(() => world.people.merge(a, b, { actor: person })).toThrow(Refused)
    // a row landing again on the merged one keeps it merged
    land(t, [
      { key: 'c2', values: { Name: 'Sam Ortiz', Phones: '+1 415 555 0132, +1 415 555 0199' } },
    ])
    expect(world.people.count()).toBe(1)
    const alone = world.people.unmerge(b, { actor: person })
    expect(alone.keys).toEqual({ phone: ['+14155550132', '+14155550199'] })
    expect(world.people.get(a)?.keys).toEqual({ email: ['sam@grand.com'] })
    expect(world.people.pairs('apart')).toHaveLength(1)
    expect(world.lines({ kinds: ['people'] }).map((l) => l.words)).toEqual(
      expect.arrayContaining([
        'Sam Ortiz (sam@grand.com) and Sam Ortiz (+14155550132) are one person now.',
      ]),
    )
  })

  it('keeps the person’s own name over any a row gives', () => {
    const t = contacts()
    land(t, [{ key: 'c1', values: { Name: 'sam ortiz', Emails: 'sam@grand.com' } }])
    const id = world.people.byKey('email', 'sam@grand.com') as string
    world.people.name(id, 'Samuel Ortiz', { actor: person })
    land(t, [{ key: 'c1', values: { Name: 'S. Ortiz', Emails: 'sam@grand.com' } }])
    expect(world.people.get(id)?.name).toBe('Samuel Ortiz')
    // and the person's word keeps them when the row goes
    world.records.remove(t.id, [world.records.list(t.id)[0]?.id as string], { actor: person })
    expect(world.people.get(id)?.name).toBe('Samuel Ortiz')
  })
})

describe('likely ones', () => {
  it('puts the same names on one card, and never proposes a decided pair again', () => {
    const t = contacts()
    land(t, [
      { key: 'c1', values: { Name: 'Sam Ortiz', Emails: 'sam@grand.com' } },
      { key: 'c2', values: { Name: 'Sam Ortiz', Emails: 'sam.ortiz@grand.com' } },
      { key: 'c3', values: { Name: 'Ana Ruiz', Emails: 'ana@ruiz.com' } },
      { key: 'c4', values: { Name: 'ana ruiz', Emails: 'ana.r@gmail.com' } },
      { key: 'c5', values: { Name: 'Bo', Emails: 'bo@x.com' } },
      { key: 'c6', values: { Name: 'Bo', Emails: 'bo@y.com' } },
    ])
    const cards = world.cards.waiting().filter((c) => c.kind === 'match')
    expect(cards).toHaveLength(1)
    const card = cards[0]?.id as string
    let view = world.people.matchView(card)
    expect(
      view?.pairs.map((p) => [p.a.name.replace('ana', 'Ana').replace('ruiz', 'Ruiz'), p.why]),
    ).toEqual([
      ['Sam Ortiz', 'the same name and company'],
      ['Ana Ruiz', 'the same name'],
    ])
    expect(view?.samePlace).toBe(1)
    // a later batch joins the card that waits
    land(t, [{ key: 'c7', values: { Name: 'Lee Park', Emails: 'lee@a.com, lee@b.com' } }])
    land(t, [{ key: 'c8', values: { Name: 'Lee Park', Emails: 'lee@c.com' } }])
    expect(world.cards.waiting().filter((c) => c.kind === 'match')).toHaveLength(1)
    expect(world.people.matchView(card)?.open).toBe(3)

    view = world.people.mergeSamePlace(card, { actor: person })
    expect(view?.open).toBe(2)
    const ana = view?.pairs.find((p) => p.a.name.toLowerCase() === 'ana ruiz')?.id as string
    const lee = view?.pairs.find((p) => p.a.name === 'Lee Park')?.id as string
    world.people.decidePair(ana, false, { actor: person })
    expect(() => world.people.decidePair(ana, true, { actor: person })).toThrow(Refused)
    world.people.decidePair(lee, true, { actor: person })
    expect(world.cards.get(card)?.state).toBe('answered')
    expect(world.cards.get(card)?.answer).toBe('Merged 2, kept 1 apart')
    // the rows read again: nothing proposed anew
    land(t, [{ key: 'c4', values: { Name: 'Ana Ruiz', Emails: 'ana.r@gmail.com' } }])
    expect(world.cards.waiting().filter((c) => c.kind === 'match')).toHaveLength(0)
    // Sam and Lee one each, Ana two, the two Bos never proposed: a first name is no evidence
    expect(world.people.count()).toBe(6)
  })

  it('withdraws a card whose pairs became one another way', () => {
    const t = contacts()
    land(t, [
      { key: 'c1', values: { Name: 'Sam Ortiz', Emails: 'sam@grand.com' } },
      { key: 'c2', values: { Name: 'Sam Ortiz', Phones: '+1 415 555 0132' } },
    ])
    const card = world.cards.waiting().find((c) => c.kind === 'match')?.id as string
    expect(card).toBeTruthy()
    const a = world.people.byKey('email', 'sam@grand.com') as string
    const b = world.people.byKey('phone', '+14155550132') as string
    world.people.merge(a, b, { actor: person })
    world.people.settle()
    expect(world.cards.get(card)?.state).toBe('withdrawn')
  })
})

describe('people in the model’s reading', () => {
  it('reads people, companies, who works where and exchanges through views only', () => {
    const t = contacts()
    land(t, [
      {
        key: 'c1',
        values: { Name: 'Sam Ortiz', Emails: 'sam@grand.com', Company: 'Grand', Title: 'Broker' },
      },
      { key: 'c2', values: { Name: 'Sam O', Phones: '+1 415 555 0132' } },
    ])
    const m = mail()
    land(m, [
      {
        key: 'm1',
        values: { From: 'Me <me@mine.com>', To: 'sam@grand.com', Date: days(2), Direction: 'sent' },
      },
    ])
    world.people.merge(
      world.people.byKey('email', 'sam@grand.com') as string,
      world.people.byKey('phone', '+14155550132') as string,
      { actor: person },
    )
    expect(world.sql.query('SELECT name, emails, phones, companies FROM people').rows).toEqual([
      { name: 'Sam Ortiz', emails: 'sam@grand.com', phones: '+14155550132', companies: 'Grand' },
    ])
    expect(world.sql.query('SELECT name, domains, people FROM companies').rows).toEqual([
      { name: 'Grand', domains: 'grand.com', people: 1 },
    ])
    expect(world.sql.query('SELECT person_name, title FROM people_at').rows).toEqual([
      { person_name: 'Sam Ortiz', title: 'Broker' },
    ])
    expect(world.sql.query('SELECT name, channel, started_by, view FROM exchanges').rows).toEqual([
      { name: 'Sam Ortiz', channel: 'mail', started_by: 'you', view: 'mail' },
    ])
    expect(() => world.sql.query('SELECT * FROM main.people_keys')).toThrow(Refused)
  })
})

describe('one question per two people', () => {
  it('withdraws a pair that asks what another already asks, once a merge makes it so', () => {
    const t = contacts()
    land(t, [
      { key: 'c1', values: { Name: 'David Kim', Emails: 'dkim@summit.com' } },
      { key: 'c2', values: { Name: 'David Kim', Emails: 'david.kim@summit.com' } },
      { key: 'c3', values: { Name: 'David Kim', Emails: 'david@kimlowe.com' } },
    ])
    const card = world.cards.waiting().find((c) => c.kind === 'match')?.id as string
    expect(world.people.matchView(card)?.open).toBe(3)
    const summit = world.people
      .matchView(card)
      ?.pairs.find((p) => p.why === 'the same name and company')?.id as string
    world.people.decidePair(summit, true, { actor: person })
    expect(world.people.matchView(card)?.open).toBe(1)
  })
})

describe('people in the person’s modules', () => {
  it('holds one of their people in a person field, and lists the rows that name someone', () => {
    const c = contacts()
    land(c, [
      { key: 'c1', values: { Name: 'Sam Ortiz', Emails: 'sam@grand.com' } },
      { key: 'c2', values: { Name: 'Lee Park', Emails: 'lee@a.com' } },
      { key: 'c3', values: { Name: 'Lee Park', Emails: 'lee@b.com' } },
    ])
    const m = world.shape.makeModule('Deals', { actor: person })
    const t = world.shape.makeTable(
      m.id,
      'Deals',
      [
        { name: 'Name', kind: 'text' },
        { name: 'Broker', kind: 'person' },
        { name: 'Broker email', kind: 'email' },
      ],
      { actor: person },
    )
    const sam = world.people.byKey('email', 'sam@grand.com') as string
    land(t, [
      { key: 'd1', values: { Name: 'Coastal HVAC', Broker: 'Sam Ortiz' } },
      { key: 'd2', values: { Name: 'Fresno CPA', 'Broker email': 'SAM@grand.com' } },
    ])
    expect(
      world.records.list(t.id).find((r) => r.values.name === 'Coastal HVAC')?.values.broker,
    ).toBe(sam)
    expect(() => land(t, [{ key: 'd3', values: { Broker: 'Lee Park' } }])).toThrow(
      /2 of the person's people are called Lee Park/,
    )
    expect(() => land(t, [{ key: 'd4', values: { Broker: 'nobody@x.com' } }])).toThrow(Refused)
    expect(world.people.rowsNaming(sam).map((r) => r.field)).toEqual(['Broker', 'Broker email'])
    expect(world.people.names([sam])).toEqual({ [sam]: 'Sam Ortiz' })
  })
})

describe('the person’s other addresses and companies by their main domain', () => {
  it('takes someone as the person themselves, and names companies by their main domain', () => {
    const t = mail()
    land(t, [
      {
        key: 'm1',
        values: {
          From: 'Kenil <k@work.com>',
          To: 'kenil.other@gmail.com, Ana <ana@alerts.sbi.co.in>, Bo <bo@chase-global.com>',
          Date: days(1),
          Direction: 'sent',
        },
      },
    ])
    expect(world.people.list('company').map((c) => [c.name, c.domains])).toEqual([
      ['Chase Global', ['chase-global.com']],
      ['Sbi', ['sbi.co.in']],
    ])
    const other = world.people.byKey('email', 'kenil.other@gmail.com') as string
    expect(world.people.isYou(other, { actor: person })).toEqual(['kenil.other@gmail.com'])
    expect(
      world.people
        .list()
        .map((p) => p.name)
        .sort(),
    ).toEqual(['Ana', 'Bo'])
    expect(world.people.you().has('kenil.other@gmail.com')).toBe(true)
  })
})

describe('newer rules', () => {
  it('reads every row again, keeping ids, merges and the person’s word', async () => {
    const t = contacts()
    land(t, [
      { key: 'c1', values: { Name: 'Sam Ortiz', Emails: 'sam@mail.grand.com' } },
      { key: 'c2', values: { Name: 'Sam O', Phones: '+1 415 555 0132' } },
    ])
    const sam = world.people.byKey('email', 'sam@mail.grand.com') as string
    const phone = world.people.byKey('phone', '+14155550132') as string
    world.people.merge(sam, phone, { actor: person })
    world.people.name(sam, 'Samuel Ortiz', { actor: person })
    world.db.exec("UPDATE meta SET value = '1' WHERE key = 'people_rules'")
    world.db.exec("UPDATE people SET name = 'Old name' WHERE kind = 'company'")
    expect(world.people.keepRules({ actor: { kind: 'system' } })).toBe(true)
    expect(world.people.get(sam)?.name).toBe('Samuel Ortiz')
    expect(world.people.byKey('phone', '+14155550132')).toBe(sam)
    expect(world.people.list('company').map((c) => [c.name, c.domains])).toEqual([
      ['Grand', ['grand.com']],
    ])
    expect(world.people.keepRules({ actor: { kind: 'system' } })).toBe(false)
  })
})
