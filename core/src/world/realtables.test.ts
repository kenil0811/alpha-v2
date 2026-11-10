// Real tables: the shape changing under populated tables: fields added, renamed and removed, list
// relations, pointers cleared.
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { World } from './world.ts'

const alpha = { kind: 'alpha' as const }
const looked = { kind: 'looked_up' as const, source: { url: 'https://example.com' } }
let home: string

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), 'alpha-real-'))
})
afterEach(() => {
  rmSync(home, { recursive: true, force: true })
})

describe('the shape changing under rows', () => {
  let world: World
  beforeEach(async () => {
    world = await World.open(join(home, 'tenants', 't_test'))
  })
  afterEach(() => world.close())

  function shop() {
    const m = world.shape.makeModule('Shop', { actor: alpha })
    const sources = world.shape.makeTable(m.id, 'Sources', [{ name: 'Name', kind: 'text' }], {
      actor: alpha,
    })
    const deals = world.shape.makeTable(
      m.id,
      'Deals',
      [
        { name: 'Name', kind: 'text' },
        { name: 'Price', kind: 'money' },
        { name: 'Source', kind: 'relation', relatesTo: 'Sources' },
        { name: 'Seen at', kind: 'relation', relatesTo: 'Sources', many: true },
      ],
      { actor: alpha },
    )
    const [s1, s2] = world.records.add(
      sources.id,
      [
        { values: { Name: 'Broker A' }, provenance: looked },
        { values: { Name: 'Broker B' }, provenance: looked },
      ],
      { actor: alpha },
    ) as [string, string]
    const [d1, d2] = world.records.add(
      deals.id,
      [
        {
          values: {
            Name: 'Deal one',
            Price: { amount: 10, currency: 'USD' },
            Source: s1,
            'Seen at': [s2, s1],
          },
          provenance: looked,
        },
        { values: { Name: 'Deal two', Source: s2, 'Seen at': [s2] }, provenance: looked },
      ],
      { actor: alpha },
    ) as [string, string]
    return { m, sources, deals, s1, s2, d1, d2 }
  }

  it('keeps list relations in order and one-row relations as one', () => {
    const { deals, s1, s2, d1 } = shop()
    const rows = world.records.list(deals.id)
    expect(rows[0]?.values).toMatchObject({ source: s1, seen_at: [s2, s1] })
    expect(() =>
      world.records.change(
        deals.id,
        [{ id: d1, values: { Source: [s1, s2] }, provenance: looked }],
        { actor: alpha },
      ),
    ).toThrow(/holds one row/)
    world.records.change(deals.id, [{ id: d1, values: { 'Seen at': [s1] }, provenance: looked }], {
      actor: alpha,
    })
    expect(world.records.get(d1)?.record.values.seen_at).toEqual([s1])
    expect(world.sql.query('SELECT other_id FROM deals__seen_at ORDER BY record_id').total).toBe(2)
  })

  it('clears the pointers at a removed row, in the same transaction, and says how many', () => {
    const { sources, deals, s2, d1, d2 } = shop()
    expect(world.shape.pointersAt(sources.id, [s2])).toBe(2)
    world.records.remove(sources.id, [s2], { actor: alpha })
    const rows = world.records.list(deals.id)
    expect(rows.find((r) => r.id === d1)?.values.seen_at).toEqual([
      world.records.list(sources.id)[0]?.id,
    ])
    expect(rows.find((r) => r.id === d2)?.values.source).toBeUndefined()
    expect(rows.find((r) => r.id === d2)?.values.seen_at).toBeUndefined()
    expect(world.lines({ kinds: ['removed'] })[0]?.words).toMatch(
      /cleared from 2 rows pointing at it/,
    )
  })

  it('adds, renames and removes a field on a populated table, keeping the rest', () => {
    const { deals, d1 } = shop()
    world.shape.addFields(deals.id, [{ name: 'Stage', kind: 'choice', choices: ['New'] }], {
      actor: alpha,
    })
    world.records.change(deals.id, [{ id: d1, values: { Stage: 'New' }, provenance: looked }], {
      actor: alpha,
    })
    world.views.save(
      { table: deals.id, name: 'By stage', config: { sorts: [{ field: 'Stage', dir: 'asc' }] } },
      { actor: alpha },
    )
    world.shape.rename({ table: deals.id, field: 'Stage' }, 'Step', { actor: alpha })
    world.shape.rename({ table: deals.id, field: 'Price' }, 'Asking', { actor: alpha })
    let row = world.records.get(d1)?.record
    expect(row?.values).toMatchObject({ step: 'New', asking: { amount: 10, currency: 'USD' } })
    expect(row?.provenance.step?.kind).toBe('looked_up')
    expect(world.sql.query('SELECT step, asking, asking_currency FROM deals').rows[0]).toEqual({
      step: 'New',
      asking: 10,
      asking_currency: 'USD',
    })
    world.shape.removeField(deals.id, 'Step', { actor: alpha })
    row = world.records.get(d1)?.record
    expect(row?.values.step).toBeUndefined()
    expect(row?.version).toBe(2)
    expect(world.records.history(d1, 'name').map((h) => h.value)).toEqual(['Deal one'])
    expect(world.views.list(deals.id)[0]?.config.sorts).toEqual([])
    expect(world.shape.table(deals.id)?.fields.map((f) => f.name)).toEqual([
      'Name',
      'Asking',
      'Source',
      'Seen at',
    ])
    expect(() => world.sql.query('SELECT step FROM deals')).toThrow()
  })

  it('renames a table with its junction tables, and removes a table with what pointed at it', () => {
    const { sources, deals, s1 } = shop()
    world.shape.rename({ table: deals.id }, 'Listings', { actor: alpha })
    expect(world.sql.query('SELECT count(*) AS n FROM listings__seen_at').rows).toEqual([{ n: 3 }])
    world.shape.rename({ table: deals.id, field: 'Seen at' }, 'Seen on', { actor: alpha })
    expect(world.sql.query('SELECT count(*) AS n FROM listings__seen_on').rows).toEqual([{ n: 3 }])
    world.shape.removeTable(sources.id, { actor: alpha })
    const rows = world.records.list(deals.id)
    expect(rows.every((r) => r.values.source === undefined && r.values.seen_on === undefined)).toBe(
      true,
    )
    expect(world.records.get(s1)).toBeUndefined()
    // each deal keeps the one provenance its values share; the sources' rows went with them
    expect(world.db.prepare('SELECT count(*) AS n FROM provenance').get()).toEqual({ n: 2 })
  })

  it("keeps the wall: the file's own tables stay closed under a view's name, JSON tables open", () => {
    const { deals } = shop()
    expect(world.sql.query('SELECT name FROM deals').total).toBe(2)
    expect(() => world.sql.query('SELECT made_by FROM main.deals')).toThrow(/views only/)
    expect(() => world.sql.query('SELECT source FROM main.provenance')).toThrow(/views only/)
    expect(() => world.sql.query('SELECT data FROM main.journal')).toThrow(/views only/)
    expect(world.sql.query("SELECT value FROM json_each('[1, 2]')").total).toBe(2)
    expect(world.sql.query('SELECT field, kind FROM provenance').total).toBeGreaterThan(0)
    expect(deals.slug).toBe('deals')
  })

  it('takes a null as no value: the same landing again changes nothing, and carries no provenance', () => {
    const { deals } = shop()
    const item = [{ key: 'x1', values: { Name: 'Deal x', Price: null } }]
    const first = world.records.land(deals.id, item, { connector: 'c' }, { actor: alpha })
    const again = world.records.land(deals.id, item, { connector: 'c' }, { actor: alpha })
    expect([first, again]).toEqual([
      { added: 1, changed: 0, same: 0 },
      { added: 0, changed: 0, same: 1 },
    ])
    const row = world.records.get(world.records.byKey(deals.id, 'x1') as string)?.record
    expect(row?.values).toEqual({ name: 'Deal x' })
    expect(Object.keys(row?.provenance ?? {})).toEqual(['name'])
    expect(world.db.prepare('SELECT count(*) AS n FROM versions').get()).toEqual({ n: 0 })
  })

  it("keeps the model's own names for itself, and steps a renamed field aside too", () => {
    const { deals, m } = shop()
    const t = world.shape.makeTable(m.id, 'People at', [{ name: 'Name', kind: 'text' }], {
      actor: alpha,
    })
    expect(t.slug).toBe('people_at_table')
    expect(world.sql.query('SELECT count(*) AS n FROM people_at').total).toBe(1)
    world.shape.rename({ table: deals.id, field: 'Name' }, 'Version', { actor: alpha })
    expect(world.shape.table(deals.id)?.fields[0]?.slug).toBe('version_field')
    expect(world.sql.query('SELECT version_field FROM deals').total).toBe(2)
  })

  it('keeps one provenance per row where the values came the same way, and a row per field that differs', () => {
    const { deals, d1 } = shop()
    const rows = (sql: string) => Number((world.db.prepare(sql).get() as { n: number }).n)
    expect(rows("SELECT count(*) AS n FROM provenance WHERE field_id = ''")).toBe(4)
    expect(rows("SELECT count(*) AS n FROM provenance WHERE field_id != ''")).toBe(0)
    world.records.change(
      deals.id,
      [
        {
          id: d1,
          values: { Name: 'Deal one, said' },
          provenance: { kind: 'estimated', basis: 'a guess' },
        },
      ],
      { actor: alpha },
    )
    expect(rows("SELECT count(*) AS n FROM provenance WHERE field_id != ''")).toBe(1)
    const row = world.records.get(d1)?.record
    expect(row?.provenance.name?.kind).toBe('estimated')
    expect(row?.provenance.price?.kind).toBe('looked_up')
    // looked up again, at a later time: still its own row, as its time differs from the row's
    world.records.change(deals.id, [{ id: d1, values: { Name: 'Deal one' }, provenance: looked }], {
      actor: alpha,
    })
    expect(rows("SELECT count(*) AS n FROM provenance WHERE field_id != ''")).toBe(1)
    expect(world.records.get(d1)?.record.provenance.name?.kind).toBe('looked_up')
    expect(world.sql.query(`SELECT field FROM provenance WHERE record_id = '${d1}'`).total).toBe(4)
  })

  it('refuses a field whose slug a column of every table has, by stepping it aside', () => {
    const { deals } = shop()
    world.shape.addFields(deals.id, [{ name: 'Version', kind: 'text' }], { actor: alpha })
    expect(world.shape.table(deals.id)?.fields.at(-1)?.slug).toBe('version_field')
    expect(
      (world.db.prepare('PRAGMA table_info(deals)').all() as { name: string }[]).map((c) => c.name),
    ).toContain('version_field')
  })
})
