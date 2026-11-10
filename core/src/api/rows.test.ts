// A row's view and its notes (core step 3b, Kenil's yes 27 Oct): notes are a field kind, one per
// table, kept like any value but out of the grid and the model's table views; a row is served on
// its own with its parts, the rows that link to it and the notes that mention it; a person's page
// finds the notes that mention them.
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Engine } from '../engine/engine.ts'
import { applyShape } from '../engine/tools/index.ts'
import { revert } from '../world/records/index.ts'
import type { Table } from '../world/shape/index.ts'
import { World } from '../world/world.ts'
import { buildServer } from './server.ts'
import type { RowAround, RowPageView } from './types.ts'

const alpha = { kind: 'alpha' as const }
const looked = { kind: 'looked_up' as const, source: { url: 'https://example.com' } }
let home: string
let world: World
let engine: Engine
const token = 'secret-token'
const ok = { host: '127.0.0.1:4700', 'x-alpha-token': token }

beforeEach(async () => {
  home = mkdtempSync(join(tmpdir(), 'alpha-rows-'))
  world = await World.open(join(home, 'tenants', 't_test'))
  engine = new Engine(world)
})
afterEach(() => {
  engine.close()
  world.close()
  rmSync(home, { recursive: true, force: true })
})

// Clients, with Invoices part of a client and Visits linking to one, through the builder.
function firm() {
  const c = { actor: alpha }
  applyShape(
    world,
    {
      action: 'make_table',
      module: 'Firm',
      table: 'Clients',
      about: 'A client.',
      business_case: { for: 'The owner', keeps: 'Their clients', decides: 'Whom to call' },
      fields: [
        { name: 'Name', kind: 'text', about: 'Its name.' },
        { name: 'Since', kind: 'date', about: 'A client since when.' },
      ],
    },
    c,
  )
  applyShape(
    world,
    {
      action: 'make_table',
      module: 'Firm',
      table: 'Invoices',
      about: 'An invoice.',
      fields: [
        { name: 'Number', kind: 'text', about: 'Its number.' },
        { name: 'Client', kind: 'relation', relates_to: 'Clients', part_of: true, about: 'Whose.' },
      ],
    },
    c,
  )
  applyShape(
    world,
    {
      action: 'make_table',
      module: 'Firm',
      table: 'Visits',
      about: 'A visit.',
      fields: [
        { name: 'Day', kind: 'date', about: 'When.' },
        { name: 'Client', kind: 'relation', relates_to: 'Clients', about: 'Who was visited.' },
      ],
    },
    c,
  )
  const clients = world.shape.table('Clients') as Table
  const [acme, bolt] = world.records.add(
    clients.id,
    [
      { values: { Name: 'Acme' }, provenance: looked },
      { values: { Name: 'Bolt' }, provenance: looked },
    ],
    c,
  ) as [string, string]
  world.records.add(
    (world.shape.table('Invoices') as Table).id,
    [{ values: { Number: 'INV-1', Client: acme }, provenance: looked }],
    c,
  )
  world.records.add(
    (world.shape.table('Visits') as Table).id,
    [{ values: { Day: '2026-10-20', Client: acme }, provenance: looked }],
    c,
  )
  return { clients, acme, bolt }
}

describe('notes', () => {
  it('the builder gives a main table notes, not a part or a setup table; one per table', () => {
    firm()
    const kinds = (n: string) => (world.shape.table(n) as Table).fields.map((f) => f.kind)
    expect(kinds('Clients')).toContain('notes')
    expect(kinds('Invoices')).not.toContain('notes')
    expect(kinds('Visits')).toContain('notes')
    expect(() =>
      world.shape.addFields(
        (world.shape.table('Clients') as Table).id,
        [{ name: 'More', kind: 'notes' }],
        { actor: alpha },
      ),
    ).toThrow(/has its notes already/)
  })

  it('are kept like any value: versioned, found, undone; out of the table view, in row_notes', () => {
    const { clients, acme, bolt } = firm()
    world.records.change(
      clients.id,
      [
        {
          id: acme,
          values: { Notes: `Met at the fair. Ask [Bolt](row:${bolt}) about the lease.` },
          provenance: looked,
        },
      ],
      { actor: alpha, run: 'run_1' },
    )
    expect(world.search('fair').some((h) => h.id === acme)).toBe(true)
    expect(Object.keys(world.sql.query('SELECT * FROM clients').rows[0] ?? {})).not.toContain(
      'notes',
    )
    expect(world.sql.query('SELECT row, "table", notes FROM row_notes').rows).toEqual([
      {
        row: acme,
        table: 'clients',
        notes: `Met at the fair. Ask [Bolt](row:${bolt}) about the lease.`,
      },
    ])
    revert(world.records, { run: 'run_1' }, { actor: { kind: 'person', id: 'u_1' } }, 'the run')
    expect(world.records.get(acme)?.record.values.notes).toBeUndefined()
  })
})

describe('a row on its own', () => {
  it('shows its newest parts with how many in all (core plan step 4)', async () => {
    const { acme } = firm()
    const invoices = world.shape.table('Invoices') as Table
    // the first invoice older by a moment, so the newest twelve never tie with it
    await new Promise((r) => setTimeout(r, 5))
    world.records.add(
      invoices.id,
      Array.from({ length: 20 }, (_, i) => ({
        values: { Number: `INV-${i + 2}`, Client: acme },
        provenance: looked,
      })),
      { actor: alpha },
    )
    const a = buildServer({ engine, user: world.owner('Kenil'), token, ports: [4700] })
    const around = (
      await a.inject({ url: `/api/rows/${acme}/around`, headers: ok })
    ).json() as RowAround
    expect(around.parts[0]?.count).toBe(21)
    // the twelve changed most lately: the first invoice, the oldest, waits in Open as a table
    const shown = around.parts[0]?.rows.map((r) => r.values.number)
    expect(shown).toHaveLength(12)
    expect(shown).not.toContain('INV-1')
  })

  it('comes with its fields and title, and what is around it', async () => {
    const { clients, acme, bolt } = firm()
    world.records.change(
      clients.id,
      [
        {
          id: bolt,
          values: { Notes: `Shares a yard with [Acme](row:${acme}).` },
          provenance: looked,
        },
      ],
      { actor: alpha },
    )
    const a = buildServer({ engine, user: world.owner('Kenil'), token, ports: [4700] })
    const page = (await a.inject({ url: `/api/rows/${acme}`, headers: ok })).json() as RowPageView
    expect(page).toMatchObject({
      title: 'Acme',
      table: { name: 'Clients', module: { name: 'Firm' } },
    })
    expect(page.fields.map((f) => f.name)).toEqual(['Name', 'Since', 'Notes'])
    const around = (
      await a.inject({ url: `/api/rows/${acme}/around`, headers: ok })
    ).json() as RowAround
    expect(around.parts).toEqual([
      expect.objectContaining({
        table: expect.objectContaining({ name: 'Invoices' }),
        relation: 'Client',
        rows: [expect.objectContaining({ values: expect.objectContaining({ number: 'INV-1' }) })],
        count: 1,
      }),
    ])
    expect(around.parts[0]?.fields.map((f) => f.name)).toEqual(['Number'])
    expect(around.links).toEqual([
      {
        table: expect.objectContaining({ name: 'Visits' }),
        field: 'Client',
        rows: [expect.objectContaining({ id: expect.any(String) })],
      },
    ])
    expect(around.mentions).toEqual([
      { table: expect.objectContaining({ name: 'Clients' }), rows: [{ id: bolt, name: 'Bolt' }] },
    ])
    await a.close()
  })

  it('a person’s page finds the notes that mention them, under a merged id too', async () => {
    const { clients, acme } = firm()
    const me = world.owner('Kenil')
    // a person, as a contact card brings one
    const cm = world.shape.makeModule('Contacts', { actor: alpha })
    const cards = world.shape.makeTable(
      cm.id,
      'Cards',
      [
        { name: 'Name', kind: 'text' },
        { name: 'Email', kind: 'email' },
      ],
      { actor: alpha },
    )
    world.people.mapTable(
      cards.id,
      { each: 'person', name: 'Name', emails: 'Email' },
      { actor: alpha },
    )
    world.records.add(
      cards.id,
      [{ values: { Name: 'Ann Lee', Email: 'ann@lee.example' }, provenance: looked }],
      {
        actor: alpha,
      },
    )
    const ann = world.people.list('person', 'Ann')[0] as { id: string }
    world.records.change(
      clients.id,
      [
        {
          id: acme,
          values: { Notes: `Call [@Ann Lee](person:${ann.id}) on Monday.` },
          provenance: looked,
        },
      ],
      { actor: alpha },
    )
    const a = buildServer({ engine, user: me, token, ports: [4700] })
    const found = (await a.inject({ url: `/api/people/${ann.id}/mentions`, headers: ok })).json()
    expect(found).toEqual([
      { table: expect.objectContaining({ name: 'Clients' }), rows: [{ id: acme, name: 'Acme' }] },
    ])
    await a.close()
  })
})
