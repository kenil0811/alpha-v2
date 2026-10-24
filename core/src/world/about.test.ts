// The semantic layer (Kenil, 24 Oct): one sentence on what a table, a field and a view mean,
// whose it is, and that the person's stands over the kit's and Alpha's.
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { kitNotes } from '@alpha/kit-sdk'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { parse } from 'yaml'
import { install, update } from '../modules/kits/index.ts'
import { World } from './world.ts'

const KIT = join(import.meta.dirname, '..', 'modules', 'test-kit')
let home: string
let world: World
const person = { actor: { kind: 'person' as const, id: 'u_1' }, user: 'u_1' }
const alpha = { actor: { kind: 'alpha' as const } }

beforeEach(async () => {
  home = mkdtempSync(join(tmpdir(), 'alpha-about-'))
  world = await World.open(join(home, 'tenants', 't_test'))
})

afterEach(() => {
  world.close()
  rmSync(home, { recursive: true, force: true })
})

describe('what a table and its fields mean', () => {
  it('is kept with whose sentence it is, mirrored in module.yaml, and the person’s stands', () => {
    const m = world.shape.makeModule('Rentals', alpha)
    const t = world.shape.makeTable(
      m.id,
      'Listings',
      [
        { name: 'Address', kind: 'text', about: 'Where the home is.', aboutBy: 'alpha' },
        { name: 'Rent', kind: 'money' },
      ],
      alpha,
      { about: 'One home for rent, as a listing page shows it.', aboutBy: 'alpha' },
    )
    expect([t.about, t.aboutBy]).toEqual([
      'One home for rent, as a listing page shows it.',
      'alpha',
    ])
    expect(t.fields.map((f) => [f.name, f.about, f.aboutBy])).toEqual([
      ['Address', 'Where the home is.', 'alpha'],
      ['Rent', null, null],
    ])
    // Alpha's guess gives way to the person; the person's sentence stands against Alpha's
    expect(
      world.shape.describe(
        { table: t.id, field: 'Address' },
        'The street address, as listed.',
        'person',
        person,
      ),
    ).toBe(true)
    expect(
      world.shape.describe({ table: t.id, field: 'Address' }, 'Alpha tries again.', 'alpha', alpha),
    ).toBe(false)
    expect(
      world.shape.describe(
        { table: t.id, field: 'Rent' },
        'The monthly rent asked.',
        'alpha',
        alpha,
      ),
    ).toBe(true)
    const after = world.shape.table(t.id)
    expect(after?.fields.map((f) => [f.about, f.aboutBy])).toEqual([
      ['The street address, as listed.', 'person'],
      ['The monthly rent asked.', 'alpha'],
    ])
    const manifest = parse(readFileSync(join(m.dir, 'module.yaml'), 'utf8'))
    expect(manifest.tables[0].about).toBe('One home for rent, as a listing page shows it.')
    expect(manifest.tables[0].fields.map((f: { about?: string }) => f.about)).toEqual([
      'The street address, as listed.',
      'The monthly rent asked.',
    ])
    // the journal says what was described
    expect(world.lines({ kinds: ['shaped'], limit: 5 }).map((l) => l.words)).toContain(
      'Address in Listings: The street address, as listed.',
    )
    // a view's sentence
    const v = world.views.save(
      { table: t.id, name: 'Cheap', config: {}, about: 'Homes under the budget.' },
      person,
    )
    expect(world.views.get(v.id)?.about).toBe('Homes under the budget.')
    expect(parse(readFileSync(join(m.dir, 'module.yaml'), 'utf8')).tables[0].views[0].about).toBe(
      'Homes under the budget.',
    )
  })

  it('refuses an essay where a sentence is asked', () => {
    const m = world.shape.makeModule('Rentals', alpha)
    const t = world.shape.makeTable(m.id, 'Listings', [{ name: 'Address', kind: 'text' }], alpha)
    expect(() => world.shape.describe({ table: t.id }, 'x'.repeat(301), 'person', person)).toThrow(
      /one sentence/,
    )
  })
})

describe('a kit’s sentences', () => {
  it('land as the kit’s on install, follow the kit on update, and leave the person’s alone', async () => {
    const kit = join(home, 'kit')
    cpSync(KIT, kit, { recursive: true })
    const m = await install(world, kit, person)
    const orders = world.shape.table('Orders')
    expect([orders?.about, orders?.aboutBy]).toEqual(['One order placed with a supplier.', 'kit'])
    expect(orders?.fields.map((f) => [f.name, f.about, f.aboutBy])).toEqual([
      ['Item', null, null],
      ['Quantity', 'How many were ordered.', 'kit'],
      ['Supplier', null, null],
    ])
    // the person says what Supplier means; the kit's next version says more about Quantity and Supplier
    world.shape.describe(
      { table: orders?.id as string, field: 'Supplier' },
      'Who we buy it from.',
      'person',
      person,
    )
    const next = join(home, 'next')
    cpSync(kit, next, { recursive: true })
    const text = readFileSync(join(next, 'module.yaml'), 'utf8')
      .replace('version: 0.1.0', 'version: 0.1.1')
      .replace('about: How many were ordered.', 'about: How many were ordered in units.')
      .replace(
        '{ name: Supplier, kind: relation, relates_to: Suppliers }',
        '{ name: Supplier, kind: relation, relates_to: Suppliers, about: The kit says who. }',
      )
    writeFileSync(join(next, 'module.yaml'), text)
    await update(world, m.name, next, person)
    expect(world.shape.table('Orders')?.fields.map((f) => [f.about, f.aboutBy])).toEqual([
      [null, null],
      ['How many were ordered in units.', 'kit'],
      ['Who we buy it from.', 'person'],
    ])
  })

  it('kit check notes what has no sentence yet, and refuses nothing for it', () => {
    expect(kitNotes(KIT)).toEqual([
      "Orders's Item, Supplier have no about: say what each means.",
      'Suppliers has no about: say in a sentence what a row of it is.',
      "Suppliers's Name, Email have no about: say what each means.",
    ])
  })
})
