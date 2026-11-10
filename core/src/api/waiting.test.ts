// Rules waiting on their Save card: listed for a module (its own
// and those of all of Alpha) and for Settings › Permissions (every one); Approve and Decline are
// the card's own answers, by their meaning, so a rule comes out exactly as saved on its card.
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Engine } from '../engine/engine.ts'
import { type RuleSpec, SAVE_ANSWERS, SAVE_RULE } from '../world/rules.ts'
import type { User } from '../world/world.ts'
import { World } from '../world/world.ts'
import { buildServer } from './server.ts'
import type { WaitingRuleView } from './types.ts'

const token = 'secret-token'
const ok = { host: '127.0.0.1:4700', 'x-alpha-token': token }
let home: string
let world: World
let engine: Engine
let me: User

beforeEach(async () => {
  home = mkdtempSync(join(tmpdir(), 'alpha-waiting-'))
  world = await World.open(join(home, 'tenants', 't_test'))
  engine = new Engine(world)
  me = world.owner('Kenil')
})

afterEach(() => {
  engine.close()
  world.close()
  rmSync(home, { recursive: true, force: true })
})

const rule = (module: string | null, to: string): RuleSpec => ({
  side: 'deny',
  module,
  schedule: null,
  covers: { does: ['send'], to: { outside: [to] } },
  said: `never email anyone outside ${to}`,
})

// a Save card as Alpha's desk opens it, its answers in the order given
const saveCard = (spec: RuleSpec, options: string[] = [SAVE_ANSWERS.yes, SAVE_ANSWERS.no]) =>
  world.cards.open({
    kind: 'question',
    words: `Save this rule? ${world.rules.describe(spec)}`,
    options,
    call: { tool: SAVE_RULE, input: spec },
    actor: { kind: 'alpha' },
    user: me.id,
    module: spec.module,
  })

describe('rules waiting on their Save card', () => {
  it('are a module’s and those of all of Alpha for that module, and every one in Permissions', async () => {
    const bakery = world.shape.makeModule('Bakery', { actor: { kind: 'alpha' } })
    const shops = world.shape.makeModule('Shops', { actor: { kind: 'alpha' } })
    const here = saveCard(rule(bakery.id, 'bakery.example'))
    const all = saveCard(rule(null, 'example.com'))
    saveCard(rule(shops.id, 'shops.example'))
    world.cards.open({ kind: 'question', words: 'Lunch?', actor: { kind: 'alpha' }, user: me.id })
    const a = buildServer({ engine, user: me, token, ports: [4700] })
    const waiting = async (q = '') =>
      (await a.inject({ url: `/api/rules/waiting${q}`, headers: ok })).json() as WaitingRuleView[]
    const inBakery = await waiting(`?module=${bakery.id}`)
    expect(inBakery.map((r) => [r.card, r.where, r.yes, r.no])).toEqual([
      [here.id, 'Bakery', 'Save', 'Not now'],
      [all.id, 'All of Alpha', 'Save', 'Not now'],
    ])
    expect(inBakery[1]?.words).toBe(world.rules.describe(rule(null, 'example.com')))
    expect(await waiting()).toHaveLength(3)
    await a.close()
  })

  it('Approve is the card’s Save: the rule as saved there, from its card; Decline makes none', async () => {
    const yes = saveCard(rule(null, 'example.com'))
    const no = saveCard(rule(null, 'harbor.example'))
    const a = buildServer({ engine, user: me, token, ports: [4700] })
    const [first, second] = (
      await a.inject({ url: '/api/rules/waiting', headers: ok })
    ).json() as WaitingRuleView[]
    for (const [r, answer] of [
      [first, first?.yes],
      [second, second?.no],
    ] as const)
      await a.inject({
        method: 'POST',
        url: `/api/cards/${r?.card}`,
        headers: ok,
        payload: { answer },
      })
    const rules = world.rules.list()
    expect(rules.map((r) => [r.words, r.source.card, r.madeBy])).toEqual([
      [world.rules.describe(rule(null, 'example.com')), yes.id, `person:${me.id}`],
    ])
    expect(world.cards.get(no.id)?.state).not.toBe('waiting')
    expect((await a.inject({ url: '/api/rules/waiting', headers: ok })).json()).toEqual([])
    await a.close()
  })

  it('reads a Save card’s answers by their meaning: Not now first is still no rule', () => {
    const card = saveCard(rule(null, 'example.com'), [SAVE_ANSWERS.no, SAVE_ANSWERS.yes])
    engine.answer(me, card.id, SAVE_ANSWERS.no)
    expect(world.rules.list()).toEqual([])
    const again = saveCard(rule(null, 'example.com'), [SAVE_ANSWERS.no, SAVE_ANSWERS.yes])
    engine.answer(me, again.id, SAVE_ANSWERS.yes)
    expect(world.rules.list()).toHaveLength(1)
  })
})
