// A table a module says is added to only on the person's word (Kenil, 29 Oct: DealPilot's sources,
// which Alpha twice added without reading their page first): Alpha's write to it is refused until
// the person has answered that word on a card, and one answer lets one write in.
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, expect, it } from 'vitest'
import { install } from '../../modules/kits/index.ts'
import type { User } from '../../world/world.ts'
import { World } from '../../world/world.ts'
import type { ToolEntry } from '../registry.ts'
import type { Tooling } from './common.ts'
import { rowTools } from './rows.ts'

let home: string
let world: World
let user: User
let write: ToolEntry

beforeEach(async () => {
  home = mkdtempSync(join(tmpdir(), 'alpha-addedon-'))
  world = await World.open(join(home, 'tenants', 't_test'))
  user = world.owner('Kenil')
  const person = { actor: { kind: 'person' as const, id: user.id }, user: user.id }
  await install(world, join(import.meta.dirname, '..', '..', 'modules', 'test-kit'), person)
  const tooling: Tooling = {
    world,
    here: {
      current: { user, turn: '1', said: null, message: 'add Harbor Mills as a supplier' },
      fromSubagent: false,
      touched: new Set<string>(),
    },
    ctx: () => ({ actor: { kind: 'alpha' }, user: user.id, turn: '1', said: null }),
  }
  write = rowTools(tooling).find((t) => t.name === 'write') as ToolEntry
})

afterEach(() => {
  world.close()
  rmSync(home, { recursive: true, force: true })
})

const text = (r: Awaited<ReturnType<ToolEntry['handler']>>) =>
  r.content.map((c) => ('text' in c ? c.text : '')).join('')

it('refuses Alpha’s row in a table added to only on the person’s Add, until they answer Add', async () => {
  const suppliers = world.shape.table('Suppliers')
  world.shape.setAddedOn(suppliers?.id as string, 'Add')
  const row = {
    table: 'Suppliers',
    rows: [{ values: { Name: 'Harbor Mills' }, provenance: { kind: 'assumed', basis: 'a test' } }],
  }
  const refused = await write.handler(row)
  expect(refused.isError).toBe(true)
  expect(text(refused)).toMatch(
    /^Suppliers takes a row only after the person answers Add on a card: show them first what the row would be/,
  )
  const card = world.cards.open({
    kind: 'question',
    words: 'Add Harbor Mills as a supplier?',
    options: ['Add', 'Cancel'],
    user: user.id,
    actor: { kind: 'alpha' },
  })
  world.cards.answer(card.id, 'Add', { kind: 'person', id: user.id })
  expect((await write.handler(row)).isError).toBeFalsy()
  // one Add lets one write in
  expect((await write.handler(row)).isError).toBe(true)
  // a table with no such word takes Alpha's rows on the person's message, as before
  const orders = await write.handler({
    table: 'Orders',
    rows: [{ values: { Item: 'Flour' }, provenance: { kind: 'assumed', basis: 'a test' } }],
  })
  expect(orders.isError).toBeFalsy()
})
