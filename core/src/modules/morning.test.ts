// Morning, Alpha's own agent: the day in one line, and suggestions as tasks on a card.
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { BrowserEngine } from '@alpha/connector-sdk'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { run as exec } from '../world/db.ts'
import { World } from '../world/world.ts'
import { agents } from './agents.ts'
import { DEFAULT_KITS, keepDefaults } from './defaults.ts'
import { AgentRunner } from './runs/index.ts'

let home: string
let world: World
// no model in tests: the Interviewer's wording falls back to code's own words
const noModel = async () => {
  throw new Error('no model in tests')
}
beforeEach(async () => {
  home = mkdtempSync(join(tmpdir(), 'alpha-morning-'))
  world = await World.open(join(home, 'tenants', 't_test'))
  world.owner('Kenil')
})
afterEach(() => {
  world.close()
  rmSync(home, { recursive: true, force: true })
})

describe('Morning', () => {
  it('is Alpha’s own kit, on from install, and says the day in one line', async () => {
    const ctx = { actor: { kind: 'system' as const }, user: world.owner().id }
    const said = await keepDefaults(world, ctx, DEFAULT_KITS)
    expect(said.some((s) => /^Installed Alpha \d/.test(s))).toBe(true)
    const alpha = world.shape.module('Alpha')
    const morning = alpha && agents(world, alpha.id).find((a) => a.name === 'Morning')
    expect(morning?.state).toBe('on')
    expect(morning?.trigger).toEqual({ every: 'day', at: '07:30' })
    const engine = new BrowserEngine({
      browsers: join(home, 'b'),
      profiles: join(home, 'p'),
      pace: { minMs: 0, maxMs: 0 },
    })
    const runner = new AgentRunner(world, () => engine, { owner: world.owner().id, ask: noModel })
    const out = await runner.runAgent(morning as never)
    expect(out.state).toBe('ok')
    const told = world.lines({ kinds: ['told'] }).map((l) => l.words)
    // the next of Alpha's own runs, at its first fixed time
    expect(told[0]).toMatch(
      /^Morning: Nothing is due; \d+ questions worth asking in Interview me; next up Watson at \d\d:\d\d\.$/,
    )
    expect(world.cards.waiting(world.owner().id)).toHaveLength(0)
  }, 60_000)

  it('suggests a quiet task, never one to answer the cards waiting', async () => {
    const ctx = { actor: { kind: 'system' as const }, user: world.owner().id }
    await keepDefaults(world, ctx, DEFAULT_KITS)
    const owner = world.owner()
    const who = { actor: { kind: 'person' as const, id: owner.id }, user: owner.id }
    const t = world.tasks.add({ title: 'Call the landlord' }, who)
    exec(world.db, "UPDATE tasks SET updated_at = '2026-10-01T09:00:00.000Z' WHERE id = ?", t.id)
    for (const w of ['Merge Priya and P. Nair?', 'Add Harbor as a source?'])
      world.cards.open({
        kind: 'question',
        words: w,
        options: ['Yes', 'No'],
        restsOn: [],
        actor: { kind: 'alpha' },
        user: owner.id,
      })
    const alpha = world.shape.module('Alpha')
    const morning = alpha && agents(world, alpha.id).find((a) => a.name === 'Morning')
    const engine = new BrowserEngine({
      browsers: join(home, 'b'),
      profiles: join(home, 'p'),
      pace: { minMs: 0, maxMs: 0 },
    })
    const runner = new AgentRunner(world, () => engine, { owner: owner.id, ask: noModel })
    const out = await runner.runAgent(morning as never)
    expect(out.words).not.toMatch(/did not finish/)
    expect(out.state).toBe('ok')
    const told = world.lines({ kinds: ['told'] }).map((l) => l.words)
    expect(told[0]).toMatch(/^Morning: Nothing is due; 2 cards wait for you/)
    const card = world.cards.waiting(owner.id).find((c) => c.kind === 'suggestion')
    expect(card?.words).toBe('Morning suggests')
    const input = card?.call?.input as { tasks: { title: string }[] }
    const tasks = input.tasks.map((x) => x.title)
    // never a task to answer cards: each card is its own row in Needs you (Vikas, 30 Oct)
    expect(tasks).toEqual(['Pick up or drop: Call the landlord'])
  }, 60_000)
})
