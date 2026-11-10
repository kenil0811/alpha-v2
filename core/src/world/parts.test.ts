// Part of and setup: a relation can be part of the row it points at, so its rows show there, go and
// come back with it, and are never on their own; a table can be setup; a module's tabs are the
// tables that are neither.
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { parse } from 'yaml'
import { applyShape } from '../engine/tools/index.ts'
import { Refused } from './kinds.ts'
import { revert } from './records/index.ts'
import type { Table } from './shape/index.ts'
import { placeOf } from './shape/parts.ts'
import { World } from './world.ts'

const alpha = { kind: 'alpha' as const }
const person = { kind: 'person' as const, id: 'u_test' }
const looked = { kind: 'looked_up' as const, source: { url: 'https://example.com' } }
let home: string
let world: World

beforeEach(async () => {
  home = mkdtempSync(join(tmpdir(), 'alpha-parts-'))
  world = await World.open(join(home, 'tenants', 't_test'))
})
afterEach(() => {
  world.close()
  rmSync(home, { recursive: true, force: true })
})

// Deals, with Financials part of a deal and Lines part of a Financials row, and Sources as setup.
function deals(): {
  deals: Table
  fin: Table
  lines: Table
  sources: Table
  d1: string
  f1: string
} {
  const m = world.shape.makeModule('DealPilot', { actor: alpha })
  const sources = world.shape.makeTable(
    m.id,
    'Sources',
    [{ name: 'Name', kind: 'text' }],
    {
      actor: alpha,
    },
    { setup: true },
  )
  const deals = world.shape.makeTable(m.id, 'Deals', [{ name: 'Name', kind: 'text' }], {
    actor: alpha,
  })
  const fin = world.shape.makeTable(
    m.id,
    'Financials',
    [
      { name: 'Year', kind: 'number' },
      { name: 'Deal', kind: 'relation', relatesTo: 'Deals', partOf: true },
    ],
    { actor: alpha },
  )
  const lines = world.shape.makeTable(
    m.id,
    'Lines',
    [
      { name: 'Amount', kind: 'number' },
      { name: 'Year', kind: 'relation', relatesTo: 'Financials', partOf: true },
    ],
    { actor: alpha },
  )
  const [d1] = world.records.add(deals.id, [{ values: { Name: 'Acme' }, provenance: looked }], {
    actor: alpha,
  }) as [string]
  const [f1] = world.records.add(
    fin.id,
    [
      { values: { Year: 2024, Deal: d1 }, provenance: looked },
      { values: { Year: 2025, Deal: d1 }, provenance: looked },
    ],
    { actor: alpha },
  ) as [string]
  world.records.add(lines.id, [{ values: { Amount: 10, Year: f1 }, provenance: looked }], {
    actor: alpha,
  })
  return {
    deals,
    fin: world.shape.table(fin.id) as Table,
    lines: world.shape.table(lines.id) as Table,
    sources,
    d1,
    f1,
  }
}

describe('a table’s place', () => {
  it('is main, part or setup, and module.yaml says it', () => {
    const s = deals()
    expect([s.deals, s.fin, s.lines, s.sources].map(placeOf)).toEqual([
      'main',
      'part',
      'part',
      'setup',
    ])
    expect(world.shape.partsOf(s.deals.id).map((p) => p.table.name)).toEqual(['Financials'])
    const yaml = parse(readFileSync(join(s.deals.module.dir, 'module.yaml'), 'utf8')) as {
      tables: { name: string; setup?: boolean; fields: { name: string; part_of?: boolean }[] }[]
    }
    expect(yaml.tables.find((t) => t.name === 'Sources')?.setup).toBe(true)
    expect(
      yaml.tables.find((t) => t.name === 'Financials')?.fields.find((f) => f.name === 'Deal')
        ?.part_of,
    ).toBe(true)
  })

  it('a part is never on its own: added without its row, or cleared, it is refused', () => {
    const s = deals()
    expect(() =>
      world.records.add(s.fin.id, [{ values: { Year: 2023 }, provenance: looked }], {
        actor: alpha,
      }),
    ).toThrow(/is part of the row its Deal names, so it needs one/)
    expect(() =>
      world.records.change(s.fin.id, [{ id: s.f1, values: { Deal: null }, provenance: looked }], {
        actor: alpha,
      }),
    ).toThrow(Refused)
  })

  it('becomes part of only when every row has its row, and only one row of another table', () => {
    const m = world.shape.makeModule('Shop', { actor: alpha })
    const orders = world.shape.makeTable(m.id, 'Orders', [{ name: 'Name', kind: 'text' }], {
      actor: alpha,
    })
    const items = world.shape.makeTable(
      m.id,
      'Items',
      [
        { name: 'Name', kind: 'text' },
        { name: 'Order', kind: 'relation', relatesTo: 'Orders' },
        { name: 'Also in', kind: 'relation', relatesTo: 'Orders', many: true },
      ],
      { actor: alpha },
    )
    const [o] = world.records.add(orders.id, [{ values: { Name: 'One' }, provenance: looked }], {
      actor: alpha,
    }) as [string]
    const [i1] = world.records.add(
      items.id,
      [
        { values: { Name: 'Bolt', Order: o }, provenance: looked },
        { values: { Name: 'Nut' }, provenance: looked },
      ],
      { actor: alpha },
    ) as [string, string]
    expect(() => world.shape.setPartOf(items.id, 'Order', true, { actor: alpha })).toThrow(
      /1 row of Items has no Order/,
    )
    expect(() => world.shape.setPartOf(items.id, 'Also in', true, { actor: alpha })).toThrow(
      /only as a relation to one row/,
    )
    world.records.remove(
      items.id,
      world.records.ids(items.id).filter((x) => x !== i1),
      { actor: person },
    )
    expect(placeOf(world.shape.setPartOf(items.id, 'Order', true, { actor: alpha }))).toBe('part')
    // a part's table can't be removed from under it: its row's table refuses
    expect(() => world.shape.removeTable(orders.id, { actor: person })).toThrow(
      /Items is part of Orders: remove it first/,
    )
  })
})

describe('removing a row', () => {
  it('takes its parts with it, deepest first, on one line, and Bring back returns them all', () => {
    const s = deals()
    world.records.remove(s.deals.id, [s.d1], { actor: person })
    expect(world.records.count(s.fin.id)).toBe(0)
    expect(world.records.count(s.lines.id)).toBe(0)
    const line = world.lines({ kinds: ['removed'] }).at(-1)
    expect(line?.words).toBe(
      'Removed a row from Deals: Name Acme, with 1 row of Lines and 2 rows of Financials.',
    )
    const back = revert(world.records, { line: line?.id as number }, { actor: person }, '')
    expect(back.words).toBe(
      'In Lines, 1 row comes back; in Financials, 2 rows come back; in Deals, 1 row comes back.',
    )
    expect(world.records.count(s.fin.id)).toBe(2)
    // each part points at its row again
    expect(world.records.get(s.f1)?.record.values).toMatchObject({ deal: s.d1 })
    expect(world.records.list(s.lines.id)[0]?.values).toMatchObject({ year: s.f1 })
  })

  it('by a revert takes its parts too, and reverting the revert brings them back', () => {
    const s = deals()
    const [d2] = world.records.add(s.deals.id, [{ values: { Name: 'Beta' }, provenance: looked }], {
      actor: alpha,
      run: 'run_1',
    }) as [string]
    world.records.add(s.fin.id, [{ values: { Year: 2024, Deal: d2 }, provenance: looked }], {
      actor: person,
    })
    const done = revert(world.records, { run: 'run_1' }, { actor: person }, 'the run')
    expect(done.words).toBe('In Financials, 1 row goes; in Deals, 1 row goes.')
    const again = revert(
      world.records,
      { line: world.lines({ kinds: ['reverted'] }).at(-1)?.id as number },
      { actor: person },
      'the revert',
    )
    expect(again.words).toBe('In Financials, 1 row comes back; in Deals, 1 row comes back.')
    expect(world.records.count(s.fin.id)).toBe(3)
  })
})

describe('the shape tool', () => {
  it('makes a part and a setup table, and moves them', () => {
    const c = { actor: alpha }
    applyShape(
      world,
      {
        action: 'make_table',
        module: 'Firm',
        table: 'Clients',
        about: 'A client.',
        fields: [],
        business_case: {
          for: 'The owner',
          keeps: 'Their clients and what they bill',
          decides: 'Whom to chase',
        },
      },
      c,
    )
    applyShape(
      world,
      {
        action: 'make_table',
        module: 'Firm',
        table: 'Invoices',
        about: 'An invoice to a client.',
        fields: [
          {
            name: 'Client',
            kind: 'relation',
            relates_to: 'Clients',
            part_of: true,
            about: 'Whose.',
          },
        ],
      },
      c,
    )
    applyShape(
      world,
      {
        action: 'make_table',
        module: 'Firm',
        table: 'Rates',
        about: 'A rate.',
        fields: [],
        setup: true,
      },
      c,
    )
    expect(
      ['Clients', 'Invoices', 'Rates'].map((n) => placeOf(world.shape.table(n) as Table)),
    ).toEqual(['main', 'part', 'setup'])
    expect(applyShape(world, { action: 'setup', table: 'Rates', setup: false }, c)).toBe(
      "Rates is one of Firm's main tables again.",
    )
    applyShape(world, { action: 'part_of', table: 'Invoices', field: 'Client', part_of: false }, c)
    expect(placeOf(world.shape.table('Invoices') as Table)).toBe('main')
  })
})
