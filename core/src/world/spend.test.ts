// What each use of the model spent: a desk turn's share of its session's running total, nothing
// counted from before it shipped, and Settings' month by module, schedule and model.
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { buildServer } from '../api/server.ts'
import type { UsageView } from '../api/usage-types.ts'
import { Engine } from '../engine/engine.ts'
import { turnSpent } from '../engine/spent.ts'
import { shareOf, usesOfModelUsage } from './spend.ts'
import { World } from './world.ts'

let home: string
let world: World
const token = 'secret-token'
const ok = { host: '127.0.0.1:4700', 'x-alpha-token': token }

beforeEach(async () => {
  home = mkdtempSync(join(tmpdir(), 'alpha-spend-'))
  world = await World.open(join(home, 'tenants', 't_test'))
})
afterEach(() => {
  world.close()
  rmSync(home, { recursive: true, force: true })
})

// Claude Code's modelUsage: a desk session's running total, by model, with its cost
const total = (opusIn: number, opusOut: number, usd: number) => ({
  'claude-opus-5-5': {
    inputTokens: opusIn,
    outputTokens: opusOut,
    cacheReadInputTokens: 0,
    cacheCreationInputTokens: 0,
    costUSD: usd,
  },
  'claude-haiku-5-5': {
    inputTokens: 1000,
    outputTokens: 20,
    cacheReadInputTokens: 0,
    cacheCreationInputTokens: 0,
    costUSD: 0.0002,
  },
})

describe('a desk turn', () => {
  it('spends its own share of the session: now less the turn before, a fresh start whole', () => {
    const before = usesOfModelUsage(total(100, 5000, 1.2))
    const share = shareOf(usesOfModelUsage(total(130, 5600, 1.26)), before)
    expect(share).toHaveLength(1) // the small model did nothing more this turn
    expect(share[0]).toMatchObject({
      model: 'claude-opus-5-5',
      input: 30,
      output: 600,
      how: 'reported',
    })
    expect(share[0]?.usd).toBeCloseTo(0.06)
    // a running total that went down is a session started again: all of it is this turn's
    const fresh = shareOf(usesOfModelUsage(total(10, 200, 0.05)), before)
    expect(fresh.find((u) => u.model === 'claude-opus-5-5')).toMatchObject({
      input: 10,
      output: 200,
      usd: 0.05,
    })
  })

  it('counts nothing from before it shipped: the first turn after is only its share', () => {
    const user = world.owner('Kenil')
    world.keepDesk(user.id, 's_1', 'tools', { kind: 'system' })
    // a reply from before usage shipped, with the session's running total then
    world.line({
      actor: { kind: 'alpha' },
      kind: 'replied',
      words: 'Done.',
      data: { cost: 1.2, usage: total(100, 5000, 1.2) },
      user: user.id,
      turn: '1',
    })
    const uses = turnSpent(world, user.id, { cost: 1.26, usage: total(130, 5600, 1.26) })
    expect(uses.reduce((s, u) => s + (u.usd ?? 0), 0)).toBeCloseTo(0.06)
  })
})

describe('Settings › LLM › Usage', () => {
  it('gives a month split every way, largest first, each adding up to the total', async () => {
    const m = world.shape.makeModule('Garden', { actor: { kind: 'alpha' } })
    const opus = (usd: number) => [
      {
        model: 'claude-opus-5-5',
        input: 10,
        output: 100,
        cacheRead: 0,
        cacheWrite: 0,
        usd,
        how: 'reported' as const,
      },
    ]
    world.spend.add({ kind: 'turn', turn: '1' }, opus(0.05))
    world.spend.add({ kind: 'turn', turn: '2', module: m.id }, opus(0.2))
    world.spend.add({ kind: 'run', run: 'r_1', module: m.id, schedule: 'Waterer' }, opus(0.01))
    const engine = new Engine(world)
    const a = buildServer({ engine, user: world.owner('Kenil'), token, ports: [4700] })
    const u = (await a.inject({ url: '/api/usage', headers: ok })).json() as UsageView
    engine.close()
    expect(u.month).toBe(new Date().toISOString().slice(0, 7))
    expect(u.total).toMatchObject({ turns: 2, runs: 1, tokens: 330 })
    expect(u.total.usd).toBeCloseTo(0.26)
    expect(u.by.module.map((r) => [r.name, r.turns, r.runs])).toEqual([
      ['Garden', 1, 1],
      ['Alpha', 1, 0],
    ])
    expect(u.by.schedule.map((r) => r.name)).toEqual(['Not a schedule', 'Waterer'])
    expect(u.by.model.map((r) => r.name)).toEqual(['claude-opus-5-5'])
    // every split adds up to the total: a schedule's run has no agent but is still counted
    for (const rows of Object.values(u.by)) {
      expect(rows.reduce((s, r) => s + r.tokens, 0)).toBe(u.total.tokens)
      expect(rows.reduce((s, r) => s + (r.usd ?? 0), 0)).toBeCloseTo(0.26)
    }
    expect(u.by.agent.map((r) => r.name)).toContain('Schedules (no agent)')
    expect(world.spend.of({ turn: '2' })).toBeCloseTo(0.2)
    // no cost per task: spend is not kept per task, so tasks ticked done say nothing of it
    expect(u).not.toHaveProperty('tasksDone')
  })

  it('splits spend by person for the owner only; a member sees their own line', async () => {
    const owner = world.owner('Kenil')
    const priya = world.accounts.add('Priya', 'priya@example.com', {
      actor: { kind: 'person', id: owner.id },
      user: owner.id,
    })
    const said = (turn: string, user: string) =>
      world.line({ actor: { kind: 'person', id: user }, kind: 'said', words: 'hi', user, turn })
    said('t_k', owner.id)
    said('t_p', priya.id)
    const opus = (usd: number) => [
      {
        model: 'claude-opus-5-5',
        input: 1,
        output: 1,
        cacheRead: 0,
        cacheWrite: 0,
        usd,
        how: 'reported' as const,
      },
    ]
    world.spend.add({ kind: 'turn', turn: 't_k' }, opus(0.3))
    world.spend.add({ kind: 'turn', turn: 't_p' }, opus(0.1))
    const engine = new Engine(world)
    const usage = async (user: ReturnType<World['owner']>) => {
      const a = buildServer({ engine, user, token, ports: [4700] })
      const u = (await a.inject({ url: '/api/usage', headers: ok })).json() as UsageView
      await a.close()
      return u
    }
    const all = await usage(owner)
    expect(all.by.person.map((r) => r.name)).toEqual(['Kenil', 'Priya'])
    const member = world.users().find((x) => x.id === priya.id) as ReturnType<World['owner']>
    const hers = await usage(member)
    engine.close()
    // her own line, and everyone else's together, so the split still adds up to the month
    expect(hers.by.person.map((r) => r.name)).toEqual(['Everyone else', 'Priya'])
    expect(hers.by.person.find((r) => r.name === 'Everyone else')?.usd).toBeCloseTo(0.3)
    expect(Object.keys(hers.days[0]?.split.person ?? {}).sort()).toEqual(['Everyone else', 'Priya'])
  })
})
