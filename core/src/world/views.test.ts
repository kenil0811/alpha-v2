// Saved views: kept by field id, given and mirrored by name, shared, journaled, removed with their
// table.
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Refused } from './kinds.ts'
import { World } from './world.ts'

let home: string
let world: World
const alpha = { kind: 'alpha' as const }
const person = { actor: { kind: 'person' as const, id: 'u_1' }, user: 'u_1' }

beforeEach(async () => {
  home = mkdtempSync(join(tmpdir(), 'alpha-views-'))
  world = await World.open(join(home, 'tenants', 't_test'))
})

afterEach(() => {
  world.close()
  rmSync(home, { recursive: true, force: true })
})

function deals() {
  const m = world.shape.makeModule('Deals desk', { actor: alpha })
  return world.shape.makeTable(
    m.id,
    'Deals',
    [
      { name: 'Name', kind: 'text' },
      { name: 'Asking price', kind: 'money' },
      { name: 'Stage', kind: 'choice', choices: ['New', 'Looking', 'Passed'] },
      { name: 'Listed on', kind: 'date' },
    ],
    { actor: alpha },
  )
}

describe('a saved view', () => {
  it('keeps its fields by id, shows them by name, and follows a renamed field', () => {
    const t = deals()
    const v = world.views.save(
      {
        table: t.id,
        name: 'Big ones',
        config: {
          filters: { rules: [{ field: 'Asking price', op: 'gt', value: 1000000 }] },
          sorts: [{ field: 'asking_price', dir: 'desc' }],
          totals: { 'Asking price': 'sum' },
        },
      },
      person,
    )
    const price = t.fields.find((f) => f.name === 'Asking price')?.id
    expect(v.config.filters.rules[0]?.field).toBe(price)
    expect(v.config.sorts[0]).toEqual({ field: price, dir: 'desc' })
    expect(v.config.totals).toEqual({ [price as string]: 'sum' })
    expect(v.madeBy).toBe('person')
    expect(world.lines({ kinds: ['view'] }).map((l) => l.words)).toEqual([
      'Made the view Big ones on Deals.',
    ])
    const yaml = readFileSync(join(t.module.dir, 'module.yaml'), 'utf8')
    expect(yaml).toContain('name: Big ones')
    expect(yaml).toContain('field: Asking price')
  })

  it('refuses a field that is not there, a name taken, and the table’s own name', () => {
    const t = deals()
    expect(() =>
      world.views.save({ table: t.id, name: 'X', config: { hidden: ['Revenue'] } }, person),
    ).toThrow(/Deals has no field called Revenue/)
    world.views.save({ table: t.id, name: 'Mine', config: {} }, person)
    expect(() => world.views.save({ table: t.id, name: 'mine', config: {} }, person)).toThrow(
      Refused,
    )
    expect(() => world.views.save({ table: t.id, name: 'All', config: {} }, person)).toThrow(
      /taken by the table itself/,
    )
  })

  it('gives a board its first choice when it names none, and keeps one default', () => {
    const t = deals()
    const board = world.views.save(
      { table: t.id, name: 'Pipeline', config: { kind: 'board' }, isDefault: true },
      person,
    )
    expect(board.config.group).toBe(t.fields.find((f) => f.name === 'Stage')?.id)
    const other = world.views.save(
      { table: t.id, name: 'Newest', config: {}, isDefault: true },
      person,
    )
    expect(world.views.list(t.id).map((v) => [v.name, v.isDefault])).toEqual([
      ['Pipeline', false],
      ['Newest', true],
    ])
    world.views.save({ table: t.id, id: other.id, name: 'Latest', config: {} }, person)
    expect(world.views.get(other.id)?.name).toBe('Latest')
  })

  it('keeps the columns frozen at the left and the ones that wrap, by name in module.yaml', () => {
    const t = deals()
    const v = world.views.save(
      { table: t.id, name: 'Wide', config: { frozen: 2, wrap: ['Stage', 'listed_on'] } },
      person,
    )
    const id = (name: string) => t.fields.find((f) => f.name === name)?.id
    expect(v.config.frozen).toBe(2)
    expect(v.config.wrap).toEqual([id('Stage'), id('Listed on')])
    const yaml = readFileSync(join(t.module.dir, 'module.yaml'), 'utf8')
    expect(yaml).toContain('frozen: 2')
    expect(yaml).toMatch(/wrap:\s+- Stage\s+- Listed on/)
    // a field taken away leaves the list's wrap with it
    world.shape.removeField(t.id, 'Stage', { actor: alpha })
    expect(world.views.get(v.id)?.config.wrap).toEqual([id('Listed on')])
    expect(
      world.views.save({ table: t.id, name: 'Plain', config: {} }, person).config,
    ).toMatchObject({ frozen: 1, wrap: [] })
  })

  it('goes with its table', () => {
    const t = deals()
    world.views.save({ table: t.id, name: 'Mine', config: {} }, person)
    world.shape.removeTable(t.id, { actor: alpha })
    expect(world.views.list(t.id)).toEqual([])
  })
})
