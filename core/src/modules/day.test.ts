// A person's day for Home (ui-rules O1, L14): the meetings in Alpha's own Calendar that touch it,
// from no one else's calendar, and the open tasks due that day, in the person's own day.
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { calendar } from '@alpha/connector-mac'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { landIn } from '../connectors/places.ts'
import { World } from '../world/world.ts'
import { theDay } from './day.ts'
import { keepDefaults } from './defaults.ts'

let home: string
let world: World

beforeEach(async () => {
  home = mkdtempSync(join(tmpdir(), 'alpha-day-'))
  world = await World.open(join(home, 'tenants', 't_test'))
  await keepDefaults(world, { actor: { kind: 'system' } })
})
afterEach(() => {
  world.close()
  rmSync(home, { recursive: true, force: true })
})

// 17 Nov in a place six hours behind UTC
const day = { date: '2026-11-17', from: '2026-11-17T06:00:00Z', to: '2026-11-18T06:00:00Z' }

describe('a person’s day', () => {
  it('holds the meetings that touch it, in order, and the open tasks due that day', () => {
    const owner = world.owner('Kenil').id
    const [events] = landIn(world, calendar)
    const at = (account: string) => ({ connector: 'calendar', account })
    const land = (account: string, key: string, values: Record<string, unknown>) =>
      world.records.land(events?.id ?? '', [{ key, values }], at(account), {
        actor: { kind: 'connector', id: 'calendar' },
      })
    land('This Mac', 'e1', {
      Title: 'Harbor call',
      Starts: '2026-11-17T16:30:00Z',
      Ends: '2026-11-17T17:00:00Z',
    })
    land('This Mac', 'e2', {
      Title: 'Standup',
      Starts: '2026-11-17T15:00:00Z',
      Ends: '2026-11-17T15:15:00Z',
    })
    land('This Mac', 'e3', {
      Title: 'Offsite',
      Starts: '2026-11-17',
      Ends: '2026-11-19',
      'All day': 'yes',
    })
    // late tonight here is tomorrow in UTC, and still today; early this morning UTC was yesterday
    land('This Mac', 'e4', { Title: 'Late call', Starts: '2026-11-18T03:00:00Z' })
    land('This Mac', 'e5', {
      Title: 'Yesterday',
      Starts: '2026-11-17T05:00:00Z',
      Ends: '2026-11-17T05:30:00Z',
    })
    land('This Mac', 'e6', { Title: 'Last week', Starts: '2026-11-10', 'All day': 'yes' })
    // a colleague's calendar is theirs
    const other = world.accounts.add('Vikas', 'vikas@example.com', {
      actor: { kind: 'person', id: owner },
    })
    world.connections.add('calendar', 'Vikas’s Mac', null, 'Calendar', {
      actor: { kind: 'person', id: other.id },
    })
    land('Vikas’s Mac', 'e7', { Title: 'Vikas only', Starts: '2026-11-17T18:00:00Z' })
    const person = { actor: { kind: 'person' as const, id: owner }, user: owner }
    world.tasks.add({ title: 'Send tax forms', due: '2026-11-17' }, person)
    world.tasks.add({ title: 'Call the bank', due: '2026-11-17T20:00:00Z' }, person)
    world.tasks.add({ title: 'Late', due: '2026-11-16' }, person)
    const done = world.tasks.add({ title: 'Done already', due: '2026-11-17' }, person)
    world.tasks.setState(done.id, 'done', person)

    const out = theDay(world, owner, day)
    expect(out.events.map((e) => [e.title, e.allDay])).toEqual([
      ['Offsite', true],
      ['Standup', false],
      ['Harbor call', false],
      ['Late call', false],
    ])
    expect(out.tasks.map((t) => [t.title, t.timed])).toEqual([
      ['Send tax forms', false],
      ['Call the bank', true],
    ])
    // the colleague sees their own; the owner none of it
    expect(theDay(world, other.id, day).events.map((e) => e.title)).toContain('Vikas only')
    expect(out.events.map((e) => e.title)).not.toContain('Vikas only')
  })
})
