// Make this a kit: a module made in a conversation leaves as a kit pack, checked and installable,
// with its shape, notes, schedules and skills and none of its rows; a kit module is packed as it is.
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { checkKit } from '@alpha/kit-sdk'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { parse } from 'yaml'
import { World } from '../world/world.ts'
import { install } from './kits/index.ts'
import { makeKit } from './makekit.ts'
import { unpack } from './packs.ts'
import { schedules } from './schedules.ts'

const KIT = join(import.meta.dirname, 'test-kit')
let home: string
let world: World
const ctx = { actor: { kind: 'person' as const, id: 'u_1' }, user: 'u_1' }
const alpha = { actor: { kind: 'alpha' as const } }

beforeEach(async () => {
  home = mkdtempSync(join(tmpdir(), 'alpha-makekit-'))
  world = await World.open(join(home, 'tenants', 't_test'))
})

afterEach(() => {
  world.close()
  rmSync(home, { recursive: true, force: true })
})

// A module as a conversation leaves it: two tables, a relation between them, a view, notes, an
// schedule with its skill, and a row.
function rentals(): string {
  const m = world.shape.makeModule('Rentals', alpha)
  const sources = world.shape.makeTable(
    m.id,
    'Rental sources',
    [
      { name: 'Name', kind: 'text' },
      { name: 'On', kind: 'choice', choices: ['On', 'Off'], tones: { On: 'good' } },
    ],
    alpha,
  )
  const listings = world.shape.makeTable(
    m.id,
    'Rental listings',
    [
      { name: 'Address', kind: 'text' },
      { name: 'Rent per month', kind: 'money' },
      { name: 'Source', kind: 'relation', relatesTo: sources.id },
    ],
    alpha,
  )
  world.views.save(
    {
      table: listings.id,
      name: 'Cheapest first',
      config: { sorts: [{ field: 'Rent per month', dir: 'asc' }] },
      madeBy: 'alpha',
    },
    alpha,
  )
  world.records.add(
    sources.id,
    [
      {
        values: { Name: 'Avenue STL', On: 'On' },
        provenance: { kind: 'estimated', basis: 'a test' },
      },
    ],
    alpha,
  )
  writeFileSync(
    join(m.dir, 'NOTES.md'),
    '# Rentals\n\nHomes and apartments for rent, gathered from listings pages.\n\n- **Rental sources:** the pages.\n',
  )
  mkdirSync(join(m.dir, 'skills', 'reader'), { recursive: true })
  writeFileSync(join(m.dir, 'skills', 'reader', 'run.js'), 'export default async () => ({})\n')
  mkdirSync(join(m.dir, 'schedules'), { recursive: true })
  writeFileSync(
    join(m.dir, 'schedules', 'avenue.md'),
    '---\nname: Avenue\ndescription: Reads the Avenue page.\ntrigger: { every: day, at: "07:00" }\nruns: { script: skills/reader/run.js }\ntouches: [Rental listings, Rental sources]\n---\nReads it.\n',
  )
  mkdirSync(join(m.dir, '.claude'))
  writeFileSync(join(m.dir, '.claude', 'settings.json'), '{}')
  return m.id
}

describe('Make this a kit', () => {
  it('packs a conversation-made module as a 0.1.0 kit that checks and installs, rows left out', async () => {
    const id = rentals()
    const made = makeKit(world, id, join(home, 'Desktop'), ctx)
    expect(made).toMatchObject({ name: 'Rentals', version: '0.1.0' })
    expect(made.file.endsWith('rentals-0.1.0.alphakit')).toBe(true)
    expect(made.words).toMatch(/^Made Rentals 0\.1\.0: 2 tables, 1 schedule, 1 skill, no rows\./)
    const { dir } = unpack(made.file, join(home, 'kits'), { developer: true })
    const manifest = parse(readFileSync(join(dir, 'module.yaml'), 'utf8'))
    expect(manifest).toMatchObject({
      name: 'Rentals',
      version: '0.1.0',
      api: 2,
      description: 'Homes and apartments for rent, gathered from listings pages.',
      network: [],
    })
    expect(manifest.uses).toBeUndefined()
    expect(manifest.tables.map((t: { name: string }) => t.name)).toEqual([
      'Rental sources',
      'Rental listings',
    ])
    expect(manifest.tables[0].fields[1]).toEqual({
      name: 'On',
      kind: 'choice',
      choices: ['On', 'Off'],
      tones: { On: 'good' },
    })
    expect(manifest.tables[1].fields[2]).toEqual({
      name: 'Source',
      kind: 'relation',
      relates_to: 'Rental sources',
    })
    expect(manifest.tables[1].views).toEqual([
      { name: 'Cheapest first', sorts: [{ field: 'Rent per month', dir: 'asc' }] },
    ])
    expect(existsSync(join(dir, 'NOTES.md'))).toBe(true)
    expect(existsSync(join(dir, 'schedules', 'avenue.md'))).toBe(true)
    expect(existsSync(join(dir, 'skills', 'reader', 'run.js'))).toBe(true)
    expect(existsSync(join(dir, '.claude'))).toBe(false)
    expect(existsSync(join(dir, 'setup.yaml'))).toBe(false)
    expect(checkKit(dir)).toEqual([])
    // it installs into another world: the shape and the schedule, none of the rows
    const other = await World.open(join(home, 'tenants', 't_other'))
    try {
      const m = await install(other, dir, ctx)
      expect(other.shape.tables(m.id).map((t) => [t.name, t.fields.length])).toEqual([
        ['Rental sources', 2],
        ['Rental listings', 3],
      ])
      expect(other.records.count(other.shape.table('Rental sources')?.id as string)).toBe(0)
      expect(schedules(other, m.id).map((a) => [a.name, a.state])).toEqual([['Avenue', 'paused']])
      expect(other.views.list(other.shape.table('Rental listings')?.id as string)[0]?.name).toBe(
        'Cheapest first',
      )
    } finally {
      other.close()
    }
    // and the world still has its row, and said what was done
    expect(world.records.count(world.shape.table('Rental sources')?.id as string)).toBe(1)
    expect(world.lines({ kinds: ['packed'], limit: 5 })).toHaveLength(1)
  })

  it('names what it reaches of a kit or a connector in uses, and refuses a plain module', async () => {
    const bakery = await install(world, KIT, ctx)
    const mail = world.shape.makeModule('Mail', { actor: { kind: 'connector', id: 'gmail' } })
    const messages = world.shape.makeTable(
      mail.id,
      'Messages',
      [{ name: 'Subject', kind: 'text' }],
      alpha,
    )
    const m = world.shape.makeModule('Orders desk', alpha)
    world.shape.makeTable(
      m.id,
      'Deliveries',
      [
        {
          name: 'Supplier',
          kind: 'relation',
          relatesTo: world.shape.table('Suppliers')?.id as string,
        },
        { name: 'Asked in', kind: 'relation', relatesTo: messages.id },
      ],
      alpha,
    )
    const made = makeKit(world, m.id, join(home, 'Desktop'), ctx)
    const { dir } = unpack(made.file, join(home, 'kits'), { developer: true })
    const manifest = parse(readFileSync(join(dir, 'module.yaml'), 'utf8'))
    expect(manifest.uses).toEqual([
      { kit: 'Bakery', min: '0.1.0', tables: ['Suppliers'] },
      { connector: 'gmail', tables: ['Messages'] },
    ])
    expect(bakery.name).toBe('Bakery')
    const plain = world.shape.makeModule('Helpers', alpha)
    const people = world.shape.makeTable(
      plain.id,
      'Helpers list',
      [{ name: 'Name', kind: 'text' }],
      alpha,
    )
    const m2 = world.shape.makeModule('Chores', alpha)
    world.shape.makeTable(
      m2.id,
      'Chores list',
      [{ name: 'Who', kind: 'relation', relatesTo: people.id }],
      alpha,
    )
    expect(() => makeKit(world, m2.id, join(home, 'Desktop'), ctx)).toThrow(
      /reaches Helpers list in Helpers, which was not installed from a pack or a connector/,
    )
  })

  it('packs a kit module as it is now, its version kept', async () => {
    const m = await install(world, KIT, ctx)
    writeFileSync(join(m.dir, 'NOTES.md'), '# Bakery\n\nChanged by the person.\n')
    const made = makeKit(world, m.id, join(home, 'Desktop'), ctx)
    expect(made.file.endsWith('bakery-0.1.0.alphakit')).toBe(true)
    expect(made.words).toMatch(/^Packed Bakery 0\.1\.0: 2 tables, 1 schedule, 2 skills, no rows\./)
    const { dir } = unpack(made.file, join(home, 'kits'), { developer: true })
    expect(readFileSync(join(dir, 'NOTES.md'), 'utf8')).toContain('Changed by the person')
    expect(existsSync(join(dir, 'setup.yaml'))).toBe(false)
    expect(checkKit(dir)).toEqual([])
  })
})
