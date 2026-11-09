// A question card (Kenil, 30 Oct: "why does it look so ugly"): the question is one short line, and
// what it rests on (a preview, the deals a source lists) goes in detail, shown under it.
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, expect, it } from 'vitest'
import type { User } from '../../world/world.ts'
import { World } from '../../world/world.ts'
import type { ToolEntry } from '../registry.ts'
import type { Tooling } from './common.ts'
import { deskTools } from './desk.ts'

let home: string
let world: World
let user: User
let ask: ToolEntry

beforeEach(async () => {
  home = mkdtempSync(join(tmpdir(), 'alpha-ask-'))
  world = await World.open(join(home, 'tenants', 't_test'))
  user = world.owner('Kenil')
  const tooling: Tooling = {
    world,
    here: {
      current: { user, turn: '1', said: null, message: 'add it as a source' },
      fromSubagent: false,
      touched: new Set<string>(),
      afterTurn: [],
    },
    ctx: () => ({ actor: { kind: 'alpha' }, user: user.id, turn: '1', said: null }),
  }
  ask = deskTools(tooling).find((t) => t.name === 'ask') as ToolEntry
})

afterEach(() => {
  world.close()
  rmSync(home, { recursive: true, force: true })
})

const text = (r: Awaited<ReturnType<ToolEntry['handler']>>) =>
  r.content.map((c) => ('text' in c ? c.text : '')).join('')

it('keeps the question to one line and puts what it rests on in detail', async () => {
  const long = await ask.handler({
    question:
      'Add Accounting Biz Brokers (accountingbizbrokers.com/listings) as a deal source? A test read of its first state page (Arkansas) found 9 listings, e.g. East Central AR CPA Firm (ABB-AR1181): asking $1,320,000, revenue $1,200,000. It would be read every morning at 07:00.',
    options: ['Add', 'Cancel'],
  })
  expect(long.isError).toBe(true)
  expect(text(long)).toMatch(/^The question is too long for a card/)
  expect(world.cards.waiting(user.id)).toEqual([])
  const detail =
    'Its Arkansas page lists 9 firms:\n\n- East Central AR CPA Firm: asking $1,320,000\n- Little Rock CPA Firm: asking $548,000'
  const out = await ask.handler({
    question: 'Add Accounting Biz Brokers as a deal source?',
    detail,
    options: ['Add', 'Cancel'],
  })
  expect(out.isError).toBeFalsy()
  const card = world.cards.waiting(user.id)[0]
  expect(card?.words).toBe('Add Accounting Biz Brokers as a deal source?')
  expect(card?.detail).toBe(detail)
  expect(card?.options).toEqual(['Add', 'Cancel'])
})
