import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Refused } from './kinds.ts'
import { nextDue, readRepeat } from './tasks.ts'
import { World } from './world.ts'

let home: string
let world: World
const person = { kind: 'person' as const, id: 'u_test' }
const alpha = { kind: 'alpha' as const }

beforeEach(async () => {
  home = mkdtempSync(join(tmpdir(), 'alpha-tasks-'))
  world = await World.open(join(home, 'tenants', 't_test'))
})

afterEach(() => {
  world.close()
  rmSync(home, { recursive: true, force: true })
})

function deals() {
  const m = world.shape.makeModule('DealPilot', { actor: alpha })
  const t = world.shape.makeTable(
    m.id,
    'Deals',
    [
      { name: 'Name', kind: 'text' },
      { name: 'Asking price', kind: 'money' },
    ],
    { actor: alpha },
  )
  world.records.land(
    t.id,
    [{ key: 'd1', values: { Name: 'Coastal HVAC' } }],
    { connector: 'test' },
    { actor: alpha },
  )
  return { m, t, row: world.records.list(t.id)[0]?.id as string }
}

describe('repeats in words', () => {
  it('reads the ways people say a repeat, and refuses the rest', () => {
    expect(readRepeat('every Monday')).toEqual({ unit: 'week', every: 1, weekday: 1 })
    expect(readRepeat('every 2 weeks')).toEqual({ unit: 'week', every: 2 })
    expect(readRepeat('on the 1st of each month')).toEqual({ unit: 'month', every: 1, monthday: 1 })
    expect(readRepeat('every weekday')).toEqual({ unit: 'weekday', every: 1 })
    expect(() => readRepeat('now and then')).toThrow(Refused)
  })

  it('finds the next due day', () => {
    expect(nextDue(readRepeat('every Monday'), '2026-10-21')).toBe('2026-10-26')
    expect(nextDue(readRepeat('every weekday'), '2026-10-23')).toBe('2026-10-26')
    expect(nextDue(readRepeat('on the 31st of each month'), '2026-10-31')).toBe('2026-11-30')
    expect(nextDue(readRepeat('every 2 weeks'), '2026-10-21')).toBe('2026-11-04')
  })
})

describe('tasks', () => {
  it('sits on the place it concerns and says it in words', () => {
    const { t, row } = deals()
    const k = world.tasks.add(
      {
        title: 'Ask the broker for three years of P&L',
        on: { table: 'Deals', row, field: 'Asking price' },
        due: '2026-10-24',
      },
      { actor: person, user: 'u_test' },
    )
    expect(k.place.table).toBe(t.id)
    expect(k.owner).toEqual({ kind: 'person', id: 'u_test' })
    expect(world.tasks.placeWords(k.place, (_t, r) => (r === row ? 'Coastal HVAC' : 'a row'))).toBe(
      'DealPilot › Deals › Coastal HVAC › Asking price',
    )
    expect(world.tasks.list({ on: { ...k.place, field: null } }).map((x) => x.id)).toEqual([k.id])
    expect(() =>
      world.tasks.add({ title: 'x', on: { table: 'Deals', field: 'Nope' } }, { actor: person }),
    ).toThrow(/no field called Nope/)
    expect(world.lines({ kinds: ['task'] }).at(-1)?.words).toBe(
      'Added a task: Ask the broker for three years of P&L, on DealPilot › Deals › a row › Asking price, due Sat 24 Oct.',
    )
  })

  it('finds an open task with most of the same words on the same place', () => {
    const { row } = deals()
    const on = world.tasks.resolvePlace({ table: 'Deals', row })
    world.tasks.add(
      { title: 'Ask broker for P&L statements', on: { table: 'Deals', row } },
      {
        actor: person,
      },
    )
    expect(world.tasks.similar('ask the broker for the P&L statements', on)).toHaveLength(1)
    expect(world.tasks.similar('Book a site visit', on)).toHaveLength(0)
  })

  it('makes the next of a repeating task once, when it is done', () => {
    const k = world.tasks.add(
      { title: 'Review the pipeline', due: '2026-10-19', repeat: 'every Monday' },
      { actor: person },
    )
    world.tasks.setState(k.id, 'done', { actor: person })
    world.tasks.setState(k.id, 'todo', { actor: person })
    world.tasks.setState(k.id, 'done', { actor: person })
    const all = world.tasks.list().filter((x) => x.title === 'Review the pipeline')
    expect(all).toHaveLength(2)
    const next = all.find((x) => x.id !== k.id)
    // a long-missed repeat starts again near today, never in the past
    expect(Date.parse(next?.due as string)).toBeGreaterThan(Date.now() - 2 * 86_400_000)
    expect(next?.state).toBe('todo')
  })

  it('reminds once when the time comes, and only an open task', () => {
    const soon = new Date(Date.now() - 60_000).toISOString()
    const k = world.tasks.add({ title: 'Call Sam', remindAt: soon }, { actor: person })
    world.tasks.add({ title: 'Already done', remindAt: soon }, { actor: person })
    const done = world.tasks.list().find((x) => x.title === 'Already done')?.id as string
    world.tasks.setState(done, 'done', { actor: person })
    const told: string[] = []
    world.tasks.tick(Date.now(), { actor: { kind: 'system' } }, (t) => told.push(t.title))
    world.tasks.tick(Date.now(), { actor: { kind: 'system' } }, (t) => told.push(t.title))
    expect(told).toEqual(['Call Sam'])
    expect(world.tasks.get(k.id)?.remindedAt).toBeTruthy()
    expect(world.lines({ kinds: ['reminder'] }).map((l) => l.words)).toEqual([
      'Reminder: Call Sam.',
    ])
  })

  it('removes a task with the ones beneath it, and knows the person’s own', () => {
    const parent = world.tasks.add({ title: 'Close the deal' }, { actor: person })
    world.tasks.add({ title: 'Sign the LOI', parent: parent.id }, { actor: alpha })
    const mine = world.tasks.add({ title: 'Alpha’s own' }, { actor: alpha })
    expect(world.tasks.personsOwn([parent.id])).toBe(true)
    expect(world.tasks.personsOwn([mine.id])).toBe(false)
    expect(() => world.tasks.change(parent.id, { parent: parent.id }, { actor: person })).toThrow(
      /under itself/,
    )
    expect(world.tasks.remove([parent.id], { actor: person })).toBe(2)
    expect(world.tasks.list().map((x) => x.title)).toEqual(['Alpha’s own'])
  })

  it('is read in the model’s view tasks', () => {
    const { row } = deals()
    world.tasks.add(
      { title: 'Ask for P&L', on: { table: 'Deals', row }, priority: 'high' },
      { actor: person },
    )
    expect(
      world.sql.query('SELECT title, state, priority, owner, module, table_name FROM tasks').rows,
    ).toEqual([
      {
        title: 'Ask for P&L',
        state: 'To do',
        priority: 'high',
        owner: 'the person',
        module: 'DealPilot',
        table_name: 'Deals',
      },
    ])
  })
})
