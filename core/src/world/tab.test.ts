// A table kept as a tab (28 Oct, Kenil's yes): a part or a setup table shown among its module's
// tabs too, by the person or its kit; where it sits and what goes with its rows don't change, and
// a kit's update leaves the person's choice as they left it.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { checkKit } from '@alpha/kit-sdk'
import { afterEach, beforeEach, expect, it } from 'vitest'
import { install, update } from '../modules/kits/index.ts'
import type { Table } from './shape/index.ts'
import { placeOf } from './shape/parts.ts'
import { World } from './world.ts'

const person = { actor: { kind: 'person' as const, id: 'u_1' }, user: 'u_1' }
const looked = { kind: 'looked_up' as const, source: { url: 'https://example.com' } }
let home: string
let world: World

beforeEach(async () => {
  home = mkdtempSync(join(tmpdir(), 'alpha-tab-'))
  world = await World.open(join(home, 'tenants', 't_test'))
})
afterEach(() => {
  world.close()
  rmSync(home, { recursive: true, force: true })
})

async function book(version: string, tab: string) {
  const kit = join(home, 'kit')
  mkdirSync(kit, { recursive: true })
  writeFileSync(
    join(kit, 'module.yaml'),
    `name: Book
version: ${version}
api: 2
business_case: { for: The owner, keeps: Deals, decides: Which to buy }
tables:
  - name: Deals
    fields:
      - { name: Name, kind: text }
      - { name: Asking, kind: number }
  - name: Financials${tab}
    fields:
      - { name: Year, kind: number }
      - { name: Deal, kind: relation, relates_to: Deals, part_of: true }
`,
  )
  return kit
}

it('keeps a part as a tab, still part of its row: removing the row takes it all the same', async () => {
  await install(world, await book('0.1.0', ''), person)
  const deals = world.shape.table('Deals') as Table
  const fin = world.shape.table('Financials') as Table
  expect(fin.tab).toBe(false)
  const t = world.shape.setTab(fin.id, true, person)
  expect([t.tab, placeOf(t)]).toEqual([true, 'part'])
  expect(world.lines({ kinds: ['shaped'] }).at(-1)?.words).toBe(
    'Financials is a tab of Book now, every row of it; its rows stay where they are.',
  )
  const [acme] = world.records.add(
    deals.id,
    [{ values: { Name: 'Acme' }, provenance: looked }],
    person,
  ) as [string]
  world.records.add(fin.id, [{ values: { Year: 2025, Deal: acme }, provenance: looked }], person)
  world.records.remove(deals.id, [acme], person)
  expect(world.records.list(fin.id)).toEqual([])
  // a main table is a tab already
  expect(() => world.shape.setTab(deals.id, true, person)).toThrow(/tabs already/)
  expect(world.shape.setTab(fin.id, false, person).tab).toBe(false)
})

it('is kept by a kit that says so, once: the person taking it away stands over a later version', async () => {
  const m = await install(world, await book('0.1.0', '\n    tab: true'), person)
  const fin = world.shape.table('Financials') as Table
  expect(fin.tab).toBe(true)
  world.shape.setTab(fin.id, false, person)
  await update(world, m.id, await book('0.2.0', '\n    tab: true'), person)
  expect(world.shape.table(fin.id)?.tab).toBe(false)
})

it('is checked in a kit: tab is for a part or a setup table', async () => {
  const kit = await book('0.1.0', '\n    tab: true')
  expect(checkKit(kit)).toEqual([])
  writeFileSync(
    join(kit, 'module.yaml'),
    `name: Book
version: 0.1.0
api: 2
tables:
  - name: Deals
    tab: true
    fields:
      - { name: Name, kind: text }
`,
  )
  expect(checkKit(kit)).toContain(
    'Deals is one of the module’s tabs already: tab is for a part or a setup table.'.replace(
      '’',
      "'",
    ),
  )
})
