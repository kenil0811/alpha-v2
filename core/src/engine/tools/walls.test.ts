// The builder's walls: a module's business case comes with its first table, a table that is only a
// name is refused, so is one named for a period, each in words that say what to make instead; the
// case is kept in module.yaml through every rewrite, the person's stands over Alpha's and a kit's,
// and it is in every turn's start layer.
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { parse } from 'yaml'
import { install, update } from '../../modules/kits/index.ts'
import type { Module } from '../../world/shape/index.ts'
import { businessCase, setBusinessCase } from '../../world/shape/manifest.ts'
import { World } from '../../world/world.ts'
import { startLayer } from '../context.ts'
import { applyShape } from './index.ts'

const alpha = { actor: { kind: 'alpha' as const } }
const person = { actor: { kind: 'person' as const, id: 'u_1' }, user: 'u_1' }
const CASE = { for: 'The owner', keeps: 'What each client owes', decides: 'Whom to chase' }
let home: string
let world: World

beforeEach(async () => {
  home = mkdtempSync(join(tmpdir(), 'alpha-walls-'))
  world = await World.open(join(home, 'tenants', 't_test'))
})
afterEach(() => {
  world.close()
  rmSync(home, { recursive: true, force: true })
})

const make = (table: string, fields: { name: string; kind: string }[], more = {}) =>
  applyShape(
    world,
    {
      action: 'make_table',
      module: 'Billing',
      table,
      about: `A row of ${table}.`,
      fields: fields.map((f) => ({ ...f, about: f.name })) as never,
      ...more,
    },
    alpha,
  )

describe('the walls', () => {
  it('want a module’s business case with its first table, and keep it in module.yaml', () => {
    expect(() =>
      make('Invoices', [
        { name: 'Number', kind: 'text' },
        { name: 'Sent', kind: 'date' },
      ]),
    ).toThrow(
      'Billing has no business case yet. Give business_case with the table: who it is for, what it keeps track of, and the decisions it serves, from the person’s words.',
    )
    make(
      'Invoices',
      [
        { name: 'Number', kind: 'text' },
        { name: 'Sent', kind: 'date' },
      ],
      { business_case: CASE },
    )
    const m = world.shape.module('Billing') as Module
    expect(businessCase(m)).toEqual({ ...CASE, by: 'alpha' })
    // a later table needs none, and the case outlives every rewrite of module.yaml
    make('Payments', [
      { name: 'Amount', kind: 'money' },
      { name: 'On', kind: 'date' },
    ])
    world.shape.writeManifest(m)
    const yaml = parse(readFileSync(join(m.dir, 'module.yaml'), 'utf8')) as {
      business_case: unknown
      tables: unknown[]
    }
    expect(yaml.business_case).toEqual({ ...CASE, by: 'alpha' })
    expect(yaml.tables).toHaveLength(2)
    expect(startLayer(world, 'u_1', home, null)).toContain(
      'Business case (yours, assumed until the person changes it): for The owner; keeps What each client owes; decides Whom to chase.',
    )
  })

  it('refuse a table that is only a name, and one named for a period', () => {
    expect(() =>
      make('Industries', [{ name: 'Name', kind: 'text' }], { business_case: CASE }),
    ).toThrow(
      /^Industries would hold only a name\. If it is a list to pick from .*make it a choice field on the table that would point at it/,
    )
    for (const name of ['October', 'Q3 deals', 'Expenses 2025', 'Week 12 hours', 'FY26 budget'])
      expect(() =>
        make(
          name,
          [
            { name: 'Item', kind: 'text' },
            { name: 'On', kind: 'date' },
          ],
          { business_case: CASE },
        ),
      ).toThrow(/names a period .*: make one table for every period, with a date on each row/)
    // words that only hold a period's letters pass
    make(
      'Octopus orders',
      [
        { name: 'Item', kind: 'text' },
        { name: 'On', kind: 'date' },
      ],
      { business_case: CASE },
    )
    expect(() =>
      applyShape(world, { action: 'rename', table: 'Octopus orders', to: 'March orders' }, alpha),
    ).toThrow(/names a period \(march\)/)
  })

  it('leave the person’s own case over Alpha’s and a kit’s', async () => {
    make(
      'Invoices',
      [
        { name: 'Number', kind: 'text' },
        { name: 'Sent', kind: 'date' },
      ],
      { business_case: CASE },
    )
    const m = world.shape.module('Billing') as Module
    setBusinessCase(world.shape, m, { ...CASE, decides: 'When to stop work' }, 'person', person)
    expect(
      applyShape(world, { action: 'business_case', module: 'Billing', business_case: CASE }, alpha),
    ).toBe("Billing keeps the person's own business case; theirs stands.")
    expect(businessCase(m)?.decides).toBe('When to stop work')
    // a kit's case comes with it, and its update gives way to the person's
    const kit = join(home, 'kit')
    mkdirSync(kit)
    const yaml = (decides: string) => `name: Book
version: 0.1.${decides.length}
api: 2
business_case: { for: The owner, keeps: Their books, decides: ${decides} }
tables:
  - name: Entries
    fields:
      - { name: Item, kind: text }
      - { name: On, kind: date }
`
    writeFileSync(join(kit, 'module.yaml'), yaml('What to file'))
    const book = await install(world, kit, person)
    expect(businessCase(book)?.by).toBe('kit')
    writeFileSync(join(kit, 'module.yaml'), yaml('What to file first'))
    await update(world, book.id, kit, person)
    expect(businessCase(book)?.decides).toBe('What to file first')
    setBusinessCase(
      world.shape,
      book,
      { for: 'Me', keeps: 'My books', decides: 'Mine' },
      'person',
      person,
    )
    writeFileSync(join(kit, 'module.yaml'), yaml('Something else entirely'))
    await update(world, book.id, kit, person)
    expect(businessCase(book)).toEqual({
      for: 'Me',
      keeps: 'My books',
      decides: 'Mine',
      by: 'person',
    })
  })
})
