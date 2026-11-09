// A task given to an agent, against scripted sessions (never the model): its own thread, the
// states it moves through, how many run at once, and a restart.
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Query, SDKMessage } from '@anthropic-ai/claude-agent-sdk'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { keepAgent } from '../modules/agents.ts'
import type { User } from '../world/world.ts'
import { World } from '../world/world.ts'
import type { QueryFn } from './desk.ts'
import { Engine } from './engine.ts'

let home: string
let world: World
let user: User
let engine: Engine
let scout: string
const ctx = { actor: { kind: 'alpha' as const }, user: 'u' }
const msg = (m: Record<string, unknown>) => m as unknown as SDKMessage
const reply = (text: string, ok = true) =>
  msg({
    type: 'result',
    subtype: ok ? 'success' : 'error_during_execution',
    is_error: !ok,
    result: text,
    terminal_reason: 'completed',
    duration_ms: 1,
    num_turns: 1,
    total_cost_usd: 0,
    modelUsage: {},
    session_id: 's',
  })

type Script = (text: string) => Promise<string>
let script: Script = async () => 'Done it.'
const told: string[] = []
let n = 0
const query: QueryFn = ({ prompt }) => {
  async function* gen() {
    yield msg({ type: 'system', subtype: 'init', session_id: `s_${++n}` })
    for await (const m of prompt) {
      const text = m.message.content as string
      told.push(text)
      yield reply(await script(text))
    }
  }
  const g = gen()
  return Object.assign(g, {
    interrupt: async () => {},
    close: () => void g.return(undefined),
  }) as unknown as Query
}

async function settled() {
  for (let i = 0; i < 300; i++) {
    await new Promise((r) => setTimeout(r, 5))
    if (!engine.working(user) && i > 20) return
  }
}

const task = (title: string) =>
  world.tasks.add(
    { title, owner: { kind: 'alpha', id: scout } },
    { actor: { kind: 'person', id: user.id }, user: user.id },
  ).id

beforeEach(async () => {
  home = mkdtempSync(join(tmpdir(), 'alpha-taskruns-'))
  world = await World.open(join(home, 'tenants', 't_test'))
  user = world.owner('Kenil')
  told.length = 0
  script = async () => 'Done it.'
  await keepAgent(
    world,
    'Scout',
    { title: 'Scout', description: 'Finds things.', instructions: 'Help.' },
    ctx,
    null,
  )
  scout = world.agents.byName('Scout')?.id as string
  engine = new Engine(world, { query, prompt: 'alone' })
})
afterEach(() => {
  engine.close()
  world.close()
  rmSync(home, { recursive: true, force: true })
})

describe('a task given to an agent', () => {
  it('runs in its own thread, ends Done, and stays out of the agent’s chat', async () => {
    const id = task('Find the numbers')
    engine.tasks.give(user, id)
    await settled()
    expect(told[0]).toContain('Task: Find the numbers')
    expect(world.tasks.get(id)?.state).toBe('done')
    const own = world.lines({ user: user.id, turnPrefix: `task:${id}:`, kinds: ['replied'] })
    expect(own.map((l) => l.words)).toEqual(['Done it.'])
    expect(world.lines({ user: user.id, kinds: ['task_finished'] }).map((l) => l.words)).toEqual([
      'Find the numbers',
    ])
  })

  it('does not hold up the agent’s chat', async () => {
    let release = () => {}
    const held = new Promise<void>((r) => {
      release = r
    })
    script = async (t) => {
      if (t.includes('Task: Slow')) await held
      return t.includes('Task: Slow') ? 'Slow done.' : 'Quick answer.'
    }
    const id = task('Slow')
    engine.tasks.give(user, id)
    engine.say(user, 'a quick question', null, scout)
    for (let i = 0; i < 100 && !world.lines({ user: user.id, kinds: ['replied'] }).length; i++)
      await new Promise((r) => setTimeout(r, 5))
    expect(world.lines({ user: user.id, kinds: ['replied'] }).map((l) => l.words)).toEqual([
      'Quick answer.',
    ])
    expect(world.tasks.get(id)?.state).toBe('doing')
    release()
    await settled()
    expect(world.tasks.get(id)?.state).toBe('done')
  })

  it('waits for the person on a card, and finishes after the answer', async () => {
    const id = task('Needs a yes')
    script = async (t) => {
      if (t.includes('said yes')) return 'Finished after the yes.'
      world.cards.open({
        kind: 'permission',
        gate: 'leaves_world',
        options: ['Let it', 'Not now'],
        words: 'Let a script reach example.com?',
        detail: null,
        restsOn: [],
        cannotUndo: null,
        call: { tool: 'network', input: { host: 'example.com' } },
        actor: { kind: 'alpha', id: scout },
        user: user.id,
        turn: world.lines({ user: user.id, turnPrefix: `task:${id}:` }).at(-1)?.turn ?? null,
        module: null,
        agent: scout,
      })
      return 'I need a yes first.'
    }
    engine.tasks.give(user, id)
    await settled()
    expect(world.tasks.get(id)?.state).toBe('waiting')
    engine.answer(user, world.cards.waiting(user.id)[0]?.id as string, 'Let it')
    await settled()
    expect(world.tasks.get(id)?.state).toBe('done')
    expect(
      world.lines({ user: user.id, turnPrefix: `task:${id}:`, kinds: ['replied'] }).at(-1)?.words,
    ).toBe('Finished after the yes.')
  })

  it('runs four at once for an agent, the rest when a place comes free', async () => {
    let release = () => {}
    let held = new Promise<void>((r) => {
      release = r
    })
    script = async () => {
      await held
      return 'Done.'
    }
    const ids = ['one', 'two', 'three', 'four', 'five', 'six'].map(task)
    for (const id of ids) engine.tasks.give(user, id)
    await new Promise((r) => setTimeout(r, 40))
    const states = () => ids.map((id) => world.tasks.get(id)?.state)
    expect(states().filter((s) => s === 'doing')).toHaveLength(4)
    expect(states().filter((s) => s === 'todo')).toHaveLength(2)
    release()
    held = Promise.resolve()
    await settled()
    expect(states().every((s) => s === 'done')).toBe(true)
  })

  it('reopens when the person writes on it', async () => {
    const id = task('Reopen me')
    engine.tasks.give(user, id)
    await settled()
    script = async () => 'More done.'
    engine.tasks.say(user, id, 'one more thing')
    expect(world.tasks.get(id)?.state).toBe('doing')
    await settled()
    expect(world.tasks.get(id)?.state).toBe('done')
    expect(
      world
        .lines({ user: user.id, turnPrefix: `task:${id}:`, kinds: ['said'] })
        .map((l) => l.words),
    ).toEqual(['one more thing'])
  })

  it('runs again from Waiting when the person asks', async () => {
    const id = task('Try again')
    world.tasks.markGiven(id, { by: user.id, root: null, hop: 0 })
    world.tasks.setState(id, 'waiting', { actor: { kind: 'alpha', id: scout }, user: user.id })
    engine.tasks.again(user, id)
    expect(world.tasks.get(id)?.state).toBe('doing')
    await settled()
    expect(world.tasks.get(id)?.state).toBe('done')
    expect(told.at(-1)).toContain('carry on with this task')
  })

  it('after a restart waits for the person, and is not replayed', async () => {
    const id = task('Interrupted')
    world.tasks.markGiven(id, { by: user.id, root: null, hop: 0 })
    world.tasks.setState(id, 'doing', { actor: { kind: 'alpha', id: scout }, user: user.id })
    engine.tasks.resume()
    await settled()
    expect(world.tasks.get(id)?.state).toBe('waiting')
    expect(told).toEqual([])
    expect(
      world.lines({ user: user.id, turnPrefix: `task:${id}:`, kinds: ['error'] })[0]?.words,
    ).toContain('Alpha restarted')
  })
})
