// Summaries and tags (core step 3c, Kenil's yes 27 Oct): a summary field is worked out from the
// rows that point at its row when it is read, in the record store and in the model's view, with
// one condition in a view filter's words; a choice can hold several, kept as a JSON list.
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { checkKit } from '@alpha/kit-sdk'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { parse } from 'yaml'
import { applyShape } from '../engine/tools/index.ts'
import { install } from '../modules/kits/index.ts'
import type { Table } from './shape/index.ts'
import { World } from './world.ts'

const alpha = { actor: { kind: 'alpha' as const } }
const person = { actor: { kind: 'person' as const, id: 'u_1' }, user: 'u_1' }
const looked = { kind: 'looked_up' as const, source: { url: 'https://example.com' } }
let home: string
let world: World

beforeEach(async () => {
  home = mkdtempSync(join(tmpdir(), 'alpha-summary-'))
  world = await World.open(join(home, 'tenants', 't_test'))
})
afterEach(() => {
  world.close()
  rmSync(home, { recursive: true, force: true })
})

const usd = (amount: number) => ({ amount, currency: 'USD' })

// Clients, and Invoices pointing at a client: two for Acme (one paid), none for Bolt.
function firm() {
  const m = world.shape.makeModule('Firm', alpha)
  const clients = world.shape.makeTable(m.id, 'Clients', [{ name: 'Name', kind: 'text' }], alpha)
  const invoices = world.shape.makeTable(
    m.id,
    'Invoices',
    [
      { name: 'Number', kind: 'text' },
      { name: 'Amount', kind: 'money' },
      { name: 'Hours', kind: 'number' },
      { name: 'Sent', kind: 'date' },
      { name: 'Paid', kind: 'choice', choices: ['Yes', 'No'] },
      { name: 'Client', kind: 'relation', relatesTo: 'Clients' },
    ],
    alpha,
  )
  const [acme, bolt] = world.records.add(
    clients.id,
    [
      { values: { Name: 'Acme' }, provenance: looked },
      { values: { Name: 'Bolt' }, provenance: looked },
    ],
    alpha,
  ) as [string, string]
  world.records.add(
    invoices.id,
    [
      {
        values: {
          Number: 'A-1',
          Amount: usd(100),
          Hours: 2,
          Sent: '2026-10-01',
          Paid: 'Yes',
          Client: acme,
        },
        provenance: looked,
      },
      {
        values: {
          Number: 'A-2',
          Amount: usd(250),
          Hours: 5,
          Sent: '2026-10-20',
          Paid: 'No',
          Client: acme,
        },
        provenance: looked,
      },
    ],
    alpha,
  )
  return { m, clients, invoices, acme, bolt }
}

const add = (t: Table, name: string, summary: Record<string, unknown>) =>
  world.shape.addFields(t.id, [{ name, kind: 'summary', summary: summary as never }], alpha)

const held = (id: string, slug: string) => world.records.get(id)?.record.values[slug]

describe('a summary', () => {
  it('counts, sums, takes the least, the most and the latest, with and without a condition', () => {
    const { clients, acme, bolt } = firm()
    add(clients, 'Invoices', { of: 'Invoices', op: 'count' })
    add(clients, 'Billed', { of: 'Invoices', op: 'sum', field: 'Amount' })
    add(clients, 'Owed', {
      of: 'Invoices',
      op: 'sum',
      field: 'Amount',
      where: { field: 'Paid', op: 'in', values: ['No'] },
    })
    add(clients, 'First sent', { of: 'Invoices', op: 'min', field: 'Sent' })
    add(clients, 'Most hours', { of: 'Invoices', op: 'max', field: 'Hours' })
    add(clients, 'Last invoice', { of: 'Invoices', op: 'latest', field: 'Number', by: 'Sent' })
    add(clients, 'Long ones', {
      of: 'Invoices',
      op: 'count',
      where: { field: 'Hours', op: 'gt', value: 3 },
    })
    const rows = Object.fromEntries(world.records.list(clients.id).map((r) => [r.id, r.values]))
    expect(rows[acme]).toMatchObject({
      invoices: 2,
      billed: usd(350),
      owed: usd(250),
      first_sent: '2026-10-01',
      most_hours: 5,
      last_invoice: 'A-2',
      long_ones: 1,
    })
    // none to count or to sum is 0, money in its usual currency; the least of none is not there
    expect(rows[bolt]).toEqual({
      name: 'Bolt',
      invoices: 0,
      billed: usd(0),
      owed: usd(0),
      long_ones: 0,
    })
    // one row read alone comes the same, with what it is in words as its provenance
    const one = world.records.get(acme)?.record
    expect(one?.values.owed).toEqual(usd(250))
    expect(one?.provenance.owed).toMatchObject({
      kind: 'computed',
      source: { formula: 'Sum of Amount in Invoices, where Paid is No' },
    })
    expect(one?.provenance.billed?.source.formula).toBe('Sum of Amount in Invoices')
  })

  it('is a column of the model’s view, worked out as it is read', () => {
    const { clients, invoices, acme } = firm()
    add(clients, 'Owed', {
      of: 'Invoices',
      op: 'sum',
      field: 'Amount',
      where: { field: 'Paid', op: 'in', values: ['No'] },
    })
    add(clients, 'Last invoice', { of: 'Invoices', op: 'latest', field: 'Number', by: 'Sent' })
    add(clients, 'Invoices', { of: 'Invoices', op: 'count' })
    const read = () =>
      world.sql.query(
        'SELECT name, owed, owed_currency, last_invoice, invoices FROM clients ORDER BY name',
      ).rows
    expect(read()).toEqual([
      { name: 'Acme', owed: 250, owed_currency: 'USD', last_invoice: 'A-2', invoices: 2 },
      { name: 'Bolt', owed: 0, owed_currency: 'USD', last_invoice: null, invoices: 0 },
    ])
    world.records.add(
      invoices.id,
      [
        {
          values: { Number: 'A-3', Amount: usd(50), Sent: '2026-10-25', Paid: 'No', Client: acme },
          provenance: looked,
        },
      ],
      alpha,
    )
    expect(read()[0]).toEqual({
      name: 'Acme',
      owed: 300,
      owed_currency: 'USD',
      last_invoice: 'A-3',
      invoices: 3,
    })
    expect(world.sql.describe().find((v) => v.view === 'clients')?.columns).toEqual([
      'id',
      'added',
      'name',
      'owed',
      'owed_currency',
      'last_invoice',
      'invoices',
    ])
  })

  it('leaves amounts in two currencies unadded', () => {
    const { clients, invoices, acme } = firm()
    add(clients, 'Billed', { of: 'Invoices', op: 'sum', field: 'Amount' })
    world.records.add(
      invoices.id,
      [
        {
          values: { Number: 'A-9', Amount: { amount: 5, currency: 'EUR' }, Client: acme },
          provenance: looked,
        },
      ],
      alpha,
    )
    expect(held(acme, 'billed')).toBeUndefined()
    expect(world.sql.query("SELECT billed FROM clients WHERE name = 'Acme'").rows).toEqual([
      { billed: null },
    ])
  })

  it('is never written, and is refused where it would mean nothing', () => {
    const { clients, invoices, acme } = firm()
    add(clients, 'Invoices', { of: 'Invoices', op: 'count' })
    expect(() =>
      world.records.change(
        clients.id,
        [{ id: acme, values: { Invoices: 3 }, provenance: looked }],
        alpha,
      ),
    ).toThrow(/worked out from the rows that point here/)
    expect(() => add(clients, 'Words', { of: 'Invoices', op: 'sum', field: 'Number' })).toThrow(
      /only a number or money adds up/,
    )
    expect(() => add(clients, 'Nothing', { of: 'Invoices', op: 'sum' })).toThrow(/needs the field/)
    expect(() => add(clients, 'Twice', { of: 'Clients', op: 'count' })).toThrow(
      /no field of Clients points at Clients/,
    )
    expect(() =>
      add(clients, 'Odd', {
        of: 'Invoices',
        op: 'count',
        where: { field: 'Paid', op: 'gt', value: 1 },
      }),
    ).toThrow(/a condition on Paid is one of in, empty, not_empty/)
    expect(() =>
      add(clients, 'Odd', {
        of: 'Invoices',
        op: 'count',
        where: { field: 'Paid', op: 'in', values: ['Maybe'] },
      }),
    ).toThrow(/names some of Yes, No/)
    // a summary over a summary
    world.shape.addFields(invoices.id, [{ name: 'Lines', kind: 'number' }], alpha)
    const m = world.shape.module('Firm')
    const lines = world.shape.makeTable(
      m?.id as string,
      'Lines',
      [{ name: 'Invoice', kind: 'relation', relatesTo: 'Invoices' }],
      alpha,
    )
    add(invoices, 'Line count', { of: 'Lines', op: 'count' })
    expect(() => add(clients, 'Deep', { of: 'Invoices', op: 'sum', field: 'Line count' })).toThrow(
      /a summary takes a number, money, a date, words or one choice/,
    )
    expect(lines.name).toBe('Lines')
    // a relation a summary goes through keeps holding one row
    expect(() => world.shape.setMany(invoices.id, 'Client', alpha)).toThrow(
      /sums up Invoices through Client/,
    )
  })

  it('goes with the table or the field it reads, and says so', () => {
    const { clients, invoices } = firm()
    add(clients, 'Owed', {
      of: 'Invoices',
      op: 'sum',
      field: 'Amount',
      where: { field: 'Paid', op: 'in', values: ['No'] },
    })
    add(clients, 'Invoices', { of: 'Invoices', op: 'count' })
    world.shape.removeField(invoices.id, 'Paid', person)
    expect((world.shape.table(clients.id) as Table).fields.map((f) => f.name)).toEqual([
      'Name',
      'Invoices',
    ])
    expect(world.lines({ kinds: ['removed'] }).at(-1)?.words).toBe(
      'Removed the field Paid from Invoices, and the summary Owed in Clients that read it.',
    )
    world.shape.removeTable(invoices.id, person)
    expect((world.shape.table(clients.id) as Table).fields.map((f) => f.name)).toEqual(['Name'])
    expect(world.lines({ kinds: ['removed'] }).at(-1)?.words).toBe(
      'Removed the table Invoices and its 2 rows, and the summary Invoices in Clients that read it.',
    )
    expect(world.sql.query('SELECT * FROM clients').columns).toEqual(['id', 'added', 'name'])
  })

  it('is kept by names in module.yaml, and the builder makes one', () => {
    const { clients, m } = firm()
    applyShape(
      world,
      {
        action: 'add_fields',
        table: 'Clients',
        fields: [
          {
            name: 'Owed',
            kind: 'summary',
            about: 'What the client has not paid yet.',
            summary: {
              of: 'Invoices',
              op: 'sum',
              field: 'Amount',
              where: { field: 'Paid', op: 'in', values: ['No'] },
            },
          },
        ],
      },
      alpha,
    )
    expect(world.records.list(clients.id)[0]?.values.owed).toEqual(usd(250))
    const yaml = parse(readFileSync(join(m.dir, 'module.yaml'), 'utf8')) as {
      tables: { name: string; fields: { name: string; summary?: unknown }[] }[]
    }
    expect(yaml.tables[0]?.fields.find((f) => f.name === 'Owed')?.summary).toEqual({
      of: 'Invoices',
      through: 'Client',
      op: 'sum',
      field: 'Amount',
      where: { field: 'Paid', op: 'in', values: ['No'] },
    })
  })

  it('comes with a kit, made after the tables it reads, and the kit check reads it', async () => {
    const kit = join(home, 'kit')
    mkdirSync(kit)
    const manifest = (extra: string) => `name: Studio
version: 0.1.0
api: 2
tables:
  - name: Clients
    fields:
      - { name: Name, kind: text }
      - name: Owed
        kind: summary
        summary: { of: Invoices, op: sum, field: Amount, where: { field: Paid, op: in, values: [No] } }${extra}
  - name: Invoices
    fields:
      - { name: Amount, kind: money }
      - { name: Paid, kind: choice, choices: [Yes, No] }
      - { name: Tags, kind: choice, choices: [Rush, Retainer], many: true }
      - { name: Client, kind: relation, relates_to: Clients }
`
    writeFileSync(
      join(kit, 'module.yaml'),
      manifest(`
      - name: Wrong
        kind: summary
        summary: { of: Invoices, op: sum, field: Total }
      - { name: Bare, kind: summary }`),
    )
    expect(checkKit(kit)).toEqual([
      "Clients's Wrong names Total, which Invoices does not have.",
      "Clients's Bare: a summary field has a summary, and only a summary field does.",
    ])
    writeFileSync(join(kit, 'module.yaml'), manifest(''))
    expect(checkKit(kit)).toEqual([])
    await install(world, kit, person)
    const clients = world.shape.table('Clients') as Table
    expect(clients.fields.map((f) => [f.name, f.kind])).toEqual([
      ['Name', 'text'],
      ['Owed', 'summary'],
    ])
    expect(world.shape.table('Invoices')?.fields.find((f) => f.name === 'Tags')?.tags).toBe(true)
  })
})

describe('tags', () => {
  function tagged() {
    const { invoices, acme } = firm()
    world.shape.addFields(
      invoices.id,
      [{ name: 'Tags', kind: 'choice', choices: ['Rush', 'Retainer', 'Late'], many: true }],
      alpha,
    )
    const t = world.shape.table(invoices.id) as Table
    const [a, b] = world.records.ids(t.id) as [string, string]
    return { t, a, b, acme }
  }

  it('hold several of the choices, as a list, each once; one alone becomes a list', () => {
    const { t, a, b } = tagged()
    world.records.change(
      t.id,
      [
        { id: a, values: { Tags: ['Rush', 'Late', 'Rush'] }, provenance: looked },
        { id: b, values: { Tags: 'Retainer' }, provenance: looked },
      ],
      alpha,
    )
    expect(held(a, 'tags')).toEqual(['Rush', 'Late'])
    expect(held(b, 'tags')).toEqual(['Retainer'])
    expect(() =>
      world.records.change(
        t.id,
        [{ id: a, values: { Tags: ['Soon'] }, provenance: looked }],
        alpha,
      ),
    ).toThrow(/Tags takes one of "Rush", "Retainer", "Late"/)
    world.records.change(t.id, [{ id: a, values: { Tags: [] }, provenance: looked }], alpha)
    expect(held(a, 'tags')).toBeUndefined()
    expect(world.records.idsWhere(t.id, 'Tags', ['retainer'])).toEqual([b])
    expect(world.search('Retainer').some((h) => h.id === b)).toBe(true)
  })

  it('are read by the model with json_each, and a summary’s condition takes any, all or none of them', () => {
    const { t, a, b, acme } = tagged()
    world.records.change(
      t.id,
      [
        { id: a, values: { Tags: ['Rush', 'Late'] }, provenance: looked },
        { id: b, values: { Tags: ['Rush'] }, provenance: looked },
      ],
      alpha,
    )
    expect(
      world.sql.query(
        "SELECT number FROM invoices WHERE EXISTS (SELECT 1 FROM json_each(tags) WHERE value = 'Late')",
      ).rows,
    ).toEqual([{ number: 'A-1' }])
    const clients = world.shape.table('Clients') as Table
    const count = (name: string, op: string, values: string[]) =>
      add(clients, name, { of: 'Invoices', op: 'count', where: { field: 'Tags', op, values } })
    count('Any', 'in', ['Late', 'Retainer'])
    count('All', 'all_of', ['Rush', 'Late'])
    count('None', 'none_of', ['Late'])
    expect(world.records.get(acme)?.record.values).toMatchObject({ any: 1, all: 1, none: 1 })
    expect(
      world.sql.query('SELECT "any", "all", "none" FROM clients WHERE name = \'Acme\'').rows,
    ).toEqual([{ any: 1, all: 1, none: 1 }])
  })

  it('come from a choice that held one, each row keeping its choice', () => {
    const { invoices, acme } = firm()
    const before = world.records.list(invoices.id).map((r) => r.values.paid)
    world.shape.setMany(invoices.id, 'Paid', alpha)
    const t = world.shape.table(invoices.id) as Table
    expect(t.fields.find((f) => f.name === 'Paid')?.tags).toBe(true)
    expect(world.records.list(invoices.id).map((r) => r.values.paid)).toEqual(
      before.map((v) => [v]),
    )
    // its choices change and it still holds several
    world.shape.setChoices(t.id, 'Paid', ['Yes', 'No', 'Partly'], alpha)
    expect(world.shape.table(t.id)?.fields.find((f) => f.name === 'Paid')?.tags).toBe(true)
    expect(acme).toBeTruthy()
  })
})
