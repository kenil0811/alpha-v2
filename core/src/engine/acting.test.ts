// Acting in the browser: which steps are free, which act and which ask each time; how long a yes
// holds and for what; Always after three. The browser here is a stand-in: never a real page.
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { BrowserEngine } from '@alpha/connector-sdk'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { Actor } from '../world/journal.ts'
import type { User } from '../world/world.ts'
import { World } from '../world/world.ts'
import {
  ACT,
  actingView,
  answered,
  clickStep,
  HAND,
  handedBack,
  handOver,
  judgeStep,
  keyStep,
  PRESS,
} from './acting.ts'
import type { TurnContext } from './tools/common.ts'

let home: string
let world: World
let user: User
// what has the keys on the stand-in page
let focus = { editable: true, words: '', dialog: '' }
const page = {
  url: () => 'https://drive.example.com/folders/1',
  screenshot: async () => Buffer.from([0xff, 0xd8, 0x01]),
  evaluate: async () => focus,
}
let held = false // the person has taken the page over
const browser = {
  as: () => browser,
  tab: async () => page,
  holding: () => held,
} as unknown as BrowserEngine
const actor: Actor = { kind: 'alpha' }
const turn = (id: string, agent: string | null = null): TurnContext => ({
  user,
  turn: id,
  said: null,
  message: 'make a folder From Alpha',
  agent,
  root: id,
})
const me = (): Actor => ({ kind: 'person', id: user.id })
const type = (cur: TurnContext, text = 'From Alpha') =>
  judgeStep(world, browser, cur, user, actor, { action: 'type', text })
const waiting = () => world.cards.waiting(user.id)

beforeEach(async () => {
  home = mkdtempSync(join(tmpdir(), 'alpha-acting-'))
  world = await World.open(join(home, 'tenants', 't_test'))
  user = world.owner('Kenil')
  focus = { editable: true, words: '', dialog: '' }
  held = false
})

afterEach(() => {
  world.close()
  rmSync(home, { recursive: true, force: true })
})

describe('what a browse step is', () => {
  it('a click: free on a link, a row or a plain button; acting on Share; each time on what cannot be taken back', () => {
    const kind = (what: string, dialog = '') => clickStep('x.example.com', what, dialog).kind
    expect(kind('link "Share"')).toBe('free')
    expect(kind('row "notes"')).toBe('free')
    expect(kind('button "New folder"')).toBe('free')
    expect(kind('button "Sign in"')).toBe('free')
    expect(kind('button "Sort order"')).toBe('free')
    expect(kind('button "Posts"')).toBe('free')
    expect(kind('textbox "Folder name"')).toBe('free')
    expect(kind('button "Share"')).toBe('act')
    expect(kind('button "Post"')).toBe('act')
    expect(kind('menuitem "Delete forever"')).toBe('each')
    expect(kind('button "Place order"')).toBe('each')
    expect(kind('button "Send"')).toBe('each')
    // a plain OK inside a dialog that says so
    expect(kind('button "OK"', 'Delete forever?')).toBe('each')
    expect(kind('button "OK"', 'Rename')).toBe('free')
  })

  it('keys: free when they only move; acting when they type, or Enter where text goes; each time on such a button', () => {
    const kind = (keys: string, on = { editable: false, words: '', dialog: '' }) =>
      keyStep('x.example.com', keys, on).kind
    expect(kind('ArrowDown')).toBe('free')
    expect(kind('ControlOrMeta+End')).toBe('free')
    expect(kind('Shift+Tab')).toBe('free')
    expect(kind('Escape')).toBe('free')
    expect(kind('Enter')).toBe('free')
    expect(kind('Enter', { editable: true, words: '', dialog: '' })).toBe('act')
    expect(kind('a')).toBe('act')
    expect(kind('ControlOrMeta+v')).toBe('act')
    expect(kind('Backspace')).toBe('act')
    expect(kind('Enter', { editable: false, words: 'Pay now', dialog: '' })).toBe('each')
    expect(kind('Enter', { editable: false, words: 'OK', dialog: 'Delete forever?' })).toBe('each')
  })
})

describe('a click at a place in the picture', () => {
  const at = (what: string, dialog = '') => {
    focus = { editable: false, words: '', dialog, what } as never
    return judgeStep(world, browser, turn('t1'), user, actor, { action: 'click', x: 200, y: 100 })
  }
  it('is free on a canvas or a link, and asks each time on a button that cannot be taken back', async () => {
    expect((await at('canvas ""')).allow).toBe(true)
    expect((await at('link "Share"')).allow).toBe(true)
    expect(waiting()).toHaveLength(0)
    expect((await at('button "OK"', 'Delete forever?')).allow).toBe(false)
    expect(waiting()[0]?.words).toBe(
      'Let Chief of staff press OK in “Delete forever?” on drive.example.com?',
    )
  })
})

describe('acting asks once for an agent, a site and a piece of work', () => {
  it('the first typing opens one card with the step and the page’s picture, and waits', async () => {
    const d = await type(turn('t1'))
    expect(d.allow).toBe(false)
    const [card] = waiting()
    expect(card?.words).toBe('Let Chief of staff act on drive.example.com as you?')
    expect(card?.detail).toMatch(/^Type “From Alpha” where the cursor is\./)
    expect(card?.options).toEqual(['Let it act', 'Not now'])
    expect(actingView(world, card as never)?.picture).toMatch(/^[0-9a-f]{64}$/)
    // asked again while it waits: the same card, no second one
    expect((await type(turn('t1'), 'other words')).allow).toBe(false)
    expect(waiting()).toHaveLength(1)
  })

  it('a yes holds for that work: more typing goes, and other work, another agent or a lapsed yes ask again', async () => {
    await type(turn('t1'))
    world.cards.answer(waiting()[0]?.id ?? '', 'Let it act', me())
    expect((await type(turn('t1'))).allow).toBe(true)
    expect((await type(turn('t1'), 'more')).allow).toBe(true)
    expect(waiting()).toHaveLength(0)
    // what follows the card's answer is a new turn of the same work (its root)
    expect((await type({ ...turn('n9'), root: 't1' })).allow).toBe(true)
    expect((await type(turn('t2'))).allow).toBe(false)
    expect((await type(turn('t1', 'ag_researcher'))).allow).toBe(false)
    expect(waiting()).toHaveLength(2)
    // hours later the yes has lapsed
    world.db
      .prepare("UPDATE cards SET decided_at = '2026-01-01T00:00:00.000Z' WHERE state = 'yes'")
      .run()
    expect((await type(turn('t1'))).allow).toBe(false)
    expect(world.lines({ kinds: ['card_lapsed'] })).toHaveLength(1)
  })

  it('a no lets nothing through', async () => {
    await type(turn('t1'))
    world.cards.answer(waiting()[0]?.id ?? '', 'Not now', me())
    expect((await type(turn('t1'))).allow).toBe(false)
  })

  it('reading and moving ask nothing', async () => {
    for (const input of [
      { action: 'find', words: 'x' },
      { action: 'scroll' },
      { action: 'picture' },
    ])
      expect((await judgeStep(world, browser, turn('t1'), user, actor, input)).allow).toBe(true)
    expect(waiting()).toHaveLength(0)
  })

  it('a deny rule on the site refuses, with no card', async () => {
    world.rules.save(
      {
        side: 'deny',
        module: null,
        schedule: null,
        covers: { does: ['reach'], sites: ['drive.example.com'] },
        said: null,
      },
      { actor: me(), user: user.id },
    )
    const d = await type(turn('t1'))
    expect(d.allow).toBe(false)
    expect(d.allow === false && d.reason).toMatch(/Refused by the person's rule/)
    expect(waiting()).toHaveLength(0)
  })
})

describe('a step that cannot be taken back asks every time', () => {
  const press = (cur: TurnContext) =>
    judgeStep(world, browser, cur, user, actor, { action: 'key', keys: 'Enter' })

  it('one yes lets it through once, even while a yes to act holds', async () => {
    await type(turn('t1'))
    world.cards.answer(waiting()[0]?.id ?? '', 'Let it act', me())
    focus = { editable: false, words: 'Delete forever', dialog: '' }
    expect((await press(turn('t1'))).allow).toBe(false)
    const [card] = waiting()
    expect(card?.words).toBe('Let Chief of staff press Delete forever on drive.example.com?')
    expect(card?.call?.tool).toBe(PRESS)
    world.cards.answer(card?.id ?? '', 'Press it', me())
    expect((await press(turn('t1'))).allow).toBe(true)
    expect((await press(turn('t1'))).allow).toBe(false)
  })
})

describe('Always, after three yeses for an agent on a site', () => {
  it('the fourth card offers it; given, acting goes with no card, and each-time steps still ask', async () => {
    for (const t of ['t1', 't2', 't3']) {
      await type(turn(t))
      const [card] = waiting()
      expect(actingView(world, card as never)?.always).toBeNull()
      answered(world, world.cards.answer(card?.id ?? '', 'Let it act', me()), false, user)
    }
    await type(turn('t4'))
    const [fourth] = waiting()
    expect(fourth?.call?.tool).toBe(ACT)
    expect(actingView(world, fourth as never)?.always).toBe(
      'Always: Chief of staff may act on drive.example.com as you without asking',
    )
    answered(world, world.cards.answer(fourth?.id ?? '', 'Let it act', me()), true, user)
    expect((await type(turn('t5'))).allow).toBe(true)
    expect(waiting()).toHaveLength(0)
    // another agent has no Always of its own
    expect((await type(turn('t5', 'ag_researcher'))).allow).toBe(false)
    focus = { editable: false, words: 'Pay now', dialog: '' }
    const d = await judgeStep(world, browser, turn('t5'), user, actor, {
      action: 'key',
      keys: 'Enter',
    })
    expect(d.allow).toBe(false)
  })

  it('a no starts the count again', async () => {
    for (const [t, yes] of [
      ['t1', true],
      ['t2', true],
      ['t3', false],
      ['t4', true],
    ] as const) {
      await type(turn(t))
      const id = waiting()[0]?.id ?? ''
      answered(world, world.cards.answer(id, yes ? 'Let it act' : 'Not now', me()), false, user)
    }
    await type(turn('t5'))
    expect(actingView(world, waiting()[0] as never)?.always).toBeNull()
  })
})

describe('a page the person has taken over', () => {
  it('takes no step of the agent’s, not even a click or a look, until it is handed back', async () => {
    held = true
    for (const input of [
      { action: 'click', n: 4 },
      { action: 'find', words: 'x' },
      { action: 'type', text: 'a' },
    ]) {
      const d = await judgeStep(world, browser, turn('t1'), user, actor, input)
      expect(d.allow === false && d.reason).toMatch(/has taken over this page/)
    }
    expect(waiting()).toHaveLength(0)
    held = false
    expect(
      (await judgeStep(world, browser, turn('t1'), user, actor, { action: 'find' })).allow,
    ).toBe(true)
  })

  it('the record says they had it and for how long, never what they did', () => {
    const next = handedBack(
      world,
      'chief.t1',
      'drive.example.com',
      { ms: 130_000, waited: true },
      user,
    )
    expect(world.lines({ kinds: ['took_over'] }).map((l) => l.words)).toEqual([
      'You took over drive.example.com from Chief of staff for 2 minutes.',
    ])
    expect(next).toMatchObject({ card: null, agent: 'chief', work: 't1' })
    expect(next.text).toMatch(/handed it back.*not recorded.*Look at the page as it is now/)
    // an agent that was not waiting on the page is told nothing
    expect(
      handedBack(world, 'chief.t1', 'drive.example.com', { ms: 20_000, waited: false }, user).text,
    ).toBeNull()
    expect(world.lines({ kinds: ['took_over'] }).at(-1)?.words).toMatch(/for under a minute\.$/)
  })

  it('an agent asks the person onto a page it cannot pass, once, and handing back finds that card', async () => {
    const card = await handOver(
      world,
      browser,
      turn('t1'),
      user,
      actor,
      'The site sent a code to your phone.',
    )
    expect(card.words).toBe('Chief of staff needs you on drive.example.com')
    expect(card.detail).toMatch(/^The site sent a code to your phone\. Open the page/)
    expect(card.options[0]).toBe('Open the page')
    expect(actingView(world, card)?.watch).toBe('chief.t1')
    expect((await handOver(world, browser, turn('t1'), user, actor, 'Again.')).id).toBe(card.id)
    const next = handedBack(
      world,
      'chief.t1',
      'drive.example.com',
      { ms: 60_000, waited: false },
      user,
    )
    expect(next.card?.id).toBe(card.id)
    expect(next.card?.call?.tool).toBe(HAND)
  })
})
