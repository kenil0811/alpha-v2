// The kit installer and the ownership rule, on a made-up kit (test-kit/): never a client's.
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { World } from '../world/world.ts'
import { agents } from './agents.ts'
import { history } from './git.ts'
import { install, installedKits, takeBack, update, yours } from './kits/index.ts'

const KIT = join(import.meta.dirname, 'test-kit')
let home: string
let world: World
const ctx = { actor: { kind: 'person' as const, id: 'u_1' }, user: 'u_1' }
const alpha = { kind: 'alpha' as const }

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
      {
        module: m.id,
        kit: 'Bakery',
        version: '0.1.0',
        source: KIT,
        api: 1,
        maintainer: null,
        core: false,
      },
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

  it('names the documents a table’s rows take, and a newer version adds kinds', async () => {
    const withDocs = (dir: string, version: string, kinds: string) =>
      writeFileSync(
        join(dir, 'module.yaml'),
        readFileSync(join(KIT, 'module.yaml'), 'utf8')
          .replace('version: 0.1.0', `version: ${version}`)
          .replace('  - name: Orders\n', `  - name: Orders\n    documents: [${kinds}]\n`),
      )
    const first = join(home, 'kit-docs-1')
    cpSync(KIT, first, { recursive: true })
    withDocs(first, '0.1.0', 'Invoice')
    const m = await install(world, first, ctx)
    expect(world.shape.table('Orders')?.documents).toEqual(['Invoice'])
    const next = join(home, 'kit-docs-2')
    cpSync(KIT, next, { recursive: true })
    withDocs(next, '0.2.0', 'Invoice, Receipt')
    await update(world, 'Bakery', next, ctx)
    expect(world.shape.table('Orders')?.documents).toEqual(['Invoice', 'Receipt'])
    expect(readFileSync(join(m.dir, 'module.yaml'), 'utf8')).toContain('documents:')
  })

  it('says how a table’s rows name people, and its setup rows become people', async () => {
    const dir = join(home, 'kit-people')
    cpSync(KIT, dir, { recursive: true })
    writeFileSync(
      join(dir, 'module.yaml'),
      readFileSync(join(KIT, 'module.yaml'), 'utf8').replace(
        '  - name: Suppliers\n',
        '  - name: Suppliers\n    people: { each: person, name: Name, emails: Email }\n',
      ),
    )
    const m = await install(world, dir, ctx)
    expect(world.shape.table('Suppliers')?.people).toEqual({
      each: 'person',
      name: 'Name',
      emails: 'Email',
    })
    const mill = world.people.byKey('email', 'mill@example.com') as string
    expect(world.people.get(mill)?.name).toBe('Mill & Co')
    expect(readFileSync(join(m.dir, 'module.yaml'), 'utf8')).toContain('people:')
  })

  it('leaves the folder as it was when an update fails, so a later one brings its files', async () => {
    const m = await install(world, KIT, ctx)
    const other = world.shape.makeModule('Shop', ctx)
    world.shape.makeTable(other.id, 'Deliveries', [{ name: 'Day', kind: 'date' }], ctx)
    const next = join(home, 'kit-clash')
    cpSync(KIT, next, { recursive: true })
    writeFileSync(join(next, 'NOTES.md'), '# Bakery\nNewer notes.\n')
    writeFileSync(
      join(next, 'module.yaml'),
      `${readFileSync(join(KIT, 'module.yaml'), 'utf8').replace('version: 0.1.0', 'version: 0.2.0').replace('network:', '  - name: Deliveries\n    fields:\n      - { name: Day, kind: date }\nnetwork:')}`,
    )
    await expect(update(world, 'Bakery', next, ctx)).rejects.toThrow(
      /There is already a table called Deliveries in Shop/,
    )
    expect(readFileSync(join(m.dir, 'NOTES.md'), 'utf8')).not.toContain('Newer notes')
    writeFileSync(
      join(next, 'module.yaml'),
      readFileSync(join(KIT, 'module.yaml'), 'utf8').replace('version: 0.1.0', 'version: 0.2.0'),
    )
    const report = await update(world, 'Bakery', next, ctx)
    expect(report.replaced).toEqual(['NOTES.md'])
    expect(readFileSync(join(m.dir, 'NOTES.md'), 'utf8')).toContain('Newer notes')
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

describe('a module inside another', () => {
  const kitWithin = (version: string, within: string | null) => {
    const dir = join(home, `kit-${version}`)
    cpSync(KIT, dir, { recursive: true })
    const yaml = readFileSync(join(KIT, 'module.yaml'), 'utf8').replace(
      'version: 0.1.0',
      `version: ${version}${within ? `\nwithin: ${within}` : ''}`,
    )
    writeFileSync(join(dir, 'module.yaml'), yaml)
    return dir
  }

  it('goes inside the module its kit names, made empty when there is none', async () => {
    const m = await install(world, kitWithin('0.1.0', 'Shops'), ctx)
    const shops = world.shape.module('Shops')
    expect(shops && world.shape.tables(shops.id)).toEqual([])
    expect(world.shape.module(m.id)?.parent).toBe(shops?.id)
    expect(world.shape.placedBy(m.id)).toBe('kit')
    expect(readFileSync(join(m.dir, 'module.yaml'), 'utf8')).toContain('within: Shops')
    expect(world.lines({ kinds: ['shaped'] }).map((l) => l.words)).toContain(
      'Put Bakery inside Shops.',
    )
  })

  it('keeps where the person put it over the kit’s place on update', async () => {
    const m = await install(world, kitWithin('0.1.0', 'Shops'), ctx)
    world.shape.makeModule('Kitchen', ctx)
    world.shape.place(m.id, 'Kitchen', ctx)
    await update(world, 'Bakery', kitWithin('0.2.0', 'Shops'), ctx)
    expect(world.shape.module(m.id)?.parent).toBe(world.shape.module('Kitchen')?.id)
    expect(readFileSync(join(m.dir, 'module.yaml'), 'utf8')).toContain('within: Kitchen')
  })

  it('moves an untouched module where a newer kit says', async () => {
    const m = await install(world, kitWithin('0.1.0', null), ctx)
    expect(world.shape.module(m.id)?.parent).toBeNull()
    await update(world, 'Bakery', kitWithin('0.2.0', 'Shops'), ctx)
    expect(world.shape.module(m.id)?.parent).toBe(world.shape.module('Shops')?.id)
  })

  it('never sits inside itself or one of its own modules', async () => {
    const a = world.shape.makeModule('A', ctx)
    const b = world.shape.makeModule('B', ctx)
    const c = world.shape.makeModule('C', ctx)
    world.shape.place(b.id, a.id, ctx)
    world.shape.place(c.id, b.id, ctx)
    expect(() => world.shape.place(a.id, a.id, ctx)).toThrow(/inside itself/)
    expect(() => world.shape.place(a.id, c.id, ctx)).toThrow(/C is inside A/)
    expect(world.shape.within(a.id)).toEqual([a.id, b.id, c.id])
    world.shape.place(c.id, null, ctx)
    expect(world.shape.module(c.id)?.parent).toBeNull()
    expect(world.lines({ kinds: ['shaped'] }).at(-1)?.words).toBe(
      'Moved C out of B, to the top level.',
    )
  })
})

describe('Alpha’s own modules', () => {
  it('installs each shipped kit once with its agents on, and updates it when a newer one ships', async () => {
    const { keepDefaults, newer } = await import('./defaults.ts')
    const dir = join(home, 'defaults')
    cpSync(KIT, join(dir, 'bakery'), { recursive: true })
    const system = { actor: { kind: 'system' as const } }
    expect(await keepDefaults(world, system, dir)).toEqual(["Installed Bakery 0.1.0, Alpha's own."])
    const m = world.shape.module('Bakery')
    expect(m).toBeTruthy()
    const { agents } = await import('./agents.ts')
    expect(agents(world, m?.id).every((a) => a.state === 'on')).toBe(true)
    expect(await keepDefaults(world, system, dir)).toEqual([])
    writeFileSync(
      join(dir, 'bakery', 'module.yaml'),
      readFileSync(join(KIT, 'module.yaml'), 'utf8').replace('version: 0.1.0', 'version: 0.10.0'),
    )
    expect(await keepDefaults(world, system, dir)).toEqual([
      "Updated Bakery to 0.10.0, Alpha's own.",
    ])
    expect(installedKits(world)[0]?.version).toBe('0.10.0')
    expect([newer('0.10.0', '0.9.1'), newer('0.2.0', '0.2.0'), newer('1.0', '0.9.9')]).toEqual([
      true,
      false,
      true,
    ])
  })
})

describe('the contracts a kit signs (step 2)', () => {
  function copyKit(change: (manifest: string) => string, extra?: Record<string, string>): string {
    const dir = join(home, 'kit')
    cpSync(KIT, dir, { recursive: true })
    writeFileSync(join(dir, 'module.yaml'), change(readFileSync(join(KIT, 'module.yaml'), 'utf8')))
    for (const [path, text] of Object.entries(extra ?? {})) writeFileSync(join(dir, path), text)
    return dir
  }

  it('refuses a kit that uses one not there, or an api this Alpha does not serve', async () => {
    const uses = copyKit((m) => `${m}uses:\n  - { kit: Orchard, min: '0.2' }\n`)
    await expect(install(world, uses, ctx)).rejects.toThrow(/uses Orchard, which is not there/)
    const api = copyKit((m) => m.replace('api: 1', 'api: 7'))
    await expect(install(world, api, ctx)).rejects.toThrow(/api: 7; this Alpha serves 1/)
  })

  it('takes a kit with no api as 1 for now, and says so', async () => {
    const dir = copyKit((m) => m.replace('api: 1\n', ''))
    const m = await install(world, dir, ctx)
    expect(installedKits(world)[0]?.api).toBe(1)
    expect(world.lines({ kinds: ['installed'] })[0]?.words).toMatch(/says no api; taken as 1/)
    expect(m.name).toBe('Bakery')
  })

  it('keeps who maintains a kit, and an agent’s description', async () => {
    const dir = copyKit((m) => `${m}maintainer: { name: Avilo, address: kits@avilo.example }\n`, {
      'agents/counter.md':
        '---\nname: Counter\ndescription: Counts the orders.\ntrigger: [{ every: day, at: "07:00" }, { changes: Orders }]\nruns: { script: skills/count/run.js }\ntouches: [Orders]\nbudget: { minutes: 5 }\n---\nCounts the orders each morning.\n',
    })
    const m = await install(world, dir, ctx)
    expect(installedKits(world)[0]?.maintainer).toEqual({
      name: 'Avilo',
      address: 'kits@avilo.example',
    })
    const [counter] = agents(world, m.id)
    expect(counter?.description).toBe('Counts the orders.')
    expect(Array.isArray(counter?.trigger) ? counter.trigger.length : 0).toBe(2)
  })

  it('says what is wrong with a kit before anything installs', async () => {
    const dir = copyKit((m) => m, {
      'agents/bad.md':
        '---\nname: Bad\ntrigger: { changes: Nowhere }\nruns: { script: skills/none/run.js }\ntouches: [Elsewhere]\neffects: [fly]\n---\n',
    })
    await expect(install(world, dir, ctx)).rejects.toThrow(
      /runs skills\/none\/run.js, which is not in the kit.*touches Elsewhere.*names the effect fly.*runs when Nowhere changes.*has no brief/s,
    )
  })
})

describe('stable keys and tombstones (step 2, sub-step 4)', () => {
  function kitAt(version: string, manifest: (m: string) => string, setup?: string): string {
    const dir = join(home, `kit-${version}`)
    cpSync(KIT, dir, { recursive: true })
    writeFileSync(
      join(dir, 'module.yaml'),
      manifest(
        readFileSync(join(KIT, 'module.yaml'), 'utf8').replace(
          'version: 0.1.0',
          `version: ${version}`,
        ),
      ),
    )
    if (setup !== undefined) writeFileSync(join(dir, 'setup.yaml'), setup)
    return dir
  }

  it('renames a field in place when the kit declares it, keyed, and leaves what the person removed removed', async () => {
    const m = await install(
      world,
      kitAt('0.1.0', (x) => x),
      ctx,
    )
    const orders = world.shape.table('Orders') as { id: string }
    world.records.add(
      orders.id,
      [
        {
          values: { Item: 'Flour', Quantity: 2 },
          provenance: { kind: 'estimated', basis: 'a guess' },
        },
      ],
      { actor: alpha },
    )
    // the person removes Quantity and a whole table of the kit's
    world.shape.removeField(orders.id, 'Quantity', ctx)
    world.shape.removeTable((world.shape.table('Suppliers') as { id: string }).id, ctx)
    const newer = kitAt(
      '0.2.0',
      (x) =>
        `${x.replace('{ name: Item, kind: text }', '{ name: What, kind: text, key: Item }')}history:\n  renamed: [{ from: Item, to: What, in: 0.2.0 }]\n`,
    )
    await update(world, m.name, newer, ctx)
    const t = world.shape.table('Orders')
    expect(t?.fields.map((f) => [f.name, f.key])).toEqual([
      ['What', 'Item'],
      ['Supplier', 'Supplier'],
    ])
    expect(world.records.list(orders.id)[0]?.values.what).toBe('Flour')
    expect(world.shape.table('Suppliers')).toBeUndefined()
  })

  it('hides a field the kit no longer uses, keeping its rows, and lists it as removable', async () => {
    const m = await install(
      world,
      kitAt('0.1.0', (x) => x),
      ctx,
    )
    const orders = world.shape.table('Orders') as { id: string }
    world.records.add(
      orders.id,
      [
        {
          values: { Item: 'Flour', Quantity: 2 },
          provenance: { kind: 'estimated', basis: 'a guess' },
        },
      ],
      { actor: alpha },
    )
    const newer = kitAt('0.2.0', (x) => `${x}history:\n  removed: [{ key: Quantity, in: 0.2.0 }]\n`)
    await update(world, m.name, newer, ctx)
    expect(world.shape.table('Orders')?.fields.map((f) => f.name)).toEqual(['Item', 'Supplier'])
    const y = yours(world, m.id)
    expect(y.removed).toEqual([
      {
        table: 'Orders',
        tableId: orders.id,
        fieldId: expect.any(String),
        name: 'Quantity',
        rows: 1,
      },
    ])
    world.shape.removeHiddenField(orders.id, y.removed[0]?.fieldId as string, ctx)
    expect(yours(world, m.id).removed).toEqual([])
    expect(world.records.list(orders.id)[0]?.values).toEqual({ item: 'Flour' })
  })

  it('lists what is yours and gives the kit’s version back', async () => {
    const dir = kitAt(
      '0.1.0',
      (x) => x,
      'Suppliers:\n  - { key: mill, values: { Name: Mill & Co, Email: me@mill.example } }\n',
    )
    const m = await install(world, dir, ctx)
    const suppliers = world.shape.table('Suppliers') as { id: string }
    const row = world.records.byKey(suppliers.id, 'setup:mill') as string
    world.records.change(
      suppliers.id,
      [
        {
          id: row,
          values: { Name: 'Mill and Sons' },
          provenance: { kind: 'estimated', basis: 'said' },
        },
      ],
      { actor: alpha },
    )
    writeFileSync(
      join(m.dir, 'skills', 'count', 'run.js'),
      'export default async () => ({ orders: 1 })',
    )
    const y = yours(world, m.id)
    expect(y.files).toEqual([{ path: 'skills/count/run.js', state: 'changed' }])
    expect(y.rows.map((r) => [r.table, r.key, r.name])).toEqual([
      ['Suppliers', 'mill', 'Mill and Sons'],
    ])
    await takeBack(world, m.id, { kind: 'file', path: 'skills/count/run.js' }, ctx)
    await takeBack(world, m.id, { kind: 'row', table: 'Suppliers', key: 'mill' }, ctx)
    expect(yours(world, m.id)).toMatchObject({ files: [], rows: [] })
    expect(world.records.list(suppliers.id)[0]?.values.name).toBe('Mill & Co')
    // a setup row the person removes stays removed through an update
    world.records.remove(suppliers.id, [row], ctx)
    await update(
      world,
      m.name,
      kitAt(
        '0.1.1',
        (x) => x,
        'Suppliers:\n  - { key: mill, values: { Name: Mill & Co, Email: me@mill.example } }\n',
      ),
      ctx,
    )
    expect(world.records.list(suppliers.id)).toEqual([])
  })

  it('turns a relation into a list when the kit’s newer version says many, keeping each row’s pointer', async () => {
    const m = await install(
      world,
      kitAt('0.1.0', (x) => x),
      ctx,
    )
    const orders = world.shape.table('Orders') as { id: string }
    const suppliers = world.shape.table('Suppliers') as { id: string }
    const [s1] = world.records.add(
      suppliers.id,
      [{ values: { Name: 'Mill' }, provenance: { kind: 'estimated', basis: 'a guess' } }],
      { actor: alpha },
    )
    world.records.add(
      orders.id,
      [
        {
          values: { Item: 'Flour', Supplier: s1 },
          provenance: { kind: 'estimated', basis: 'a guess' },
        },
      ],
      { actor: alpha },
    )
    const newer = kitAt('0.2.0', (x) =>
      x.replace(
        '{ name: Supplier, kind: relation, relates_to: Suppliers }',
        '{ name: Supplier, kind: relation, relates_to: Suppliers, many: true }',
      ),
    )
    await update(world, m.name, newer, ctx)
    expect(world.shape.table('Orders')?.fields.find((f) => f.name === 'Supplier')?.many).toBe(true)
    expect(world.records.list(orders.id)[0]?.values.supplier).toEqual([s1])
  })
})
