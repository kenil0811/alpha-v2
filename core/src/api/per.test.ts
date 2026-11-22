// One row per person in People: the one-row-per-person tables of the module People
// lives in join People's grid, a person's page and the model's people view; a value typed for
// someone with no row yet makes their row.
import { appendFileSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, expect, it } from 'vitest'
import { Engine } from '../engine/engine.ts'
import { keepDefaults } from '../modules/defaults.ts'
import type { Module, Table } from '../world/shape/index.ts'
import { World } from '../world/world.ts'
import { buildServer } from './server.ts'
import type { KeptTable, ModuleView, PersonView } from './types.ts'

const alpha = { actor: { kind: 'alpha' as const } }
const system = { actor: { kind: 'system' as const } }
const looked = { kind: 'looked_up' as const, source: { url: 'https://example.com' } }
let home: string
let world: World
let engine: Engine
const token = 'secret-token'
const ok = { host: '127.0.0.1:4700', 'x-alpha-token': token }

beforeEach(async () => {
  home = mkdtempSync(join(tmpdir(), 'alpha-per-api-'))
  world = await World.open(join(home, 'tenants', 't_test'))
  engine = new Engine(world)
})
afterEach(() => {
  engine.close()
  world.close()
  rmSync(home, { recursive: true, force: true })
})

it('joins People, a person’s page and the people view, and a typed value makes the row', async () => {
  const m = world.shape.makeModule('Network', alpha)
  appendFileSync(join(m.dir, 'module.yaml'), 'people: true\n')
  const cards = world.shape.makeTable(
    m.id,
    'Cards',
    [
      { name: 'Name', kind: 'text' },
      { name: 'Email', kind: 'email' },
    ],
    alpha,
  )
  world.people.mapTable(cards.id, { each: 'person', name: 'Name', emails: 'Email' }, alpha)
  world.records.add(
    cards.id,
    [
      { values: { Name: 'Ann Lee', Email: 'ann@lee.example' }, provenance: looked },
      { values: { Name: 'Bo Chu', Email: 'bo@chu.example' }, provenance: looked },
    ],
    alpha,
  )
  const id = (n: string) => (world.people.list('person', n)[0] as { id: string }).id
  const tiers = world.shape.makeTable(
    m.id,
    'Tiers',
    [
      { name: 'Person', kind: 'person', per: 'person' },
      { name: 'Tier', kind: 'choice', choices: ['Gold', 'Silver'] },
      { name: 'Name', kind: 'text' }, // clashes with People's own Name
    ],
    alpha,
  ) as Table
  world.records.add(
    tiers.id,
    [{ values: { Person: id('Ann Lee'), Tier: 'Gold' }, provenance: looked }],
    alpha,
  )
  const a = buildServer({ engine, user: world.owner('Kenil'), token, ports: [4700] })
  const people = (await a.inject({ url: '/api/kept/people', headers: ok })).json() as KeptTable
  expect(people.fields.slice(6).map((f) => f.name)).toEqual(['Tier', 'Tiers · Name'])
  expect(people.kept?.editable).toEqual(['Name', 'Tier', 'Tiers · Name'])
  const tier = people.fields[6]?.slug as string
  expect(people.rows.map((r) => [r.values.name, r.values[tier]])).toEqual([
    ['Ann Lee', 'Gold'],
    ['Bo Chu', null],
  ])
  // Bo has no row yet: typing his tier makes it
  const bo = id('Bo Chu')
  await a.inject({
    method: 'POST',
    url: `/api/kept/people/rows/${bo}`,
    headers: ok,
    payload: { field: 'Tier', value: 'Silver' },
  })
  expect(world.records.list(tiers.id).map((r) => r.values.tier)).toEqual(['Gold', 'Silver'])
  expect(world.records.list(tiers.id)[1]?.provenance.tier?.kind).toBe('stated')
  // and on his page, changed there too
  const page = (await a.inject({ url: `/api/people/${bo}`, headers: ok })).json() as PersonView
  expect(
    page.per.map((p) => [p.table.name, p.fields.map((f) => f.name), p.row?.values.tier]),
  ).toEqual([['Tiers', ['Tier', 'Name'], 'Silver']])
  await a.inject({
    method: 'POST',
    url: `/api/people/${bo}/per/${tiers.id}`,
    headers: ok,
    payload: { field: 'Tier', value: 'Gold' },
  })
  expect(world.sql.query('SELECT name, tier, tiers_name FROM people ORDER BY name').rows).toEqual([
    { name: 'Ann Lee', tier: 'Gold', tiers_name: null },
    { name: 'Bo Chu', tier: 'Gold', tiers_name: null },
  ])
  // the table is People's columns, not a tab of its own, and the start layer says so
  const mod = (await a.inject({ url: `/api/modules/${m.id}`, headers: ok })).json() as ModuleView
  expect(mod.tables.map((t) => [t.name, t.place])).toEqual([
    ['Cards', 'main'],
    ['Tiers', 'people'],
  ])
  await a.close()
})

it('adds a property in place on People and on Organizations, each its own, and writes a value', async () => {
  // Alpha's own People, which Alpha manages (rules M2): the person's + is its one exception
  await keepDefaults(world, system)
  const m = world.shape.ownModule('People') as Module
  const cards = world.shape.makeTable(
    m.id,
    'Cards',
    [
      { name: 'Name', kind: 'text' },
      { name: 'Email', kind: 'email' },
      { name: 'Company', kind: 'text' },
    ],
    system,
  )
  world.people.mapTable(
    cards.id,
    { each: 'person', name: 'Name', emails: 'Email', company: 'Company' },
    system,
  )
  world.records.add(
    cards.id,
    [
      {
        values: { Name: 'Ann Lee', Email: 'ann@lee.example', Company: 'Acme' },
        provenance: looked,
      },
    ],
    alpha,
  )
  const a = buildServer({ engine, user: world.owner('Kenil'), token, ports: [4700] })
  const add = (list: string, name: string) =>
    a.inject({
      method: 'POST',
      url: `/api/kept/${list}/fields`,
      headers: ok,
      payload: { name, kind: 'text' },
    })
  expect((await add('people', 'Nickname')).statusCode).toBe(200)
  expect((await add('organizations', 'Tier')).statusCode).toBe(200)
  const get = async (list: string) =>
    (await a.inject({ url: `/api/kept/${list}`, headers: ok })).json() as KeptTable
  let people = await get('people')
  let orgs = await get('organizations')
  expect(people.fields.slice(6).map((f) => f.name)).toEqual(['Nickname'])
  expect(orgs.fields.slice(3).map((f) => f.name)).toEqual(['Tier'])
  expect(orgs.kept?.editable).toEqual(['Name', 'Tier'])
  const post = (list: string, id: string, field: string, value: string) =>
    a.inject({
      method: 'POST',
      url: `/api/kept/${list}/rows/${id}`,
      headers: ok,
      payload: { field, value },
    })
  const ann = people.rows[0]?.id as string
  const acme = orgs.rows[0]?.id as string
  await post('people', ann, 'Nickname', 'Annie')
  await post('organizations', acme, 'Tier', 'Gold')
  people = await get('people')
  orgs = await get('organizations')
  expect(people.rows[0]?.values[people.fields[6]?.slug as string]).toBe('Annie')
  expect(orgs.rows[0]?.values[orgs.fields[3]?.slug as string]).toBe('Gold')
  // a second property goes into the table made the first time, found by its lasting key
  await add('people', 'Notes2')
  const details = world.shape.ownTable(m.id, 'People details')
  expect(details?.fields.map((f) => f.name)).toEqual(['Person', 'Nickname', 'Notes2'])
  // the exception is the person's, in those two tables alone: not Alpha's tool, not another table
  const person = { actor: { kind: 'person' as const, id: world.owner('Kenil').id } }
  expect(() =>
    world.shape.addFields(details?.id as string, [{ name: 'Guess', kind: 'text' }], alpha),
  ).toThrow(/managed by Alpha/)
  expect(() =>
    world.shape.makeTable(
      m.id,
      'Tiers',
      [{ name: 'Person', kind: 'person', per: 'person' }],
      person,
    ),
  ).toThrow(/managed by Alpha/)
  await a.close()
})

it('names an organization in a per-organization field by its id, its domain or a name only it has', () => {
  const m = world.shape.makeModule('Network', alpha)
  const cards = world.shape.makeTable(
    m.id,
    'Cards',
    [
      { name: 'Name', kind: 'text' },
      { name: 'Email', kind: 'email' },
      { name: 'Company', kind: 'text' },
    ],
    alpha,
  )
  world.people.mapTable(
    cards.id,
    { each: 'person', name: 'Name', emails: 'Email', company: 'Company' },
    alpha,
  )
  world.records.add(
    cards.id,
    [
      {
        values: { Name: 'Ann Lee', Email: 'ann@acme.example', Company: 'Acme' },
        provenance: looked,
      },
    ],
    alpha,
  )
  const orgs = world.shape.makeTable(
    m.id,
    'Accounts',
    [
      { name: 'Organization', kind: 'person', per: 'company' },
      { name: 'Tier', kind: 'text' },
    ],
    alpha,
  )
  const acme = (world.people.list('company', 'Acme')[0] as { id: string }).id
  world.records.add(
    orgs.id,
    [{ values: { Organization: 'Acme', Tier: 'Gold' }, provenance: looked }],
    alpha,
  )
  expect(world.records.list(orgs.id)[0]?.values.organization).toBe(acme)
  expect(() =>
    world.records.add(
      orgs.id,
      [{ values: { Organization: 'Nobody Inc' }, provenance: looked }],
      alpha,
    ),
  ).toThrow(/No organization called Nobody Inc/)
  // turned off and on again, it stays one row per organization
  world.shape.setPer(orgs.id, 'Organization', false, alpha)
  world.shape.setPer(orgs.id, 'Organization', 'company', alpha)
  expect(world.shape.table(orgs.id)?.fields[0]?.per).toBe('company')
})
