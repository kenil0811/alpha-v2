// The engine's answers to cards (item 41 of the problems list, 25 Oct): a draft goes only on
// Send it, and the desk is told of a card only when its own turn opened it.
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { BrowserEngine } from '@alpha/connector-sdk'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { type Draft, Drafts, type Message } from '../modules/drafts.ts'
import { AgentRunner } from '../modules/runs/index.ts'
import { World } from '../world/world.ts'
import { Engine } from './engine.ts'

let home: string
let world: World
let engine: Engine
const alpha = { actor: { kind: 'alpha' as const } }

beforeEach(async () => {
  home = mkdtempSync(join(tmpdir(), 'alpha-engine-'))
  world = await World.open(join(home, 'tenants', 't_test'))
})

afterEach(() => {
  engine?.close()
  world.close()
  rmSync(home, { recursive: true, force: true })
})

function setUp() {
  const owner = world.owner('Kenil')
  const m = world.shape.makeModule('Desk', alpha)
  const jobs = world.shape.makeTable(m.id, 'Jobs', [{ name: 'Name', kind: 'text' }], alpha)
  const [row] = world.records.add(
    jobs.id,
    [{ values: { Name: 'Shop fit' }, provenance: { kind: 'assumed' as const, basis: 'a test' } }],
    alpha,
  )
  const sent: Message[] = []
  const drafts = new Drafts(world, { send: async (_c, msg) => sent.push(msg) }, owner)
  const runner = new AgentRunner(world, () => ({}) as BrowserEngine, { owner: owner.id })
  engine = new Engine(world, {
    hands: { browser: () => ({}) as BrowserEngine, runner, drafts },
  })
  const draft = (subject: string): Draft => ({
    agent: 'Outreach',
    module: m.id,
    kind: 'quote request',
    key: null,
    connector: 'gmail',
    message: { to: 'sam@builders.example', subject, body: 'Could you quote it?' },
    about: { table: jobs.id, row: row as string },
    note: null,
  })
  return { owner, m, drafts, draft, sent }
}

describe('the engine on a card', () => {
  it('sends a draft only on Send it; other words hold it, kept as the reason', async () => {
    const { owner, m, drafts, draft, sent } = setUp()
    const first = (await drafts.propose(draft('Quote for the shop'), null)).card as string
    const held = await engine.answerDraft(owner, first, 'wait, change the subject')
    expect(held.state).toBe('no')
    expect(sent).toHaveLength(0)
    expect(JSON.stringify(drafts.outcomes('Outreach', m.id, null))).toContain(
      'wait, change the subject',
    )
    const second = (await drafts.propose(draft('Quote for the porch'), null)).card as string
    const went = await engine.answerDraft(owner, second, 'Send it')
    expect(went.state).toBe('yes')
    expect(sent.map((s) => s.subject)).toEqual(['Quote for the porch'])
  })

  it('tells the desk of a card only when its own turn opened it', () => {
    const { owner } = setUp()
    // an agent's card from a scheduled run: no turn, so the desk hears nothing of the yes
    const card = world.cards.open({
      kind: 'permission',
      gate: 'leaves_world',
      words: 'Let Watson reach mill.example?',
      options: ['Let it', 'Not now'],
      call: { tool: 'network', input: { host: 'mill.example' } },
      actor: { kind: 'agent', id: 'n_run' },
      user: owner.id,
    })
    const out = engine.answer(owner, card.id, 'Let it')
    expect(out.state).toBe('yes')
    expect(world.lines({ kinds: ['noticed'] })).toHaveLength(0)
  })
})
