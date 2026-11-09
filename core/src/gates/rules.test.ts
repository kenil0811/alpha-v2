// Rules (core step 2, Kenil's yes 27 Oct): an approved deny refuses on every path, quoting
// itself; an approved allow lets through only what it covers; only the person approves; what
// Alpha noticed is followed where little is at stake and only said where much is; standing
// permissions move in.
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { worldTools } from '../engine/tools/index.ts'
import { Drafts } from '../modules/drafts.ts'
import { reach } from '../modules/runs/reach.ts'
import type { ScheduleRunner } from '../modules/runs/runner.ts'
import { Refused } from '../world/kinds.ts'
import type { RuleSpec } from '../world/rules.ts'
import { SAVE_RULE } from '../world/rules.ts'
import { World } from '../world/world.ts'
import { decide, type GateInput } from './gates.ts'

const alpha = { kind: 'alpha' as const }
let home: string
let world: World
let person: { actor: { kind: 'person'; id: string }; user: string }

beforeEach(async () => {
  home = mkdtempSync(join(tmpdir(), 'alpha-rules-'))
  world = await World.open(join(home, 'tenants', 't_test'))
  const owner = world.owner('Kenil')
  person = { actor: { kind: 'person', id: owner.id }, user: owner.id }
})
afterEach(() => {
  world.close()
  rmSync(home, { recursive: true, force: true })
})

const send = (to: string): GateInput => ({
  call: { tool: 'gmail.send', input: { to, subject: 'CIM', body: 'Here it is' } },
  effect: 'outward',
  preview: `Send the CIM to ${to}?`,
  actor: alpha,
  user: person.user,
})

const outside = (side: 'allow' | 'deny' = 'deny'): RuleSpec => ({
  side,
  module: null,
  schedule: null,
  covers:
    side === 'deny'
      ? { does: ['send'], to: { outside: ['avilo.com'] } }
      : { does: ['send'], to: { inside: ['avilo.com'] } },
  said: 'never email anyone outside the firm',
})

describe('a rule', () => {
  it('is said in code’s own words, and plain words are not a rule', () => {
    expect(world.rules.describe(outside())).toBe(
      'Alpha must never send to an address outside avilo.com, anywhere in Alpha.',
    )
    const m = world.shape.makeModule('DealPilot', { actor: alpha })
    const deals = world.shape.makeTable(m.id, 'Deals', [{ name: 'Name', kind: 'text' }], {
      actor: alpha,
    })
    expect(
      world.rules.describe({
        side: 'deny',
        module: m.id,
        schedule: null,
        covers: { does: ['remove'], tables: [deals.id] },
      }),
    ).toBe('Alpha must never delete rows in Deals in DealPilot.')
    expect(
      world.rules.describe({
        side: 'allow',
        module: null,
        schedule: 'Watson',
        covers: { does: ['send'], through: ['gmail'] },
      }),
    ).toBe('Watson may send anything through gmail without asking.')
    expect(() => world.rules.check({ ...outside(), covers: { does: [] } })).toThrow(
      /not a rule; keep them in the module’s notes/,
    )
    expect(() =>
      world.rules.check({
        ...outside(),
        covers: { does: ['send'], to: { addresses: ['*@example.com'] } },
      }),
    ).toThrow(/not one whole address/)
    expect(
      world.rules.check({
        ...outside(),
        covers: { does: ['send'], to: { inside: ['@example.com'] } },
      }).covers.to,
    ).toEqual({ inside: ['example.com'] })
  })

  it('is made only by the person: the tool opens a Save card, and the model can’t approve', async () => {
    const tools = worldTools(world, {
      current: { user: world.owner(), turn: '1', said: null, message: null },
      fromSubagent: false,
      touched: new Set(),
    })
    const tool = tools.find((t) => t.name === 'rule')
    const out = await tool?.handler({
      side: 'deny',
      does: ['send'],
      to_outside: ['avilo.com'],
      words: 'never email anyone outside the firm',
    })
    expect(out?.content[0]).toMatchObject({ text: expect.stringMatching(/^Asked on a card/) })
    expect(world.rules.list()).toEqual([])
    // a newer wording in the same turn replaces the waiting card
    await tool?.handler({
      side: 'deny',
      does: ['send'],
      to_outside: ['avilo.com'],
      words: 'never email anyone outside the firm',
    })
    expect(world.cards.waiting()).toHaveLength(1)
    const [card] = world.cards.waiting()
    expect(card?.words).toBe(
      'Save this rule? Alpha must never send to an address outside avilo.com, anywhere in Alpha.',
    )
    expect(card?.call?.tool).toBe(SAVE_RULE)
    expect(() => world.rules.save(card?.call?.input as RuleSpec, { actor: alpha })).toThrow(Refused)
    const r = world.rules.save(card?.call?.input as RuleSpec, { ...person, card: card?.id ?? null })
    expect(r).toMatchObject({
      kind: 'approved',
      side: 'deny',
      said: 'never email anyone outside the firm',
    })
    expect(world.rules.inForce()).toEqual([r.words])
  })
})

describe('an approved deny', () => {
  it('refuses a send outside, quoting itself, with no card; a send inside still asks', () => {
    world.rules.save(outside(), person)
    const no = decide(world, send('bob@gmail.com'))
    expect(no).toMatchObject({ pass: false, card: null })
    if (no.pass) return
    expect(no.reason).toMatch(
      /^Refused by the person's rule: “Alpha must never send to an address outside avilo.com, anywhere in Alpha.”/,
    )
    expect(world.cards.waiting()).toEqual([])
    expect(world.lines({ kinds: ['refused'] }).at(-1)?.words).toBe(
      'Refused: Send the CIM to bob@gmail.com. Your rule: Alpha must never send to an address outside avilo.com, anywhere in Alpha.',
    )
    const inside = decide(world, send('amy@avilo.com'))
    expect(inside.pass).toBe(false)
    if (!inside.pass) expect(inside.card?.state).toBe('waiting')
    // a send to the firm and outside at once is still outside
    expect(decide(world, send('amy@avilo.com, bob@gmail.com'))).toMatchObject({ card: null })
  })

  it('on addresses at a domain covers a send with any one of them; an allow needs every one', () => {
    world.rules.save(
      {
        side: 'deny',
        module: null,
        schedule: null,
        covers: { does: ['send'], to: { inside: ['example.com'] } },
        said: null,
      },
      person,
    )
    expect(world.rules.list()[0]?.words).toBe(
      'Alpha must never send to addresses at example.com, anywhere in Alpha.',
    )
    expect(decide(world, send('ann@example.com, bob@gmail.com'))).toMatchObject({ card: null })
    expect(decide(world, send('bob@gmail.com')).pass).toBe(false)
    world.rules.save(outside('allow'), person)
    expect(decide(world, send('amy@avilo.com, bob@gmail.com'))).toMatchObject({
      card: expect.objectContaining({ state: 'waiting' }),
    })
  })

  it('refuses a removal even when the person asked for it, and ends when revoked', () => {
    const m = world.shape.makeModule('DealPilot', { actor: alpha })
    const deals = world.shape.makeTable(m.id, 'Deals', [{ name: 'Name', kind: 'text' }], {
      actor: alpha,
    })
    const r = world.rules.save(
      {
        side: 'deny',
        module: m.id,
        schedule: null,
        covers: { does: ['remove'], tables: [deals.id] },
        said: null,
      },
      person,
    )
    const removal: GateInput = {
      call: { tool: 'change', input: { table: 'Deals', remove: ['r_1'] } },
      effect: 'remove',
      preview: 'Remove a row from Deals?',
      actor: alpha,
      ownEntries: true,
      askedIn: 'remove the deal',
      message: 'remove the deal',
      module: m.id,
      table: deals.id,
    }
    expect(decide(world, removal)).toMatchObject({ pass: false, card: null })
    // elsewhere it does not reach
    expect(decide(world, { ...removal, table: null, module: null }).pass).toBe(true)
    world.rules.revoke(r.id, person)
    expect(decide(world, removal).pass).toBe(true)
    expect(world.rules.get(r.id)?.revokedAt).not.toBeNull()
  })

  it('refuses a schedule’s draft, and the person’s own Send of it', async () => {
    const owner = world.owner()
    const m = world.shape.makeModule('Desk', { actor: alpha })
    const sent: unknown[] = []
    const drafts = new Drafts(world, { send: async (_c, msg) => void sent.push(msg) }, owner)
    const draft = (to: string) => ({
      schedule: 'Outreach',
      module: m.id,
      kind: 'quote request',
      key: null,
      connector: 'gmail',
      message: { to, subject: 'Quote', body: 'Could you quote it?' },
      about: null,
      note: null,
    })
    const waiting = await drafts.propose(draft('amy@avilo.com'), null)
    world.rules.save(outside(), person)
    await expect(drafts.propose(draft('bob@gmail.com'), null)).rejects.toThrow(
      /^Refused by the person's rule/,
    )
    await expect(
      drafts.send(
        waiting.card as string,
        { to: 'bob@gmail.com', subject: 'Quote', body: 'Could you quote it?' },
        owner,
      ),
    ).rejects.toThrow(/^Refused by the person's rule/)
    expect(sent).toEqual([])
  })

  it('closes a site to a schedule’s reader even on its module’s list', () => {
    const m = world.shape.makeModule('DealPilot', { actor: alpha })
    mkdirSync(m.dir, { recursive: true })
    world.rules.save(
      {
        side: 'deny',
        module: null,
        schedule: null,
        covers: { does: ['reach'], sites: ['crexi.com'] },
        said: null,
      },
      person,
    )
    const runner = { world } as unknown as ScheduleRunner
    expect(() =>
      reach(runner, m, 'https://www.crexi.com/listings', 'run_1', { user: null, turn: null }),
    ).toThrow(/^Refused by the person's rule: “Alpha must never open crexi.com/)
  })
})

describe('an approved allow', () => {
  it('lets through only what it covers, counted', () => {
    const r = world.rules.save(outside('allow'), person)
    expect(decide(world, send('amy@avilo.com')).pass).toBe(true)
    expect(world.rules.get(r.id)?.uses).toBe(1)
    expect(world.lines({ kinds: ['allowed'] }).at(-1)?.words).toBe(
      'Allowed by your rule: Send the CIM to amy@avilo.com',
    )
    const bob = decide(world, send('bob@gmail.com'))
    expect(bob.pass).toBe(false)
    if (!bob.pass) expect(bob.card?.state).toBe('waiting')
  })
})

describe('what Alpha noticed', () => {
  it('is followed on a read, asked about on a change of the person’s rows, and only said on a send', () => {
    const m = world.shape.makeModule('Shop', { actor: alpha })
    const t = world.shape.makeTable(m.id, 'Orders', [{ name: 'Name', kind: 'text' }], {
      actor: alpha,
    })
    const line = world.line({ actor: person.actor, kind: 'said', words: 'leave orders alone' })
    const r = world.rules.infer(
      {
        side: 'deny',
        module: null,
        schedule: null,
        covers: { does: ['read', 'change', 'send'] },
        said: null,
      },
      [line.id],
      { actor: alpha },
    )
    expect(r.kind).toBe('inferred')
    expect(world.rules.inForce()).toEqual([])
    const read = decide(world, {
      call: { tool: 'query', input: {} },
      effect: 'read',
      preview: 'Read the orders?',
      actor: alpha,
      table: t.id,
    })
    expect(read).toMatchObject({ pass: false, card: null })
    if (!read.pass) expect(read.reason).toMatch(/^Not done: Alpha noticed/)
    const mine = decide(world, {
      call: { tool: 'change', input: { table: 'Orders' } },
      effect: 'write',
      preview: 'Change an order?',
      actor: alpha,
      ownEntries: true,
      table: t.id,
    })
    expect(mine.pass).toBe(false)
    if (!mine.pass)
      expect(mine.card).toMatchObject({ gate: 'noticed', options: ['Go ahead', 'Not now'] })
    const out = decide(world, send('bob@gmail.com'))
    expect(out.pass).toBe(false)
    if (!out.pass)
      expect(out.card?.restsOn).toContain(
        'Alpha noticed you may not want this: “Alpha must never read, change or send anything, anywhere in Alpha.”',
      )
    // approved, it is a wall like any other
    world.rules.approve(r.id, person)
    expect(decide(world, send('bob@gmail.com'))).toMatchObject({ pass: false, card: null })
    expect(() => world.rules.approve(r.id, { actor: alpha })).toThrow(Refused)
  })
})
