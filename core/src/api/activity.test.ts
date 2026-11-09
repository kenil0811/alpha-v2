// Activity shows what Alpha did through a connector (Kenil, 29 Oct: "why is there nothing in
// activity about draft getting created or sent"): a turn's writes and sends that went are its
// steps, a send on a card's yes under the turn that asked for it.
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { MemorySecrets } from '@alpha/connector-sdk'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { loadSet, STANDARD_DIR } from '../connectors/discover.ts'
import { ConnectorService } from '../connectors/service.ts'
import { Gatekeeper } from '../engine/gate.ts'
import type { Here } from '../engine/tools/index.ts'
import type { User } from '../world/world.ts'
import { World } from '../world/world.ts'
import type { BaseCtx } from './ctx.ts'
import { makeViews } from './views.ts'

let home: string
let world: World
let user: User

beforeEach(async () => {
  home = mkdtempSync(join(tmpdir(), 'alpha-activity-'))
  world = await World.open(join(home, 'tenants', 't_test'))
  user = world.owner('Kenil')
})

afterEach(() => {
  world.close()
  rmSync(home, { recursive: true, force: true })
})

describe('Activity', () => {
  it('shows a turn’s draft and a send on the person’s yes, each under the turn that asked', async () => {
    const connectors = new ConnectorService(world, {
      secrets: new MemorySecrets(),
      known: (await loadSet(STANDARD_DIR)).connectors,
    })
    const said = (words: string) =>
      String(
        world.line({ actor: { kind: 'person', id: user.id }, kind: 'said', words, user: user.id })
          .id,
      )
    const here: Here = {
      current: {
        user,
        turn: said('draft an email to Priya, don’t send it'),
        said: null,
        message: null,
      },
      fromSubagent: false,
      touched: new Set<string>(),
      afterTurn: [],
    }
    const gate = new Gatekeeper(world, here, user, { connectors })
    const mail = { to: 'priya@harbor.example', subject: 'The CIM', body: 'Could you send it?' }
    expect(
      (await gate.before('mcp__gmail__draft', mail, { callId: 'c1', subagent: null })).allow,
    ).toBe(true)
    await gate.after({ callId: 'c1', ok: true })
    // a search reads: no step
    await gate.before(
      'mcp__gmail__search',
      { query: 'from:priya' },
      { callId: 'c0', subagent: null },
    )
    await gate.after({ callId: 'c0', ok: true })
    const asked = said('now send it')
    here.current = { ...here.current, turn: asked }
    expect(
      (await gate.before('mcp__gmail__send', mail, { callId: 'c2', subagent: null })).allow,
    ).toBe(false)
    const card = world.cards.waiting(user.id).find((c) => c.call?.tool === 'gmail_send')
    world.cards.answer(card?.id as string, 'Send it', { kind: 'person', id: user.id })
    // the desk carries on after the yes in a turn of its own
    here.current = { ...here.current, turn: 'n1' }
    expect(
      (await gate.before('mcp__gmail__send', mail, { callId: 'c3', subagent: null })).allow,
    ).toBe(true)
    await gate.after({ callId: 'c3', ok: true })

    const views = makeViews({ world, engine: { hands: null }, user } as unknown as BaseCtx)
    const turns = views.activity().filter((r) => r.kind === 'turn')
    expect(turns.map((t) => [t.words, t.steps.map((s) => s.words)])).toEqual([
      ['You asked: “now send it”', ['Send an email to priya@harbor.example, on your yes']],
      [
        'You asked: “draft an email to Priya, don’t send it”',
        ['Saved a draft to priya@harbor.example'],
      ],
    ])
    // the draft can be taken back (step 2, part 2), so its turn has Revert; the send is final
    expect(turns.map((t) => t.undo?.label ?? null)).toEqual([null, 'Revert'])
  })
})
