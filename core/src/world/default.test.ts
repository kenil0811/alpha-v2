// A choice field's default (★): the one a new row takes when it gives none, for everyone, computed
// from the default rather than said; set and cleared by the person, journaled, kept to the field's
// own choices, and gone with its choice.
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Connector } from '@alpha/connector-sdk'
import { checkKit } from '@alpha/kit-sdk'
import { afterEach, beforeEach, expect, it } from 'vitest'
import { landIn } from '../connectors/places.ts'
import { run } from './db.ts'
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

it('is the table’s shape: in module.yaml, said when it goes with its choice, refused where the shape is not the firm’s', () => {
  const t = deals()
  world.shape.setDefault(t.id, 'Stage', 'Passed', person)
  expect(readFileSync(join(t.module.dir, 'module.yaml'), 'utf8')).toContain('default: Passed')
  world.shape.setChoices(t.id, 'Stage', ['New', 'Looking'], person)
  expect(world.lines({ kinds: ['shaped'] }).at(-1)?.words).toBe(
    'Stage in Deals now offers New, Looking. New rows no longer start with Passed.',
  )
  // a module Alpha manages (rules M2)
  const at = new Date().toISOString()
  run(
    world.db,
    "INSERT INTO kits (module_id, kit, version, source, installed_at, updated_at, managed) VALUES (?, 'deals', '0.1.0', 'here', ?, ?, 'Alpha')",
    t.module.id,
    at,
    at,
  )
  expect(() => world.shape.setDefault(t.id, 'Stage', 'New', person)).toThrow(/managed by Alpha/)
  expect(stage(t.id)?.default).toBeNull()
})

it('is refused on a field a connection fills: its rows carry only what the source sent', () => {
  const [t] = landIn(world, {
    manifest: { name: 'books', title: 'QuickBooks' },
    module: 'Books',
    tables: [
      {
        name: 'Invoices',
        fields: [
          { name: 'Number', kind: 'text' },
          { name: 'Status', kind: 'choice', choices: ['Open', 'Paid'] },
        ],
      },
    ],
  } as unknown as Connector)
  expect(() => world.shape.setDefault(t?.id as string, 'Status', 'Open', person)).toThrow(
    /QuickBooks's field/,
  )
})

it('is checked in a kit: one of the choices of a choice holding one', () => {
  const kit = join(home, 'kit')
  mkdirSync(kit)
  const yaml = (field: string) =>
    `name: Desk\nversion: 0.1.0\napi: 3\ntables:\n  - name: Deals\n    fields:\n      - { name: Name, kind: text }\n      - ${field}\n`
  writeFileSync(
    join(kit, 'module.yaml'),
    yaml('{ name: Stage, kind: choice, choices: [New, Won], default: Lost }'),
  )
  expect(checkKit(kit)).toEqual([
    "Deals's Stage: a default is one of the choices of a choice holding one (Lost).",
  ])
  writeFileSync(
    join(kit, 'module.yaml'),
    yaml('{ name: Stage, kind: choice, choices: [New, Won], default: New }'),
  )
  expect(checkKit(kit)).toEqual([])
})
