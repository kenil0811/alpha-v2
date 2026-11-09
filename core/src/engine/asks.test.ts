// Agents asking each other, against scripted sessions (never the model): nobody waits, several
// answers come together, the stops hold, and a request from a teammate is not the person's word.
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Query, SDKMessage } from '@anthropic-ai/claude-agent-sdk'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { keepAgent } from '../modules/agents.ts'
import { CHIEF } from '../world/agents/index.ts'
import type { User } from '../world/world.ts'
import { World } from '../world/world.ts'
import type { Desk, QueryFn } from './desk.ts'
import { Engine } from './engine.ts'

let home: string
let world: World
let user: User
let engine: Engine
const ids: Record<string, string> = {}
const ctx = { actor: { kind: 'alpha' as const }, user: 'u' }

const msg = (m: Record<string, unknown>) => m as unknown as SDKMessage
const reply = (text: string) =>
  msg({
    type: 'result',
    subtype: 'success',
    result: text,
    terminal_reason: 'completed',
    duration_ms: 1,
    num_turns: 1,
    total_cost_usd: 0,
    modelUsage: {},
    session_id: 's',
  })

type Script = (text: string, agent: string, desk: () => Desk) => Promise<string>
let script: Script
const told: { agent: string; text: string }[] = []

// which desk a session belongs to is read from its working folder
const query: QueryFn = ({ prompt, options }) => {
  const agent = String(options.cwd).match(/agents\/([\w-]+)$/)?.[1] ?? CHIEF
  async function* gen() {
    yield msg({ type: 'system', subtype: 'init', session_id: `s_${agent}` })
    for await (const m of prompt) {
      const text = m.message.content as string
      told.push({ agent, text })
      const out = await script(text, agent, () => engine.desk(user, agent))
      yield reply(out)
    }
  }
  const g = gen()
  return Object.assign(g, {
    interrupt: async () => {},
    close: () => void g.return(undefined),
  }) as unknown as Query
}

const brief = (objective: string) => ({
  objective,
  known: 'Nothing yet.',
  answer_wanted: 'One line.',
  limits: 'Read only.',
})
const ask = (d: Desk, to: string[], objective: string) =>
  d.registry().call('mcp__alpha__ask_agent', { to, ...brief(objective) })
const text = (r: { content: { type: string; text?: string }[] }) =>
  r.content.map((c) => c.text).join('')

// Waits for the engine to go quiet.
async function settled() {
  for (let i = 0; i < 300; i++) {
    await new Promise((r) => setTimeout(r, 5))
    const busy = [CHIEF, ...Object.values(ids)].some((a) => engine.busy(user, a))
    if (!busy && i > 20) return
  }
}

beforeEach(async () => {
  home = mkdtempSync(join(tmpdir(), 'alpha-asks-'))
  world = await World.open(join(home, 'tenants', 't_test'))
  user = world.owner('Kenil')
  told.length = 0
  for (const n of ['Scout', 'Reader', 'Writer', 'Checker', 'Fifth', 'Sixth']) {
    await keepAgent(
      world,
      n,
      { title: n, description: `Ask ${n}.`, instructions: 'Help.' },
      ctx,
      null,
    )
    ids[n] = world.agents.byName(n)?.id as string
  }
  engine = new Engine(world, { query, prompt: 'alone' })
})
afterEach(() => {
  engine.close()
  world.close()
  rmSync(home, { recursive: true, force: true })
})

const lines = (agent: string | null, kinds: string[]) =>
  world.lines({ user: user.id, agent, kinds }).map((l) => l.words)

describe('agents asking each other', () => {
  const raiseCard = (id: string) =>
    world.cards.open({
      kind: 'permission',
      gate: 'leaves_world',
      options: ['Let it', 'Not now'],
      words: 'Let a script reach example.com?',
      detail: null,
      restsOn: [],
      cannotUndo: null,
      call: { tool: 'network', input: { host: 'example.com' } },
      actor: { kind: 'alpha', id: ids.Scout as string },
      user: user.id,
      turn: `a${id}`,
      module: null,
      agent: ids.Scout as string,
    })
  const repliesIn = (agent: string) =>
    world.lines({ user: user.id, agent, kinds: ['replied'] }).map((l) => l.turn ?? '')

  it('keeps an ask open while a card from its work waits; the follow-up is that work', async () => {
    script = async (t, agent, d) => {
      if (agent === CHIEF && t === 'find it') {
        await ask(d(), ['Scout'], 'Find deals')
        return 'I asked.'
      }
      if (agent === ids.Scout && t.startsWith('A request')) {
        raiseCard((world.asks.inState('running')[0] as { id: string }).id)
        return 'I need a yes first.'
      }
      if (agent === ids.Scout && t.includes('said yes')) return 'Found them after the yes.'
      return 'Done.'
    }
    engine.say(user, 'find it')
    await settled()
    const open = world.asks.inState('running')
    expect(open).toHaveLength(1)
    const card = world.cards.waiting(user.id)[0]
    engine.answer(user, card?.id as string, 'Let it')
    await settled()
    const after = world.asks.get(open[0]?.id as string)
    expect(after?.state).toBe('answered')
    expect(after?.answer?.result).toBe('Found them after the yes.')
    expect(repliesIn(ids.Scout as string).every((turn) => turn.startsWith('a'))).toBe(true)
    expect(told.at(-1)?.agent).toBe(CHIEF)
  })

  it('reports after a restart an answer that had not reached its asker', async () => {
    const made = world.asks.add({
      root: 'r1',
      user: user.id,
      from: CHIEF,
      fromTurn: 'r1',
      parent: null,
      to: ids.Scout as string,
      hop: 1,
      brief: { objective: 'Find it', known: 'x', answerWanted: 'x', limits: 'x' },
    })
    world.asks.start(made.id)
    world.asks.settle(made.id, 'answered', { status: 'done', result: 'Found.' })
    expect(world.asks.waitingFor(user.id, CHIEF).map((x) => x.id)).toEqual([made.id])
    script = async () => 'Told them.'
    engine.resumeAsks()
    await settled()
    expect(lines(null, ['answered'])).toEqual(['Found.'])
    expect(world.asks.waitingFor(user.id, CHIEF)).toEqual([])
  })

  it('starts no follow-up on a yes that comes after the ask is answered', async () => {
    let cardId = ''
    script = async (t, agent, d) => {
      if (agent === CHIEF && t === 'find it') {
        await ask(d(), ['Scout'], 'Find deals')
        return 'I asked.'
      }
      if (agent === ids.Scout && t.startsWith('A request')) {
        const running = world.asks.inState('running')[0] as { id: string }
        const card = raiseCard(running.id)
        cardId = card.id
        engine.answer(user, card.id, 'Let it')
        return 'Found them without it.'
      }
      return 'Done.'
    }
    engine.say(user, 'find it')
    await settled()
    expect(cardId).not.toBe('')
    expect(told.filter((x) => x.agent === ids.Scout).map((x) => x.text.slice(0, 9))).toEqual([
      'A request',
    ])
    expect(world.asks.inState('running')).toEqual([])
  })

  it('ends the asker’s turn, and brings several answers back in one turn', async () => {
    script = async (t, agent, d) => {
      if (agent === CHIEF && t === 'find it') {
        await ask(d(), ['Scout', 'Reader'], 'Find deals')
        return 'I asked them.'
      }
      if (agent === CHIEF) return 'All in.'
      await d()
        .registry()
        .call('mcp__alpha__answer', {
          status: 'done',
          result: `${agent} found one`,
          evidence: 'row 1',
        })
      return 'finished'
    }
    engine.say(user, 'find it')
    await settled()
    const toChief = told.filter((x) => x.agent === CHIEF)
    expect(toChief).toHaveLength(2)
    expect(toChief[1]?.text).toContain('found one')
    expect(toChief[1]?.text.match(/## /g)).toHaveLength(2)
    expect(lines(null, ['asking'])).toEqual([
      'Asking Scout: Find deals',
      'Asking Reader: Find deals',
    ])
    expect(lines(null, ['answered'])).toHaveLength(2)
    expect(lines(null, ['replied'])).toEqual(['I asked them.', 'All in.'])
    expect(
      world.asks
        .ofRoot(world.asks.inState('answered')[0]?.root as string)
        .every((a) => a.state === 'answered'),
    ).toBe(true)
  })

  it('tells the receiver it is a teammate’s request, with the four parts, and no person’s word', async () => {
    let seen: Desk | null = null
    script = async (t, agent, d) => {
      if (agent === CHIEF) {
        if (t === 'go') await ask(d(), ['Scout'], 'Find deals')
        return 'ok'
      }
      seen = d()
      return 'its answer'
    }
    engine.say(user, 'go')
    await settled()
    const to = told.find((x) => x.agent === ids.Scout)?.text as string
    expect(to).toContain('not the person')
    for (const p of ['Objective: Find deals', 'What is known:', 'The answer wanted:', 'Limits:'])
      expect(to).toContain(p)
    expect(seen).not.toBeNull()
    // the receiver's last words stand in when it does not call answer
    expect(world.asks.inState('answered')[0]?.answer?.result).toBe('its answer')
  })

  it('refuses the same ask twice, an agent waiting in the chain, and asking itself', async () => {
    const said: string[] = []
    script = async (t, agent, d) => {
      if (agent === CHIEF && t === 'go') {
        await ask(d(), ['Scout'], 'Find deals')
        said.push(text(await ask(d(), ['Scout'], 'find   DEALS')))
        return 'ok'
      }
      if (agent === ids.Scout) {
        said.push(text(await ask(d(), ['Chief of staff'], 'Help me')))
        said.push(text(await ask(d(), ['Scout'], 'Myself')))
      }
      return 'done'
    }
    engine.say(user, 'go')
    await settled()
    expect(said[0]).toMatch(/already asked/)
    expect(said[1]).toMatch(/waiting in this same chain/)
    expect(said[2]).toMatch(/cannot ask itself/)
  })

  it('stops a chain at 4 hops, counted by Alpha', async () => {
    const order = ['Scout', 'Reader', 'Writer', 'Checker', 'Fifth']
    let refused = ''
    script = async (t, agent, d) => {
      if (agent === CHIEF) {
        if (t === 'go') await ask(d(), ['Scout'], 'step')
        return 'ok'
      }
      const at = order.findIndex((n) => ids[n] === agent)
      const next = order[at + 1]
      if (next && t.includes('Objective')) {
        const out = text(await ask(d(), [next], `step ${at}`))
        if (/steps deep/.test(out)) refused = `${order[at]}: ${out}`
      }
      return 'done'
    }
    engine.say(user, 'go')
    await settled()
    expect(refused).toMatch(/^Checker: This chain is 4 steps deep/)
    expect(Math.max(...world.asks.inState('answered').map((a) => a.hop))).toBe(4)
  })

  it('pauses at 8 asks for the person’s Continue, and carries on after it', async () => {
    script = async (t, agent, d) => {
      if (agent === CHIEF && t === 'go') {
        await ask(d(), ['Scout', 'Reader', 'Writer', 'Checker'], 'one')
        await ask(d(), ['Scout', 'Reader', 'Writer', 'Checker'], 'two')
        const out = text(await ask(d(), ['Fifth'], 'three'))
        expect(out).toMatch(/Continue first/)
        return 'waiting'
      }
      if (agent === CHIEF && /answered your question/.test(t)) {
        expect(text(await ask(d(), ['Fifth'], 'three'))).toMatch(/^Asked Fifth/)
        return 'went on'
      }
      return 'done'
    }
    engine.say(user, 'go')
    await settled()
    const card = world.cards.waiting(user.id).find((c) => c.call?.tool === 'ask_more')
    expect(card?.words).toMatch(/asked other agents 8 times/)
    engine.answer(user, card?.id as string, 'Continue')
    await settled()
    expect(world.asks.ofRoot(world.asks.inState('answered')[0]?.root as string).length).toBe(9)
    expect(lines(null, ['replied'])).toContain('went on')
  })

  it('lets a middle agent wait for its own answers before it answers', async () => {
    script = async (t, agent, d) => {
      if (agent === CHIEF) {
        if (t === 'go') await ask(d(), ['Scout'], 'ask reader')
        return 'ok'
      }
      if (agent === ids.Scout) {
        if (t.includes('Objective')) {
          await ask(d(), ['Reader'], 'read it')
          return 'still waiting on Reader'
        }
        return 'Reader says it is fine'
      }
      return 'it is fine'
    }
    engine.say(user, 'go')
    await settled()
    const scoutAsk = world.asks.inState('answered').find((a) => a.to === ids.Scout)
    expect(scoutAsk?.answer?.result).toBe('Reader says it is fine')
    expect(told.filter((x) => x.agent === CHIEF)).toHaveLength(2)
  })

  it('after a restart, reports work left half done as unknown and does not replay it', async () => {
    const a = world.asks.add({
      root: 'r',
      user: user.id,
      from: CHIEF,
      fromTurn: 't',
      parent: null,
      to: ids.Scout as string,
      hop: 1,
      brief: { objective: 'x', known: 'k', answerWanted: 'a', limits: 'l' },
    })
    world.asks.start(a.id)
    script = async () => 'noted'
    engine.resumeAsks()
    await settled()
    expect(world.asks.get(a.id)?.state).toBe('unknown')
    expect(told.some((x) => x.agent === ids.Scout)).toBe(false)
    expect(told.find((x) => x.agent === CHIEF)?.text).toMatch(/not known/)
  })
})
