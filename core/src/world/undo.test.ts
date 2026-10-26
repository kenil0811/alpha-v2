// Undo (core step 1, Kenil 26 Oct): removed rows wait whole in the trash and come back with
// their links, provenance, versions and kit row; Revert puts back what a run or a turn did to
// rows, leaves what someone changed since, and can itself be reverted.
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Refused } from './kinds.ts'
import { expire, revert, undoable } from './records/index.ts'
import type { Table } from './shape/index.ts'
import { World } from './world.ts'

const alpha = { kind: 'alpha' as const }
const person = { kind: 'person' as const, id: 'u_test' }
const looked = { kind: 'looked_up' as const, source: { url: 'https://example.com' } }
const stated = { kind: 'stated' as const, source: { message: 1, user: 'u_test' } }
let home: string
let world: World

beforeEach(async () => {
  home = mkdtempSync(join(tmpdir(), 'alpha-undo-'))
  world = await World.open(join(home, 'tenants', 't_test'))
})
afterEach(() => {
  world.close()
  rmSync(home, { recursive: true, force: true })
})

function shop(): { sources: Table; deals: Table; s1: string; s2: string; d1: string } {
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
      { name: 'Stage', kind: 'text' },
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
  const [d1] = world.records.add(
    deals.id,
    [
      {
        values: {
          Name: 'Deal one',
          Price: { amount: 10, currency: 'USD' },
          Source: s1,
          'Seen at': [s1, s2],
        },
        provenance: looked,
      },
    ],
    { actor: alpha },
  ) as [string]
  return { sources, deals, s1, s2, d1 }
}

const values = (id: string) => world.records.get(id)?.record.values
const lastLine = (kind: string) => world.lines({ kinds: [kind] }).at(-1)
const trashCount = () =>
  Number((world.db.prepare('SELECT count(*) AS n FROM removed_rows').get() as { n: number }).n)

describe('the trash', () => {
  it('brings a removed row back whole: links both ways, provenance, versions, Find', () => {
    const { sources, deals, s1, d1 } = shop()
    world.records.change(deals.id, [{ id: d1, values: { Stage: 'New' }, provenance: stated }], {
      actor: person,
    })
    world.records.remove(sources.id, [s1], { actor: person })
    expect(values(d1)).toMatchObject({ name: 'Deal one' })
    expect(values(d1)?.source).toBeUndefined()
    expect(values(d1)?.seen_at).toEqual([expect.any(String)])
    expect(world.search('Broker A').some((h) => h.id === s1)).toBe(false)
    const removal = lastLine('removed')
    expect(undoable(world.records, { line: removal?.id as number })).toBe(true)

    const done = revert(world.records, { line: removal?.id as number }, { actor: person }, '')
    expect(done.words).toBe('In Sources, 1 row comes back.')
    expect(lastLine('reverted')?.words).toBe('Brought back 1 row to Sources.')
    expect(values(s1)).toEqual({ name: 'Broker A' })
    expect(world.records.get(s1)?.record.provenance.name).toMatchObject({ kind: 'looked_up' })
    expect(values(d1)).toMatchObject({ source: s1 })
    expect(values(d1)?.seen_at).toContain(s1)
    expect(world.search('Broker A').some((h) => h.id === s1)).toBe(true)
    expect(trashCount()).toBe(0)

    // the row's own links and its history come back with it
    world.records.remove(deals.id, [d1], { actor: person })
    revert(world.records, { line: lastLine('removed')?.id as number }, { actor: person }, '')
    expect(values(d1)).toMatchObject({ source: s1, price: { amount: 10, currency: 'USD' } })
    expect(values(d1)?.seen_at).toHaveLength(2)
    expect(world.records.history(d1, 'stage').map((h) => h.value)).toEqual(['New'])
    expect(
      world.db.prepare('SELECT count(*) AS n FROM versions WHERE record_id = ?').get(d1),
    ).toEqual({ n: 1 })
  })

  it('leaves out a field removed since, and says so', () => {
    const { deals, d1 } = shop()
    world.records.remove(deals.id, [d1], { actor: person })
    const removal = lastLine('removed')?.id as number
    world.shape.removeField(deals.id, 'Price', { actor: person })
    const preview = revert(world.records, { line: removal }, { actor: person }, '', {
      preview: true,
    })
    expect(preview.left).toEqual([])
    revert(world.records, { line: removal }, { actor: person }, '')
    expect(values(d1)?.price).toBeUndefined()
    expect(values(d1)?.name).toBe('Deal one')
  })

  it('deletes rows for good after keep_removed_days, with a line', () => {
    const { sources, s2 } = shop()
    world.records.remove(sources.id, [s2], { actor: person })
    expect(expire(world.records, 30, new Date(Date.now() + 29 * 86_400_000))).toBe(0)
    expect(trashCount()).toBe(1)
    expect(expire(world.records, 30, new Date(Date.now() + 31 * 86_400_000))).toBe(1)
    expect(trashCount()).toBe(0)
    expect(lastLine('expired')?.words).toMatch(/^Deleted for good a row removed more than 30 days/)
    const preview = revert(
      world.records,
      { line: lastLine('removed')?.id as number },
      { actor: person },
      '',
      { preview: true },
    )
    expect(preview).toEqual({
      can: false,
      words: 'Nothing is left to put back.',
      left: ['1 row of Sources it deleted is gone for good.'],
    })
  })

  it('empties with its table', () => {
    const { sources, deals, d1 } = shop()
    world.records.remove(deals.id, [d1], { actor: person })
    world.records.remove(sources.id, world.records.ids(sources.id), { actor: person })
    expect(trashCount()).toBe(3)
    world.shape.removeTable(deals.id, { actor: person })
    expect(trashCount()).toBe(2)
  })

  it('gives a kit setup row back to its kit', () => {
    const { sources } = shop()
    world.records.land(
      sources.id,
      [{ key: 'setup:c', values: { Name: 'Broker C' } }],
      { connector: 'kit', account: 'Shop' },
      { actor: { kind: 'system' } },
    )
    const c = world.records.byKey(sources.id, 'setup:c') as string
    world.db.prepare("INSERT INTO kit_rows (record_id, installed_hash) VALUES (?, 'h1')").run(c)
    world.records.remove(sources.id, [c], { actor: person })
    expect(world.shape.tombstoned(sources.module.id, 'row', 'setup:c')).toBe(true)
    revert(world.records, { line: lastLine('removed')?.id as number }, { actor: person }, '')
    expect(world.shape.tombstoned(sources.module.id, 'row', 'setup:c')).toBe(false)
    expect(
      world.db.prepare('SELECT installed_hash FROM kit_rows WHERE record_id = ?').get(c),
    ).toEqual({ installed_hash: 'h1' })
  })
})

describe('Revert', () => {
  const agent = { kind: 'agent' as const, id: 'Watson' }

  function aRun() {
    const s = shop()
    const ctx = { actor: agent, run: 'run_1' }
    const [n1, n2] = world.records.add(
      s.deals.id,
      [
        { values: { Name: 'New one', Stage: 'New' }, provenance: looked },
        { values: { Name: 'New two', Stage: 'New' }, provenance: looked },
      ],
      ctx,
    ) as [string, string]
    world.records.change(
      s.deals.id,
      [{ id: s.d1, values: { Stage: 'Won', Name: 'Deal 1' }, provenance: looked }],
      ctx,
    )
    world.records.remove(s.sources.id, [s.s2], ctx)
    return { ...s, n1, n2 }
  }

  it('puts back what a run did, newest first, and says the same in its preview', () => {
    const { deals, d1, s2, n1, n2 } = aRun()
    // the person changes one of the run's rows, and one of its values, after it
    world.records.change(deals.id, [{ id: n2, values: { Stage: 'Lost' }, provenance: stated }], {
      actor: person,
    })
    world.records.change(deals.id, [{ id: d1, values: { Name: 'Deal uno' }, provenance: stated }], {
      actor: person,
    })
    const lines = world.lines({}).length
    const preview = revert(world.records, { run: 'run_1' }, { actor: person }, 'what Watson did', {
      preview: true,
    })
    expect(world.lines({}).length).toBe(lines)
    expect(world.records.get(n1)).toBeDefined()
    expect(preview).toEqual({
      can: true,
      words: 'In Deals, 1 row goes and 1 value returns; in Sources, 1 row comes back.',
      left: [
        'Name on 1 row of Deals changed since; it stays as it is.',
        '1 row of Deals it added was changed since; it stays.',
      ],
    })
    const done = revert(world.records, { run: 'run_1' }, { actor: person }, 'what Watson did')
    expect(done).toEqual(preview)
    expect(world.records.get(n1)).toBeUndefined()
    expect(values(n2)).toMatchObject({ stage: 'Lost' })
    expect(values(d1)).toMatchObject({ name: 'Deal uno' })
    expect(values(d1)?.stage).toBeUndefined()
    expect(values(s2)).toEqual({ name: 'Broker B' })
    expect(lastLine('reverted')?.words).toBe(
      'Reverted what Watson did: in Deals, 1 row went and 1 value returned; in Sources, 1 row came back. Name on 1 row of Deals changed since; it stays as it is. 1 row of Deals it added was changed since; it stays.',
    )
  })

  it('can be reverted itself, putting the run’s work back', () => {
    const { deals, d1, s2, n1 } = aRun()
    revert(world.records, { run: 'run_1' }, { actor: person }, 'what Watson did')
    const undone = lastLine('reverted')?.id as number
    expect(undoable(world.records, { line: undone })).toBe(true)
    const again = revert(world.records, { line: undone }, { actor: person }, 'the revert')
    expect(again.words).toBe(
      'In Sources, 1 row goes; in Deals, 2 values return and 2 rows come back.',
    )
    expect(values(n1)).toMatchObject({ name: 'New one' })
    expect(values(d1)).toMatchObject({ name: 'Deal 1', stage: 'Won' })
    expect(world.records.get(s2)).toBeUndefined()
    expect(world.records.count(deals.id)).toBe(3)
    // and the run's removal is where it was: in the trash under its own line
    expect(
      world.db.prepare('SELECT line_id FROM removed_rows WHERE record_id = ?').get(s2),
    ).toEqual({ line_id: world.lines({ run: 'run_1', kinds: ['removed'] })[0]?.id })
  })

  it('puts back what a run landed', () => {
    const { sources } = shop()
    const ctx = { actor: { kind: 'connector' as const, id: 'brokers' }, run: 'run_2' }
    world.records.land(
      sources.id,
      [{ key: 'a', values: { Name: 'Agency A' } }],
      { connector: 'brokers', account: 'me' },
      ctx,
    )
    world.records.land(
      sources.id,
      [
        { key: 'a', values: { Name: 'Agency A2' } },
        { key: 'b', values: { Name: 'Agency B' } },
      ],
      { connector: 'brokers', account: 'me' },
      { ...ctx, run: 'run_3' },
    )
    const a = world.records.byKey(sources.id, 'a') as string
    const done = revert(world.records, { run: 'run_3' }, { actor: person }, 'the read')
    expect(done.words).toBe('In Sources, 1 row goes and 1 value returns.')
    expect(values(a)).toEqual({ name: 'Agency A' })
    expect(world.records.byKey(sources.id, 'b')).toBeUndefined()
  })

  it('reverts a turn of Alpha’s, and tells the agents watching', () => {
    const { deals } = shop()
    world.records.add(deals.id, [{ values: { Name: 'From chat' }, provenance: stated }], {
      actor: alpha,
      turn: '42',
    })
    expect(undoable(world.records, { turn: '42' })).toBe(true)
    revert(world.records, { turn: '42' }, { actor: person }, 'what Alpha did')
    expect(world.records.count(deals.id)).toBe(1)
    expect(lastLine('reverted')?.data).toMatchObject({ table: deals.id, tables: [deals.id] })
  })

  it('refuses what happened before Alpha could undo', () => {
    const { deals, d1 } = shop()
    world.records.change(deals.id, [{ id: d1, values: { Stage: 'Old' }, provenance: stated }], {
      actor: alpha,
      run: 'run_old',
    })
    world.db.prepare("UPDATE meta SET value = '999999' WHERE key = 'undo_since'").run()
    expect(undoable(world.records, { run: 'run_old' })).toBe(false)
    expect(() => revert(world.records, { run: 'run_old' }, { actor: person }, '')).toThrow(Refused)
    expect(undoable(world.records, { run: 'nothing' })).toBe(false)
  })
})
