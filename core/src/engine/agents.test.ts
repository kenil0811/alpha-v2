// A desk per person and agent, against a scripted session (never the model): its own session and
// conversation, what it is told at the start, a fresh session's handover, and memory that is kept
// only when the turn finishes.
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Options, Query, SDKMessage } from '@anthropic-ai/claude-agent-sdk'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { instructionsOf, keepAgent } from '../modules/agents.ts'
import type { User } from '../world/world.ts'
import { World } from '../world/world.ts'
import { lastWords } from './context.ts'
import { Desk, type QueryFn } from './desk.ts'

let home: string
let world: World
let user: User
let scout: string
const ctx = { actor: { kind: 'alpha' as const }, user: 'u' }

beforeEach(async () => {
  home = mkdtempSync(join(tmpdir(), 'alpha-agent-desk-'))
  world = await World.open(join(home, 'tenants', 't_test'))
  user = world.owner('Kenil')
  await keepAgent(
    world,
    'Scout',
    {
      title: 'Finds deals',
      description: 'Ask it for deals.',
      instructions: 'Look widely.',
      model: 'claude-sonnet-5-5',
    },
    ctx,
    null,
  )
  scout = world.agents.byName('Scout')?.id as string
})
afterEach(() => {
  world.close()
  rmSync(home, { recursive: true, force: true })
})

const msg = (m: Record<string, unknown>) => m as unknown as SDKMessage
const reply = (text: string, ok = true) =>
  msg({
    type: 'result',
    subtype: ok ? 'success' : 'error_during_execution',
    result: text,
    errors: [],
    terminal_reason: 'completed',
    duration_ms: 1,
    num_turns: 1,
    total_cost_usd: 0,
    modelUsage: {},
    session_id: 's',
  })

let sessions = 0
function open(agent: string | undefined, turn: (d: Desk, text: string) => Promise<SDKMessage>) {
  const seen: { options: Options[]; contexts: string[] } = { options: [], contexts: [] }
  let desk: Desk
  let done: () => void = () => {}
  const fn: QueryFn = ({ prompt, options }) => {
    seen.options.push(options)
    const id = `s_${++sessions}`
    async function* gen() {
      yield msg({ type: 'system', subtype: 'init', session_id: id })
      for await (const m of prompt) {
        const hook = options.hooks?.UserPromptSubmit?.[0]?.hooks[0]
        const out = (await hook?.(
          {
            hook_event_name: 'UserPromptSubmit',
            prompt: '',
            session_id: id,
            transcript_path: '',
            cwd: '',
          } as never,
          undefined,
          { signal: new AbortController().signal },
        )) as { hookSpecificOutput?: { additionalContext?: string } }
        seen.contexts.push(out.hookSpecificOutput?.additionalContext ?? '')
        yield await turn(desk, m.message.content as string)
      }
    }
    const g = gen()
    return Object.assign(g, {
      interrupt: async () => {},
      close: () => void g.return(undefined),
    }) as unknown as Query
  }
  desk = new Desk(world, user, {
    query: fn,
    ...(agent ? { agent } : {}),
    emit: (e) => {
      if (e.type === 'idle') done()
    },
  })
  const say = (words: string) =>
    new Promise<void>((r) => {
      done = r
      desk.say(words)
    })
  return { desk, seen, say }
}

const remember = (d: Desk, text: string, more = {}) =>
  d.registry().call('mcp__alpha__memory', { action: 'save', text, ...more })

describe('a desk per person and agent', () => {
  it('has its own session and its own conversation', async () => {
    const a = open(scout, async () => reply('From Scout'))
    const c = open(undefined, async () => reply('From the Chief'))
    await a.say('to scout')
    await c.say('to chief')
    a.desk.close()
    c.desk.close()
    expect(world.desk(user.id, scout)?.sessionId).toMatch(/^s_/)
    expect(world.desk(user.id)?.sessionId).not.toBe(world.desk(user.id, scout)?.sessionId)
    const words = (agent: string | null) =>
      world.lines({ user: user.id, agent, kinds: ['said', 'replied'] }).map((l) => l.words)
    expect(words(scout)).toEqual(['to scout', 'From Scout'])
    expect(words(null)).toEqual(['to chief', 'From the Chief'])
  })

  it('is told who it is, on its own model, with its teammates', async () => {
    const a = open(scout, async () => reply('ok'))
    await a.say('hello')
    a.desk.close()
    expect(a.seen.options[0]?.model).toBe('claude-sonnet-5-5')
    expect(JSON.stringify(a.seen.options[0]?.systemPrompt)).toContain('Look widely.')
    expect(a.seen.contexts[0]).toContain('Chief of staff (Runs the team)')
  })

  it('keeps a memory only when the turn finishes', async () => {
    const good = open(scout, async (d) => {
      await remember(d, 'They sign annual', { essential: true })
      expect(world.memories.list(scout, user.id)).toEqual([])
      return reply('done')
    })
    await good.say('remember that')
    good.desk.close()
    expect(world.memories.list(scout, user.id).map((m) => m.text)).toEqual(['They sign annual'])
    expect(world.lines({ user: user.id, agent: scout, kinds: ['noted'] }).at(-1)?.words).toBe(
      'Noted: They sign annual',
    )
    const bad = open(scout, async (d) => {
      await remember(d, 'A failed fact')
      return reply('', false)
    })
    await bad.say('try')
    bad.desk.close()
    expect(world.memories.list(scout, user.id).map((m) => m.text)).toEqual(['They sign annual'])
  })

  it('starts again after an edit, with the conversation so far and its memory', async () => {
    world.memories.save({
      agent: scout,
      user: user.id,
      text: 'Dana approves',
      essential: true,
      origin: 'agent',
      saidBy: null,
      turn: null,
    })
    const a = open(scout, async () => reply('First answer'))
    await a.say('first question')
    await new Promise((r) => setTimeout(r, 5))
    await keepAgent(world, 'Scout', { instructions: 'Look narrowly.' }, ctx, scout)
    expect(instructionsOf(world, scout)).toBe('Look narrowly.')
    await a.say('second question')
    a.desk.close()
    expect(a.seen.options).toHaveLength(2)
    expect(JSON.stringify(a.seen.options[1]?.systemPrompt)).toContain('Look narrowly.')
    expect(a.seen.options[1]?.resume).toBeUndefined()
    expect(a.seen.contexts[1]).toContain('They said: first question')
    expect(a.seen.contexts[1]).toContain('You said: First answer')
    expect(a.seen.contexts[1]).toContain('Dana approves')
  })

  it('hears once of a memory or a teammate that is new since it started', async () => {
    const a = open(scout, async () => reply('ok'))
    await a.say('one')
    world.memories.save({
      agent: scout,
      user: null,
      text: 'Fiscal year ends in June',
      essential: true,
      origin: 'person',
      saidBy: user.id,
      turn: null,
    })
    await keepAgent(
      world,
      'Reader',
      { title: 'Reads', description: 'Ask it to read.', instructions: 'Read.' },
      ctx,
      null,
    )
    await a.say('two')
    await a.say('three')
    a.desk.close()
    expect(a.seen.contexts[1]).toContain('Fiscal year ends in June')
    expect(a.seen.contexts[1]).toContain('Reader (Reads)')
    expect(a.seen.contexts[2]).not.toContain('Fiscal year ends in June')
  })

  it('has the person’s last messages word for word for after a compaction', () => {
    for (const w of ['a', 'b', 'c', 'd'])
      world.line({
        actor: { kind: 'person', id: user.id },
        kind: 'said',
        words: w,
        user: user.id,
        agent: scout,
      })
    const words = lastWords(world, user.id, scout)
    expect(words).toContain('- b')
    expect(words).toContain('- d')
    expect(words).not.toContain('- a')
  })
})
