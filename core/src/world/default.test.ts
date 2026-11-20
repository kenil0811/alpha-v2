// A choice field's default (★): the one a new row takes when it gives none, for everyone, computed
// from the default rather than said; set and cleared by the person, journaled, kept to the field's
// own choices, and gone with its choice.
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, expect, it } from 'vitest'
import { World } from './world.ts'

let home: string
let world: World
const alpha = { kind: 'alpha' as const }
const person = { actor: { kind: 'person' as const, id: 'u_1' }, user: 'u_1' }
const looked = { kind: 'looked_up' as const, source: { url: 'https://example.com' } }

beforeEach(async () => {
  home = mkdtempSync(join(tmpdir(), 'alpha-default-'))
  world = await World.open(join(home, 'tenants', 't_test'))
})
afterEach(() => {
  world.close()
  rmSync(home, { recursive: true, force: true })
})

function deals() {
  const m = world.shape.makeModule('Deals desk', { actor: alpha })
  return world.shape.makeTable(
    m.id,
    'Deals',
    [
      { name: 'Name', kind: 'text' },
      { name: 'Stage', kind: 'choice', choices: ['New', 'Looking', 'Passed'] },
      { name: 'Tags', kind: 'choice', choices: ['Hot'], many: true },
    ],
    { actor: alpha },
  )
}

const stage = (t: string) => world.shape.table(t)?.fields.find((f) => f.name === 'Stage')

it('gives a new row with no stage the default, computed from it; a given stage stands', () => {
  const t = deals()
  world.shape.setDefault(t.id, 'Stage', 'Looking', person)
  expect(stage(t.id)?.default).toBe('Looking')
  expect(world.lines({ kinds: ['shaped'] }).at(-1)?.words).toBe(
    'New rows in Deals now start with Stage Looking.',
  )
  const [a, b] = world.records.add(
    t.id,
    [{ values: { Name: 'Acme' } }, { values: { Name: 'Bolt', Stage: 'New' } }].map((r) => ({
      ...r,
      provenance: looked,
    })),
    person,
  )
  const one = world.records.get(a as string)?.record
  expect(one?.values.stage).toBe('Looking')
  expect(one?.provenance.stage?.kind).toBe('computed')
  expect(one?.provenance.stage?.source.formula).toBe('the default of Stage')
  expect(world.records.get(b as string)?.record.values.stage).toBe('New')
})

it('clears, refuses what is no choice or a tags field, and goes with its choice', () => {
  const t = deals()
  expect(() => world.shape.setDefault(t.id, 'Stage', 'Won', person)).toThrow(
    'Won is not one of Stage',
  )
  expect(() => world.shape.setDefault(t.id, 'Tags', 'Hot', person)).toThrow('takes no default')
  world.shape.setDefault(t.id, 'Stage', 'Passed', person)
  world.shape.setTones(t.id, 'Stage', { Passed: 'bad' }, person)
  expect(stage(t.id)?.default).toBe('Passed') // its colours leave it be
  world.shape.setChoices(t.id, 'Stage', ['New', 'Looking'], person)
  expect(stage(t.id)?.default).toBeNull()
  world.shape.setDefault(t.id, 'Stage', 'New', person)
  world.shape.setDefault(t.id, 'Stage', null, person)
  expect(stage(t.id)?.default).toBeNull()
  const [r] = world.records.add(t.id, [{ values: { Name: 'Acme' }, provenance: looked }], person)
  expect(world.records.get(r as string)?.record.values.stage ?? null).toBeNull()
})
