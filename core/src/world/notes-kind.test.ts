// A text field becomes notes (core plan step 4, DealPilot's Notes): through a kit's newer version,
// the same column and its values kept, now out of the grid and the table's view and in row_notes;
// no other kind ever changes.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, expect, it } from 'vitest'
import { install, update } from '../modules/kits/index.ts'
import type { Table } from './shape/index.ts'
import { World } from './world.ts'

const person = { actor: { kind: 'person' as const, id: 'u_1' }, user: 'u_1' }
const looked = { kind: 'looked_up' as const, source: { url: 'https://example.com' } }
let home: string
let world: World

beforeEach(async () => {
  home = mkdtempSync(join(tmpdir(), 'alpha-notes-kind-'))
  world = await World.open(join(home, 'tenants', 't_test'))
})
afterEach(() => {
  world.close()
  rmSync(home, { recursive: true, force: true })
})

it('a kit turns a text field into notes, its values kept; nothing else changes kind', async () => {
  const kit = join(home, 'kit')
  mkdirSync(kit)
  const yaml = (version: string, notes: string) => `name: Book
version: ${version}
api: 1
business_case: { for: The owner, keeps: Deals, decides: Which to buy }
tables:
  - name: Deals
    fields:
      - { name: Name, kind: text }
      - { name: Asking, kind: number }
      - { name: Notes, kind: ${notes} }
`
  writeFileSync(join(kit, 'module.yaml'), yaml('0.1.0', 'text'))
  const m = await install(world, kit, person)
  const deals = world.shape.table('Deals') as Table
  const [id] = world.records.add(
    deals.id,
    [{ values: { Name: 'Harbor Books', Notes: 'Met the broker.' }, provenance: looked }],
    person,
  ) as [string]
  writeFileSync(join(kit, 'module.yaml'), yaml('0.2.0', 'notes'))
  await update(world, m.id, kit, person)
  const after = world.shape.table(deals.id) as Table
  expect(after.fields.map((f) => [f.name, f.kind])).toEqual([
    ['Name', 'text'],
    ['Asking', 'number'],
    ['Notes', 'notes'],
  ])
  expect(world.records.get(id)?.record.values.notes).toBe('Met the broker.')
  expect(world.sql.query('SELECT * FROM deals').columns).not.toContain('notes')
  expect(world.sql.query('SELECT notes FROM row_notes').rows).toEqual([
    { notes: 'Met the broker.' },
  ])
  // a number never becomes notes, nor does a second field on a table that has them
  expect(() => world.shape.toNotes(deals.id, 'Asking', person)).toThrow(
    /only a text field becomes notes/,
  )
  expect(() => world.shape.toNotes(deals.id, 'Name', person)).toThrow(/has its notes already/)
})
