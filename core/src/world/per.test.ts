// One row per person and the fold of a merge (core step 3d, Kenil's yes 27 Oct): a per-person
// table refuses a second row and lands on the person's row; merging two people folds their rows
// by the rules, re-points every row naming the merged-in one, and unmerge puts it all back.
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { checkKit } from '@alpha/kit-sdk'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { parse } from 'yaml'
import { FOLD_PICK, setPer } from './records/fold.ts'
import type { Table } from './shape/index.ts'
import { World } from './world.ts'

const alpha = { actor: { kind: 'alpha' as const } }
const person = { actor: { kind: 'person' as const, id: 'u_1' }, user: 'u_1' }
const looked = { kind: 'looked_up' as const, source: { url: 'https://example.com' } }
const said = { kind: 'stated' as const, source: { user: 'u_1', message: 1 } }
let home: string
let world: World

beforeEach(async () => {
  home = mkdtempSync(join(tmpdir(), 'alpha-per-'))
  world = await World.open(join(home, 'tenants', 't_test'))
})
afterEach(() => {
  world.close()
  rmSync(home, { recursive: true, force: true })
})

// Two people from contact cards, a per-person Tiers table, Members naming people, and Calls
// linking to a Tiers row.
function circle() {
  const m = world.shape.makeModule('Circle', alpha)
  const cards = world.shape.makeTable(
    m.id,
    'Cards',
    [
      { name: 'Name', kind: 'text' },
      { name: 'Email', kind: 'email' },
    ],
    alpha,
  )
  world.people.mapTable(cards.id, { each: 'person', name: 'Name', emails: 'Email' }, alpha)
  world.records.add(
    cards.id,
    [
      { values: { Name: 'Ann Lee', Email: 'ann@lee.example' }, provenance: looked },
      { values: { Name: 'Ann L', Email: 'ann.l@mail.example' }, provenance: looked },
    ],
    alpha,
  )
  const id = (name: string) =>
    (world.people.list('person', name).find((p) => p.name === name) as { id: string }).id
  const tiers = world.shape.makeTable(
    m.id,
    'Tiers',
    [
      { name: 'Person', kind: 'person', per: 'person' },
      { name: 'Tier', kind: 'choice', choices: ['Gold', 'Silver'] },
      { name: 'Score', kind: 'number' },
      { name: 'Tags', kind: 'choice', choices: ['Lender', 'Broker', 'Friend'], many: true },
      { name: 'Notes', kind: 'notes' },
    ],
    alpha,
  )
  const members = world.shape.makeTable(
    m.id,
    'Members',
    [
      { name: 'Person', kind: 'person' },
      { name: 'Circle', kind: 'text' },
    ],
    alpha,
  )
  const calls = world.shape.makeTable(
    m.id,
    'Calls',
    [
      { name: 'About', kind: 'text' },
      { name: 'Tier row', kind: 'relation', relatesTo: 'Tiers' },
    ],
    alpha,
  )
  return { tiers, members, calls, ann: id('Ann Lee'), annL: id('Ann L') }
}

const rows = (t: Table) => world.records.list(t.id)

describe('one row per person', () => {
  it('refuses a second row, or a row with no one, and a land finds the person’s row', () => {
    const { tiers, ann, annL } = circle()
    world.records.add(
      tiers.id,
      [{ values: { Person: ann, Tier: 'Gold' }, provenance: said }],
      person,
    )
    expect(() =>
      world.records.add(
        tiers.id,
        [{ values: { Person: 'Ann Lee', Tier: 'Silver' }, provenance: said }],
        person,
      ),
    ).toThrow('Tiers has a row for Ann Lee already; change that one.')
    expect(() =>
      world.records.add(tiers.id, [{ values: { Tier: 'Silver' }, provenance: said }], person),
    ).toThrow(/needs its Person/)
    const [other] = world.records.add(
      tiers.id,
      [{ values: { Person: annL, Tier: 'Silver' }, provenance: said }],
      person,
    ) as [string]
    expect(() =>
      world.records.change(
        tiers.id,
        [{ id: other, values: { Person: ann }, provenance: said }],
        person,
      ),
    ).toThrow(/has a row for Ann Lee already/)
    // an agent's land, keyed its own way, finds Ann's row and changes it
    world.records.land(
      tiers.id,
      [{ key: 'score:ann', values: { Person: ann, Score: 7 } }],
      { connector: 'test' },
      alpha,
    )
    expect(rows(tiers).map((r) => [r.values.tier, r.values.score])).toEqual([
      ['Gold', 7],
      ['Silver', undefined],
    ])
  })

  it('is set on a table with rows by folding the rows that share a person', () => {
    const { members, ann, annL } = circle()
    world.records.add(
      members.id,
      [
        { values: { Person: ann, Circle: 'Advisers' }, provenance: looked },
        { values: { Person: annL, Circle: 'Lenders' }, provenance: looked },
        { values: { Person: ann, Circle: 'Friends' }, provenance: said },
      ],
      alpha,
    )
    setPer(world.records, members.id, 'Person', person)
    const t = world.shape.table(members.id) as Table
    expect(t.fields.find((f) => f.name === 'Person')?.per).toBe('person')
    // the person's word stands over what Alpha found
    expect(rows(t).map((r) => r.values.circle)).toEqual(['Friends', 'Lenders'])
    expect(world.lines({ kinds: ['folded'] }).at(-1)?.words).toBe(
      'Folded 1 row of Members into the row of the person it shares, to make it one row per person.',
    )
    expect(() =>
      world.shape.addFields(t.id, [{ name: 'Also', kind: 'person', per: 'person' }], person),
    ).toThrow(/one row per person already/)
  })
})

describe('a merge', () => {
  function both() {
    const s = circle()
    const [keep] = world.records.add(
      s.tiers.id,
      [
        {
          values: { Person: s.ann, Score: 3, Tags: ['Lender'], Notes: 'Met at the fair.' },
          provenance: looked,
        },
      ],
      alpha,
    ) as [string]
    const [other] = world.records.add(
      s.tiers.id,
      [
        {
          values: {
            Person: s.annL,
            Tier: 'Gold',
            Score: 5,
            Tags: ['Broker', 'Lender'],
            Notes: 'Owes a call.',
          },
          provenance: said,
        },
      ],
      person,
    ) as [string]
    world.records.add(
      s.members.id,
      [
        { values: { Person: s.ann, Circle: 'Advisers' }, provenance: looked },
        { values: { Person: s.annL, Circle: 'Lenders' }, provenance: looked },
      ],
      alpha,
    )
    world.records.add(
      s.calls.id,
      [{ values: { About: 'Intro', 'Tier row': other }, provenance: looked }],
      alpha,
    )
    return { ...s, keep, other }
  }

  it('folds their rows by the rules, and every row names the kept one', () => {
    const s = both()
    world.people.merge(s.ann, s.annL, person)
    const [one, ...more] = rows(s.tiers)
    expect(more).toEqual([])
    expect(one?.id).toBe(s.keep)
    expect(one?.values).toMatchObject({
      person: s.ann,
      tier: 'Gold', // none on the kept row: the other's
      score: 5, // the person's word over what Alpha found
      tags: ['Lender', 'Broker'], // every tag, the kept row's first
      notes: 'Met at the fair.\n\n---\n\nOwes a call.', // both
    })
    expect(world.records.column(s.members.id, 'Person').map((v) => v.value)).toEqual([s.ann, s.ann])
    expect(world.records.column(s.calls.id, 'Tier row').map((v) => v.value)).toEqual([s.keep])
    expect(world.lines({ kinds: ['folded'] }).at(-1)?.words).toBe(
      'Ann L is Ann Lee now: their rows in Tiers are one, and 1 row names Ann Lee.',
    )
  })

  it('asks on a card where two values of the person’s differ, and the pick is theirs', () => {
    const s = circle()
    const [keep] = world.records.add(
      s.tiers.id,
      [{ values: { Person: s.ann, Tier: 'Silver' }, provenance: said }],
      person,
    ) as [string]
    world.records.add(
      s.tiers.id,
      [{ values: { Person: s.annL, Tier: 'Gold' }, provenance: said }],
      person,
    )
    world.people.merge(s.ann, s.annL, person)
    const card = world.cards.waiting('u_1').find((c) => c.call?.tool === FOLD_PICK)
    expect(card?.words).toBe('Tiers: Ann Lee had two Tiers of yours. Which stays?')
    expect(card?.options).toEqual(['Silver', 'Gold'])
    expect(world.records.get(keep)?.record.values.tier).toBe('Silver')
    world.cards.answer(card?.id as string, 'Gold', person.actor)
    expect(world.records.get(keep)?.record.values.tier).toBe('Gold')
    expect(world.records.get(keep)?.record.provenance.tier?.source.card).toBe(card?.id)
  })

  it('is undone by an unmerge: the folded row back, values and links where they were', () => {
    const s = both()
    world.people.merge(s.ann, s.annL, person)
    world.people.unmerge(s.annL, person)
    const back = rows(s.tiers)
    expect(back.map((r) => [r.id, r.values.person, r.values.score, r.values.tier])).toEqual([
      [s.keep, s.ann, 3, undefined],
      [s.other, s.annL, 5, 'Gold'],
    ])
    expect(world.records.column(s.members.id, 'Person').map((v) => v.value)).toEqual([
      s.ann,
      s.annL,
    ])
    expect(world.records.column(s.calls.id, 'Tier row').map((v) => v.value)).toEqual([s.other])
    expect(world.lines({ kinds: ['people'] }).at(-1)?.words).toMatch(
      /^Ann L is not Ann Lee\. Their rows: In Tiers, 4 values return and 1 row comes back; in Calls, 1 value returns; in Members, 1 value returns\.$/,
    )
    // Activity never offers to revert the fold on its own, nor the unmerge's revert of it
    expect(world.lines({ kinds: ['reverted'] }).at(-1)?.data.unfold).toBe(true)
  })

  it('says what stays when the folded row is gone for good', () => {
    const s = both()
    world.people.merge(s.ann, s.annL, person)
    world.db.exec('DELETE FROM removed_rows')
    world.people.unmerge(s.annL, person)
    expect(rows(s.tiers).map((r) => r.values.score)).toEqual([5])
    expect(world.lines({ kinds: ['people'] }).at(-1)?.words).toMatch(
      /^Ann L is not Ann Lee\. Their rows: In Members, 1 value returns\. 1 row of Tiers folded in is gone for good; what it held stays on the row it was folded into\.$/,
    )
  })
})

describe('per in a kit', () => {
  it('is checked, installed and mirrored', async () => {
    const kit = join(home, 'kit')
    mkdirSync(kit)
    const yaml = (extra: string) => `name: Book
version: 0.1.0
api: 1
tables:
  - name: Tiers
    fields:
      - { name: Person, kind: person, per: person }
      - { name: Tier, kind: text${extra} }
`
    writeFileSync(join(kit, 'module.yaml'), yaml(', per: person'))
    expect(checkKit(kit)).toEqual([
      "Tiers's Tier: only a person field holds one row per person (per).",
      'Tiers says per on more than one field; a table is one row per one person.',
    ])
    writeFileSync(join(kit, 'module.yaml'), yaml(''))
    expect(checkKit(kit)).toEqual([])
    const { install } = await import('../modules/kits/index.ts')
    const m = await install(world, kit, person)
    expect(world.shape.table('Tiers')?.fields[0]?.per).toBe('person')
    const mirror = parse(readFileSync(join(m.dir, 'module.yaml'), 'utf8')) as {
      tables: { fields: { name: string; per?: string }[] }[]
    }
    expect(mirror.tables[0]?.fields[0]?.per).toBe('person')
  })
})
