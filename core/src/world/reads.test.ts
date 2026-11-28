// A module names the modules it reads, and a change that would break one asks first (the
// definitions, 27 Nov, call 9): by any door, on a card the person answers.
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { BrowserEngine } from '@alpha/connector-sdk'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { parse } from 'yaml'
import { ScheduleRunner } from '../modules/runs/index.ts'
import { readersOf, readsOf, setReads } from './reads.ts'
import type { Module } from './shape/index.ts'
import { redo } from './shape/index.ts'
import { World } from './world.ts'

let home: string
let world: World
let listings: Module
let pipeline: Module
const person = { actor: { kind: 'person' as const, id: 'u_1' }, user: 'u_1' }

beforeEach(async () => {
  home = mkdtempSync(join(tmpdir(), 'alpha-reads-'))
  world = await World.open(join(home, 'tenants', 't_test'))
  world.owner('Kenil')
  listings = world.shape.makeModule('Listings', person)
  world.shape.makeTable(
    listings.id,
    'Deals',
    [
      { name: 'Name', kind: 'text' },
      { name: 'Price', kind: 'number' },
    ],
    person,
  )
  world.shape.makeTable(listings.id, 'Brokers', [{ name: 'Name', kind: 'text' }], person)
  pipeline = world.shape.makeModule('Pipeline', person)
  world.shape.makeTable(pipeline.id, 'Stages', [{ name: 'Name', kind: 'text' }], person)
})

afterEach(() => {
  world.close()
  rmSync(home, { recursive: true, force: true })
})

describe('a module that reads another', () => {
  it('names what it reads in its module.yaml, and each side shows the other', () => {
    expect(setReads(world, pipeline, listings, ['Deals'], person)).toBe(
      'Pipeline reads Deals of Listings.',
    )
    const yaml = parse(readFileSync(join(pipeline.dir, 'module.yaml'), 'utf8'))
    expect(yaml.uses).toEqual([{ module: 'Listings', tables: ['Deals'] }])
    expect(readsOf(world, pipeline)).toEqual([
      { module: expect.objectContaining({ id: listings.id }), name: 'Listings', tables: ['Deals'] },
    ])
    expect(readersOf(world, listings).map((r) => [r.module.name, r.tables])).toEqual([
      ['Pipeline', ['Deals']],
    ])
    expect(() => setReads(world, pipeline, listings, ['Sellers'], person)).toThrow(
      /Listings has no table called Sellers/,
    )
    setReads(world, pipeline, listings, [], person)
    expect(readsOf(world, pipeline)).toEqual([])
  })

  it('lets its scripts read what it names, and nothing else of another module', async () => {
    const runner = new ScheduleRunner(world, () => ({}) as unknown as BrowserEngine, {
      owner: 'u_1',
    })
    mkdirSync(join(pipeline.dir, 'scripts'), { recursive: true })
    writeFileSync(
      join(pipeline.dir, 'scripts', 'count.js'),
      "export default async (alpha) => ({ words: `${(await alpha.rows.list('Deals')).length} deals` })\n",
    )
    const tryIt = () => runner.runScript(pipeline, 'scripts/count.js', {}, 'Count', null)
    expect((await tryIt()).words).toMatch(/may not read Deals/)
    setReads(world, pipeline, listings, ['Deals'], person)
    expect((await tryIt()).words).toBe('Count: 0 deals')
  })

  it('puts a change that would break it on a card first, by any door, and does it on the person’s word', () => {
    setReads(world, pipeline, listings, ['Deals'], person)
    const deals = world.shape.table('Deals') as { id: string }
    expect(() => world.shape.rename({ table: deals.id }, 'Listings', person)).toThrow(
      /Pipeline reads Deals, so this change is on a card for the person/,
    )
    expect(() => world.shape.removeField(deals.id, 'Price', person)).toThrow(/Pipeline reads Deals/)
    expect(world.shape.table('Deals')?.fields.map((f) => f.name)).toContain('Price')
    const card = world.cards.waiting('u_1').find((c) => c.call?.tool === 'read_by_shape')
    expect(card?.words).toMatch(/^Pipeline reads Deals: to .* may stop its scripts working/)
    expect(card?.options).toEqual(['Do it now anyway', 'Leave it'])
    // its Do it now anyway: the same change, made on the person's word
    redo(world.shape, card?.call?.input as never, { ...person, anyway: true })
    // what nobody reads changes as before
    const brokers = world.shape.table('Brokers') as { id: string }
    expect(world.shape.rename({ table: brokers.id }, 'Agents', person).name).toBe('Agents')
  })
})
