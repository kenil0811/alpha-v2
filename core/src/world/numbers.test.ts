import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { bringBack } from './records/trash.ts'
import { atNumber, moduleNumber, numbers, rowNumber, tableNumber } from './shape/numbers.ts'
import { World } from './world.ts'

let home: string
let world: World
const alpha = { actor: { kind: 'alpha' as const } }

beforeEach(async () => {
  home = mkdtempSync(join(tmpdir(), 'alpha-numbers-'))
  world = await World.open(join(home, 'tenants', 't_test'))
})

afterEach(() => {
  world.close()
  rmSync(home, { recursive: true, force: true })
})

const db = () => world.db
const table = (module: string, name: string) =>
  world.shape.makeTable(module, name, [{ name: 'Name', kind: 'text' }], alpha)
const rows = (t: string, ...names: string[]) => {
  const owner = world.owner('Kenil')
  const line = world.line({
    actor: { kind: 'person', id: owner.id },
    kind: 'said',
    words: names.join(', '),
    user: owner.id,
  })
  return world.records.add(
    t,
    names.map((Name) => ({ values: { Name }, provenance: { kind: 'stated' as const } })),
    { ...alpha, said: { message: line.id, user: owner.id } },
  )
}

describe('numbers', () => {
  it('gives each module, table and row its address, a module inside another counting with its tables', () => {
    const sales = world.shape.makeModule('Sales', alpha)
    const top = Number(moduleNumber(db(), sales.id))
    const deals = table(sales.id, 'Deals')
    const leads = table(sales.id, 'Leads')
    const desk = world.shape.makeModule('Desk', alpha)
    world.shape.place(desk.id, sales.id, alpha)
    const calls = table(desk.id, 'Calls')
    const [, second] = rows(leads.id, 'Acme', 'Bolt')

    expect(tableNumber(db(), deals.id)).toBe(`${top}.1`)
    expect(tableNumber(db(), leads.id)).toBe(`${top}.2`)
    expect(moduleNumber(db(), desk.id)).toBe(`${top}.3`)
    expect(tableNumber(db(), calls.id)).toBe(`${top}.3.1`)
    expect(rowNumber(db(), second as string)).toBe(`${top}.2.2`)
    expect(atNumber(db(), `${top}.2.2`)).toEqual({ kind: 'row', id: second, table: leads.id })
    expect(atNumber(db(), `${top}.3.1`)).toEqual({ kind: 'table', id: calls.id })
    expect(atNumber(db(), `${top}.3`)).toEqual({ kind: 'module', id: desk.id })
    expect(atNumber(db(), `${top}.9`)).toBeNull()
    expect(atNumber(db(), 'x.1')).toBeNull()
  })

  it('never gives a number again, and a row brought back keeps its own', () => {
    const m = world.shape.makeModule('Sales', alpha)
    const t = table(m.id, 'Deals')
    const [a, b] = rows(t.id, 'Acme', 'Bolt') as [string, string]
    const at = tableNumber(db(), t.id)
    world.records.remove(t.id, [a], alpha)
    const [c] = rows(t.id, 'Crest') as [string]
    expect(rowNumber(db(), b)).toBe(`${at}.2`)
    expect(rowNumber(db(), c)).toBe(`${at}.3`)
    bringBack(world.records, [a])
    expect(rowNumber(db(), a)).toBe(`${at}.1`)
  })

  it('never gives the newest row’s or table’s number again once it goes, so Bring back finds no twin', () => {
    const m = world.shape.makeModule('Sales', alpha)
    const t = table(m.id, 'Deals')
    const [, b] = rows(t.id, 'Acme', 'Bolt') as [string, string]
    const at = tableNumber(db(), t.id)
    // the newest row removed: the next row takes the next number, not its
    world.records.remove(t.id, [b], alpha)
    const [c] = rows(t.id, 'Crest') as [string]
    expect(rowNumber(db(), c)).toBe(`${at}.3`)
    bringBack(world.records, [b])
    expect(rowNumber(db(), b)).toBe(`${at}.2`)
    const numbered = world.records.list(t.id).map((r) => r.number)
    expect(numbered.sort()).toEqual([1, 2, 3])
    // the newest table removed: the next table takes the next number, not its
    const person = { actor: { kind: 'person' as const, id: world.owner('Kenil').id } }
    const leads = table(m.id, 'Leads')
    const was = tableNumber(db(), leads.id)
    world.shape.removeTable(leads.id, person)
    const calls = table(m.id, 'Calls')
    expect(tableNumber(db(), calls.id)).not.toBe(was)
  })

  it('says a moved module’s new address in its line', () => {
    const sales = world.shape.makeModule('Sales', alpha)
    const desk = world.shape.makeModule('Desk', alpha)
    world.shape.place(desk.id, sales.id, alpha)
    expect(world.lines({ kinds: ['shaped'] }).at(-1)?.words).toBe(
      `Put Desk inside Sales; it is ${moduleNumber(db(), desk.id)} now.`,
    )
  })

  it('numbers what a world held before, in the order it was made', () => {
    const m = world.shape.makeModule('Sales', alpha)
    const t = table(m.id, 'Deals')
    const [a, b] = rows(t.id, 'Acme', 'Bolt') as [string, string]
    db().exec(
      'DROP INDEX records_number; UPDATE records SET number = NULL; UPDATE tables SET number = NULL, next_row = 1',
    )
    numbers(db())
    expect(rowNumber(db(), a)).toBe(`${moduleNumber(db(), m.id)}.1.1`)
    expect(rowNumber(db(), b)).toBe(`${moduleNumber(db(), m.id)}.1.2`)
    // and its counters set past what was there: the next row is the third
    const [c] = rows(t.id, 'Crest') as [string]
    expect(rowNumber(db(), c)).toBe(`${moduleNumber(db(), m.id)}.1.3`)
  })
})
