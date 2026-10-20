// The kit installer and the ownership rule, on a made-up kit (test-kit/): never a client's.
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { World } from '../world/world.ts'
import { agents } from './agents.ts'
import { history } from './git.ts'
import { install, installedKits, update } from './kits.ts'

const KIT = join(import.meta.dirname, 'test-kit')
let home: string
let world: World
const ctx = { actor: { kind: 'person' as const, id: 'u_1' }, user: 'u_1' }

beforeEach(async () => {
  home = mkdtempSync(join(tmpdir(), 'alpha-kits-'))
  world = await World.open(join(home, 'tenants', 't_test'))
})

afterEach(() => {
  world.close()
  rmSync(home, { recursive: true, force: true })
})

describe('installing a kit', () => {
  it('makes its tables, lands its setup rows as the kit’s, and leaves its agents paused', async () => {
    const m = await install(world, KIT, ctx)
    expect(world.shape.tables(m.id).map((t) => [t.name, t.fields.map((f) => f.name)])).toEqual([
      ['Orders', ['Item', 'Quantity', 'Supplier']],
      ['Suppliers', ['Name', 'Email']],
    ])
    const suppliers = world.records.list(world.shape.table('Suppliers')?.id as string)
    expect(suppliers.map((r) => r.values.name)).toEqual(['Mill & Co', 'Dairy Farm'])
    expect(suppliers[0]?.provenance.name?.source).toMatchObject({
      connector: 'kit',
      account: 'Bakery 0.1.0',
      item: 'setup:mill',
    })
    expect(suppliers[0]?.provenance.email).toMatchObject({
      kind: 'assumed',
      basis: "the address on the mill's invoices",
    })
    expect(world.records.count(world.shape.table('Orders')?.id as string)).toBe(0)
    expect(agents(world, m.id).map((a) => [a.name, a.state, a.trigger])).toEqual([
      ['Counter', 'paused', { every: 'day', at: '07:00' }],
    ])
    expect(installedKits(world)).toEqual([
      { module: m.id, kit: 'Bakery', version: '0.1.0', source: KIT },
    ])
    expect(readFileSync(join(m.dir, 'module.yaml'), 'utf8')).toContain('example.com')
    expect((await history(m.dir)).map((c) => c.message)).toEqual(['Installed Bakery 0.1.0'])
    expect(world.lines({ kinds: ['installed'] })[0]?.words).toBe(
      'Installed Bakery 0.1.0: 2 tables, 2 setup rows, 1 agent (paused).',
    )
    await expect(install(world, KIT, ctx)).rejects.toThrow(/already installed/)
  })
})

describe('updating a kit', () => {
  it('puts a newer version’s choices where the kit has them, taking none away', async () => {
    const withKind = (dir: string, version: string, choices: string) =>
      writeFileSync(
        join(dir, 'module.yaml'),
        readFileSync(join(KIT, 'module.yaml'), 'utf8')
          .replace('version: 0.1.0', `version: ${version}`)
          .replace(
            '      - { name: Email, kind: email }',
            `      - { name: Email, kind: email }\n      - { name: Kind, kind: choice, choices: [${choices}] }`,
          ),
      )
    const first = join(home, 'kit-0.1.0')
    cpSync(KIT, first, { recursive: true })
    withKind(first, '0.1.0', 'Flour, Milk')
    await install(world, first, ctx)
    const suppliers = world.shape.table('Suppliers')?.id as string
    world.shape.setChoices(suppliers, 'Kind', ['Flour', 'Milk', 'Butter'], ctx)
    const next = join(home, 'kit-0.2.0')
    cpSync(KIT, next, { recursive: true })
    withKind(next, '0.2.0', 'Flour, Eggs')
    await update(world, 'Bakery', next, ctx)
    expect(world.shape.table(suppliers)?.fields.find((f) => f.name === 'Kind')?.choices).toEqual([
      'Flour',
      'Eggs',
      'Milk',
      'Butter',
    ])
  })

  it('brings its views, and on update replaces only the ones nobody changed', async () => {
    const withViews = (dir: string, version: string, big: number) =>
      writeFileSync(
        join(dir, 'module.yaml'),
        readFileSync(join(KIT, 'module.yaml'), 'utf8')
          .replace('version: 0.1.0', `version: ${version}`)
          .replace(
            '      - { name: Supplier, kind: relation, relates_to: Suppliers }',
            `      - { name: Supplier, kind: relation, relates_to: Suppliers }\n    views:\n      - { name: Big, default: true, filters: { rules: [{ field: Quantity, op: gt, value: ${big} }] } }\n      - { name: Mine, sorts: [{ field: Item, dir: asc }] }`,
          ),
      )
    const first = join(home, 'kit-0.1.0')
    cpSync(KIT, first, { recursive: true })
    withViews(first, '0.1.0', 10)
    await install(world, first, ctx)
    const orders = world.shape.table('Orders')?.id as string
    expect(world.views.list(orders).map((v) => [v.name, v.madeBy, v.isDefault])).toEqual([
      ['Big', 'kit', true],
      ['Mine', 'kit', false],
    ])
    // the person changes Mine; the kit's next version changes both
    const mine = world.views.list(orders).find((v) => v.name === 'Mine')
    world.views.save(
      {
        table: orders,
        id: mine?.id as string,
        name: 'Mine',
        config: { sorts: [{ field: 'Item', dir: 'desc' }] },
      },
      ctx,
    )
    const next = join(home, 'kit-0.2.0')
    cpSync(KIT, next, { recursive: true })
    withViews(next, '0.2.0', 50)
    await update(world, 'Bakery', next, ctx)
    const [big, kept] = world.views.list(orders)
    expect(big?.config.filters.rules[0]?.value).toBe(50)
    expect(kept?.config.sorts[0]?.dir).toBe('desc')
  })

  it('replaces what nobody changed, keeps what the person changed, and deletes nothing', async () => {
    const m = await install(world, KIT, ctx)
    // the person changes a skill's words and one supplier
    writeFileSync(
      join(m.dir, 'skills/count/SKILL.md'),
      '---\nname: count\ndescription: mine\n---\nMy words.\n',
    )
    const suppliers = world.shape.table('Suppliers')?.id as string
    const dairy = world.records.list(suppliers).find((r) => r.values.name === 'Dairy Farm')
      ?.id as string
    world.records.change(
      suppliers,
      [
        {
          id: dairy,
          values: { Email: 'orders@dairy.example' },
          provenance: { kind: 'stated', source: { message: 1 } },
        },
      ],
      ctx,
    )
    // the kit's next version changes the notes, the skill and both suppliers, adds a field and a file
    const next = join(home, 'kit-0.2.0')
    cpSync(KIT, next, { recursive: true })
    writeFileSync(
      join(next, 'module.yaml'),
      readFileSync(join(next, 'module.yaml'), 'utf8')
        .replace('version: 0.1.0', 'version: 0.2.0')
        .replace(
          '      - { name: Email, kind: email }',
          '      - { name: Email, kind: email }\n      - { name: Phone, kind: phone }',
        ),
    )
    writeFileSync(join(next, 'NOTES.md'), '# Bakery\n\nNewer notes.\n')
    writeFileSync(
      join(next, 'skills/count/SKILL.md'),
      '---\nname: count\ndescription: newer\n---\nNewer words.\n',
    )
    writeFileSync(
      join(next, 'setup.yaml'),
      'Suppliers:\n  - key: mill\n    values: { Name: Mill & Sons, Email: mill@example.com }\n  - key: dairy\n    values: { Name: Dairy Farm Ltd, Email: dairy@example.com }\n',
    )
    writeFileSync(join(next, 'skills/count/README.md'), 'New in 0.2.0.\n')

    const report = await update(world, 'Bakery', next, ctx)
    expect(report).toEqual({
      replaced: ['NOTES.md'],
      kept: ['skills/count/SKILL.md'],
      added: ['skills/count/README.md'],
      rowsLanded: 1,
      rowsKept: 1,
    })
    expect(readFileSync(join(m.dir, 'skills/count/SKILL.md'), 'utf8')).toContain('My words.')
    expect(readFileSync(join(m.dir, 'NOTES.md'), 'utf8')).toContain('Newer notes.')
    const rows = world.records.list(suppliers)
    expect(rows.map((r) => [r.values.name, r.values.email])).toEqual([
      ['Mill & Sons', 'mill@example.com'],
      ['Dairy Farm', 'orders@dairy.example'],
    ])
    expect(world.shape.table('Suppliers')?.fields.map((f) => f.name)).toEqual([
      'Name',
      'Email',
      'Phone',
    ])
    expect(installedKits(world)[0]?.version).toBe('0.2.0')
    expect((await history(m.dir)).map((c) => c.message)).toEqual([
      'Updated Bakery 0.2.0',
      'Before the kit update',
      'Installed Bakery 0.1.0',
    ])
  })
})
