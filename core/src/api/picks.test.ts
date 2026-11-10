// Picking a related row or a person from the window (Batch B, 14b): the one-cell route takes a row
// id for a relation and a person id for a person field, the world checks each is there, and the
// journal names what was picked. Files, and many rows at once, stay with Alpha.
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Engine } from '../engine/engine.ts'
import type { Table } from '../world/shape/index.ts'
import { World } from '../world/world.ts'
import { buildServer } from './server.ts'
import type { HistoryView, Pick, TableView } from './types.ts'

const alpha = { actor: { kind: 'alpha' as const } }
const looked = { kind: 'looked_up' as const, source: { url: 'https://example.com' } }
const token = 'secret-token'
const ok = { host: '127.0.0.1:4700', 'x-alpha-token': token }
let home: string
let world: World
let engine: Engine
let orders: Table
let suppliers: Table
let mill: string
let dairy: string
let order: string

beforeEach(async () => {
  home = mkdtempSync(join(tmpdir(), 'alpha-picks-'))
  world = await World.open(join(home, 'tenants', 't_test'))
  engine = new Engine(world)
  const m = world.shape.makeModule('Bakery', alpha)
  suppliers = world.shape.makeTable(
    m.id,
    'Suppliers',
    [
      { name: 'Name', kind: 'text' },
      { name: 'Email', kind: 'email' },
    ],
    alpha,
  )
  world.people.mapTable(suppliers.id, { each: 'person', name: 'Name', emails: 'Email' }, alpha)
  ;[mill, dairy] = world.records.add(
    suppliers.id,
    [
      { values: { Name: 'Mill & Co', Email: 'mill@example.com' }, provenance: looked },
      { values: { Name: 'Dairy Farm', Email: 'dairy@example.com' }, provenance: looked },
    ],
    alpha,
  ) as [string, string]
  orders = world.shape.makeTable(
    m.id,
    'Orders',
    [
      { name: 'Item', kind: 'text' },
      { name: 'Supplier', kind: 'relation', relatesTo: suppliers.id },
      { name: 'Backups', kind: 'relation', relatesTo: suppliers.id, many: true },
      { name: 'Buyer', kind: 'person' },
      { name: 'Invoice', kind: 'file' },
    ],
    alpha,
  )
  ;[order] = world.records.add(
    orders.id,
    [{ values: { Item: 'Flour', Supplier: mill }, provenance: looked }],
    alpha,
  ) as [string]
})

afterEach(() => {
  engine.close()
  world.close()
  rmSync(home, { recursive: true, force: true })
})

const app = () => buildServer({ engine, user: world.owner('Kenil'), token, ports: [4700] })
const set = (a: ReturnType<typeof app>, field: string, value: unknown) =>
  a.inject({
    method: 'POST',
    url: `/api/tables/${orders.id}/rows/${order}`,
    headers: ok,
    payload: { field, value },
  })

describe('a picked related row', () => {
  it('is set by its id, the journal naming it, and History keeps the one before', async () => {
    const a = app()
    expect((await set(a, 'Supplier', dairy)).statusCode).toBe(200)
    expect(world.records.get(order)?.record.values.supplier).toBe(dairy)
    expect(world.lines({ kinds: ['changed'] }).at(-1)?.words).toBe(
      'Set Supplier to Dairy Farm on Flour',
    )
    const history = (
      await a.inject({
        url: `/api/tables/${orders.id}/rows/${order}/history?field=supplier`,
        headers: ok,
      })
    ).json() as HistoryView[]
    expect(history.map((h) => h.value)).toEqual([dairy, mill])
    // the table names both, so History reads names, not ids
    const view = (
      await a.inject({ url: `/api/tables/${orders.id}`, headers: ok })
    ).json() as TableView
    expect([view.names[dairy], view.names[mill]]).toEqual(['Dairy Farm', 'Mill & Co'])
    expect(view.fields.find((f) => f.name === 'Supplier')?.relatesTo).toBe(suppliers.id)
    // its shape alone, for the window to draw while the rows come (Kenil, 10 Nov)
    const shape = (
      await a.inject({ url: `/api/tables/${orders.id}?rows=none`, headers: ok })
    ).json() as TableView
    expect(shape.fields.map((f) => f.name)).toEqual(view.fields.map((f) => f.name))
    expect(shape.rows).toEqual([])
    expect(view.rows.length).toBeGreaterThan(0)
    await a.close()
  })

  it('takes a list for a relation that holds several, and clears one with nothing', async () => {
    const a = app()
    await set(a, 'Backups', [mill, dairy])
    expect(world.records.get(order)?.record.values.backups).toEqual([mill, dairy])
    expect(world.lines({ kinds: ['changed'] }).at(-1)?.words).toBe(
      'Set Backups to Mill & Co, Dairy Farm on Flour',
    )
    await set(a, 'Supplier', null)
    expect(world.records.get(order)?.record.values.supplier ?? null).toBeNull()
    expect(world.lines({ kinds: ['changed'] }).at(-1)?.words).toBe('Cleared Supplier on Flour')
    await a.close()
  })

  it('is refused when the row is not there, and leaves no line saying it was set', async () => {
    const a = app()
    const before = world.lines({ kinds: ['changed'] }).length
    const res = await set(a, 'Supplier', 'r_gone')
    expect(res.statusCode).toBe(409)
    expect(res.json().problem).toBe('Supplier points at a row of Suppliers that is not there.')
    // a row of another table is not one of Suppliers either
    expect((await set(a, 'Supplier', order)).statusCode).toBe(409)
    expect(world.lines({ kinds: ['changed'] })).toHaveLength(before)
    expect(world.records.get(order)?.record.values.supplier).toBe(mill)
    await a.close()
  })

  it('is offered from every row of the table it points at, by name', async () => {
    const a = app()
    const picks = (
      await a.inject({ url: `/api/tables/${suppliers.id}/names`, headers: ok })
    ).json() as Pick[]
    expect(picks).toEqual([
      { id: dairy, name: 'Dairy Farm', hint: null },
      { id: mill, name: 'Mill & Co', hint: null },
    ])
    await a.close()
  })
})

describe('a picked person', () => {
  it('is set by their id and named in the journal; one not there is refused', async () => {
    const a = app()
    const people = (await a.inject({ url: '/api/people/names', headers: ok })).json() as Pick[]
    // each with where they work (here read from their addresses), else their address
    expect(people.map((p) => [p.name, p.hint])).toEqual([
      ['Dairy Farm', 'Example'],
      ['Mill & Co', 'Example'],
    ])
    const dairyPerson = (people[0] as Pick).id
    expect((await set(a, 'Buyer', dairyPerson)).statusCode).toBe(200)
    expect(world.records.get(order)?.record.values.buyer).toBe(dairyPerson)
    expect(world.lines({ kinds: ['changed'] }).at(-1)?.words).toBe(
      'Set Buyer to Dairy Farm on Flour',
    )
    expect((await set(a, 'Buyer', 'p_gone')).statusCode).toBe(409)
    expect(world.records.get(order)?.record.values.buyer).toBe(dairyPerson)
    await a.close()
  })
})

describe('what stays with Alpha', () => {
  it('a file, and a relation set on many rows at once', async () => {
    const a = app()
    expect((await set(a, 'Invoice', 'abc')).json().problem).toBe(
      'Invoice is set by asking Alpha, not from here.',
    )
    const many = await a.inject({
      method: 'POST',
      url: `/api/tables/${orders.id}/rows/many`,
      headers: ok,
      payload: { set: [{ row: order, values: { Supplier: dairy } }], add: [] },
    })
    expect(many.json().problem).toBe('Supplier is set by asking Alpha, not from here.')
    await a.close()
  })
})
