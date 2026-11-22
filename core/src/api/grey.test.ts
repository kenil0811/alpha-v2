// A grey value (estimated, assumed): ✓ accepts it as the person's own, ✕ empties it and keeps what
// was turned down, so a later guess of the same value is refused. Never the model, never a real tenant.
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Engine } from '../engine/engine.ts'
import { applyShape } from '../engine/tools/index.ts'
import { isPersonsOwn } from '../world/kinds.ts'
import { revert } from '../world/records/index.ts'
import type { Table } from '../world/shape/index.ts'
import { World } from '../world/world.ts'
import { buildServer } from './server.ts'

const alpha = { kind: 'alpha' as const }
const guess = { kind: 'estimated' as const, basis: 'about what last month was' }
const token = 'secret-token'
const headers = { host: '127.0.0.1:4700', 'x-alpha-token': token }
let home: string
let world: World
let engine: Engine
let table: Table
let row: string

beforeEach(async () => {
  home = mkdtempSync(join(tmpdir(), 'alpha-grey-'))
  world = await World.open(join(home, 'tenants', 't_test'))
  engine = new Engine(world)
  applyShape(
    world,
    {
      action: 'make_table',
      module: 'Shop',
      table: 'Orders',
      about: 'An order.',
      business_case: { for: 'The owner', keeps: 'Orders', decides: 'What to buy' },
      fields: [
        { name: 'Name', kind: 'text', about: 'Its name.' },
        { name: 'Bags', kind: 'number', about: 'How many bags.' },
      ],
    },
    { actor: alpha },
  )
  table = world.shape.table('Orders') as Table
  ;[row] = world.records.add(
    table.id,
    [{ values: { Name: 'Sugar', Bags: 40 }, provenance: guess }],
    {
      actor: alpha,
    },
  ) as [string]
})
afterEach(() => {
  engine.close()
  world.close()
  rmSync(home, { recursive: true, force: true })
})

async function grey(how: 'accept' | 'reject') {
  const a = buildServer({ engine, user: world.owner('Kenil'), token, ports: [4700] })
  const res = await a.inject({
    method: 'POST',
    url: `/api/tables/${table.id}/rows/${row}`,
    headers,
    payload: { field: 'Bags', grey: how },
  })
  await a.close()
  return res
}
const bags = () => world.records.list(table.id).find((r) => r.id === row)

describe('a grey value', () => {
  it('accepted becomes the person’s own and stays as it was', async () => {
    expect((await grey('accept')).statusCode).toBe(200)
    const r = bags()
    expect(r?.values.bags).toBe(40)
    expect(r?.provenance.bags?.kind).toBe('stated')
    expect(isPersonsOwn(r?.provenance.bags as never)).toBe(true)
  })

  it('turned down is emptied, and the same guess is refused afterwards, a different one is not', async () => {
    expect((await grey('reject')).statusCode).toBe(200)
    expect(bags()?.values.bags ?? null).toBeNull()
    const again = (v: number, p = guess) =>
      world.records.change(table.id, [{ id: row, values: { Bags: v }, provenance: p }], {
        actor: alpha,
      })
    expect(() => again(40)).toThrow(/turned down/)
    expect(() => again(40, { kind: 'assumed', basis: 'a habit' } as never)).toThrow(/turned down/)
    again(55)
    expect(bags()?.values.bags).toBe(55)
  })

  it('turned down goes with its row to the trash and back, and with its table for good', async () => {
    expect((await grey('reject')).statusCode).toBe(200)
    const person = { actor: { kind: 'person' as const, id: world.owner('Kenil').id } }
    const turned = () =>
      Number((world.db.prepare('SELECT count(*) AS n FROM turned_down').get() as { n: number }).n)
    // removing the row it is on: the row goes to the trash, and what was turned down with it
    world.records.remove(table.id, [row], person)
    expect(bags()).toBeUndefined()
    expect(turned()).toBe(0)
    // Bring back: the row, and the guess still turned down
    const line = world.lines({ kinds: ['removed'] }).at(-1)
    revert(world.records, { line: line?.id as number }, person, 'the removal')
    expect(bags()?.id).toBe(row)
    expect(turned()).toBe(1)
    expect(() =>
      world.records.change(table.id, [{ id: row, values: { Bags: 40 }, provenance: guess }], {
        actor: alpha,
      }),
    ).toThrow(/turned down/)
    // its table removed: gone for good, nothing left pointing at a row that is not there
    world.shape.removeTable(table.id, person)
    expect(turned()).toBe(0)
  })

  it('only a grey value can be accepted or turned down', async () => {
    await grey('accept')
    expect((await grey('reject')).statusCode).toBeGreaterThanOrEqual(400)
    expect(bags()?.values.bags).toBe(40)
  })
})
