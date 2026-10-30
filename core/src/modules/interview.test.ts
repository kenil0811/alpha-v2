// Interview me, dynamic: one pool from what is unresolved and the standing bank, valued in code,
// worded by a model that may only word or settle what it was given; a skipped question sinks, an
// answered one leaves until its answer is stale; no fixed count. No model is called.
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { BrowserEngine } from '@alpha/connector-sdk'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { config } from '../config.ts'
import type { Ask } from '../files/reading.ts'
import { run as exec } from '../world/db.ts'
import { World } from '../world/world.ts'
import { agents, syncAgents } from './agents.ts'
import { DEFAULT_KITS, keepDefaults } from './defaults.ts'
import {
  answeredKeys,
  loadPool,
  markSkipped,
  ranked,
  rankedToday,
  readReply,
  refresh,
  worth,
  worthAsking,
} from './interview.ts'
import { update } from './kits/index.ts'
import { sha } from './kits/read.ts'
import { AgentRunner } from './runs/index.ts'

let home: string
let world: World
const alpha = { kind: 'alpha' as const }
const looked = { kind: 'looked_up' as const, source: { url: 'https://example.com' } }
const silent: Ask = async () => {
  throw new Error('no model in tests')
}

beforeEach(async () => {
  home = mkdtempSync(join(tmpdir(), 'alpha-interview-'))
  world = await World.open(join(home, 'tenants', 't_test'))
  world.owner('Kenil')
})
afterEach(() => {
  world.close()
  rmSync(home, { recursive: true, force: true })
})

// a module with a table: three clients with no fee, and an empty Invoices
function firm() {
  const m = world.shape.makeModule('Firm', { actor: alpha })
  const clients = world.shape.makeTable(
    m.id,
    'Clients',
    [
      { name: 'Name', kind: 'text', about: 'The client’s name.' },
      { name: 'Fee', kind: 'money', about: 'What they pay a month.' },
    ],
    { actor: alpha },
  )
  world.shape.makeTable(m.id, 'Invoices', [{ name: 'Number', kind: 'text' }], { actor: alpha })
  world.records.add(
    clients.id,
    ['Acme', 'Riverside', 'Hilltop'].map((Name) => ({ values: { Name }, provenance: looked })),
    { actor: alpha },
  )
  return m
}

// the person answers a question: their said line carries its key
const answer = (key: string) =>
  world.line({
    actor: { kind: 'person', id: world.owner().id },
    kind: 'said',
    words: 'An answer.',
    data: { answers: key },
    user: world.owner().id,
  })

describe('a question’s value', () => {
  const at = Date.parse('2026-10-30T09:00:00Z')
  const base = { reach: 3, asked: null, added: '2026-10-30T09:00:00Z', skips: 0 }
  it('weighs its kind and what it holds up, sinks with each skip, and grows with age', () => {
    const goals = worth({ ...base, kind: 'goals' }, at)
    const meaning = worth({ ...base, kind: 'meaning' }, at)
    expect(goals).toBeGreaterThan(meaning)
    expect(worth({ ...base, kind: 'goals', reach: 9 }, at)).toBeGreaterThan(goals)
    const decay = config.limits().interview_skip_decay
    expect(worth({ ...base, kind: 'goals', skips: 1 }, at)).toBeCloseTo(goals * decay, 0)
    const old = worth({ ...base, kind: 'goals', added: '2026-01-01T09:00:00Z' }, at)
    expect(old).toBeGreaterThan(goals)
  })

  it('reads the person’s words after a question: done, a pass, brief, or an answer', () => {
    expect(readReply('Done, thanks')).toBe('done')
    expect(readReply('that’s enough')).toBe('done')
    expect(readReply('skip')).toBe('skip')
    expect(readReply('Yes')).toBe('brief')
    expect(readReply('I don’t know; ask Maria in accounts')).toBe('answer')
    expect(readReply('We get about forty invoices a month, mostly by email.')).toBe('answer')
  })
})

describe('the pool', () => {
  it('holds the bank and what is unresolved, takes only the model’s words for what it was given', async () => {
    const m = firm()
    const asked: string[] = []
    const ask: Ask = async (prompt) => {
      asked.push(prompt)
      return {
        answer: {
          questions: [
            { key: 'nothing:given', settled: false, ask: 'Made up?', why: '', unblocks: '' },
            {
              key: `aim:${m.id}`,
              settled: false,
              ask: 'What should Firm do for you?',
              why: 'Firm says nothing of what it is for.',
              unblocks: 'Shaping Firm.',
            },
            { key: 'tools', settled: true, ask: '', why: '', unblocks: '' },
          ],
        },
        tokens: 42,
      }
    }
    const out = await refresh(world, ask, null)
    expect(out.tokens).toBe(42)
    expect(rankedToday(out.pool)).toBe(true)
    const keys = ranked(world).map((q) => q.key)
    // far more than a sitting: the bank for the business and Firm, and what is unresolved
    expect(keys.length).toBeGreaterThanOrEqual(20)
    expect(keys).toContain('goals')
    expect(keys).toContain(`walk:${m.id}`)
    expect(keys.some((k) => k.startsWith('empty:'))).toBe(true)
    expect(keys.some((k) => k.startsWith('blank:'))).toBe(true)
    // the model settled one and may never add one
    expect(keys).not.toContain('tools')
    expect(keys).not.toContain('nothing:given')
    expect(ranked(world).find((q) => q.key === `aim:${m.id}`)?.ask).toBe(
      'What should Firm do for you?',
    )
    // the best first, by value; the business's goals lead
    expect(keys[0]).toBe('goals')
    const values = ranked(world).map((q) => q.value)
    expect([...values].sort((a, b) => b - a)).toEqual(values)
    // a module's own list holds only its own
    expect(ranked(world, m.id).every((q) => q.module === m.id)).toBe(true)
    expect(asked[0]).toContain('3 of 3 rows of Clients in Firm have no Fee')
    // only what is worth asking is asked: above the stop value
    const stop = config.limits().interview_stop_value
    expect(worthAsking(world).every((q) => q.value >= stop)).toBe(true)
    expect(worthAsking(world).length).toBeLessThan(keys.length)
  })

  it('drops a skipped question down, and leaves out an answered one until it is stale', async () => {
    const m = firm()
    await refresh(world, silent, null)
    const first = ranked(world)[0]
    expect(first?.key).toBe('goals')
    markSkipped(world, 'goals')
    expect(ranked(world)[0]?.key).not.toBe('goals')
    expect(ranked(world).find((q) => q.key === 'goals')?.value).toBeLessThan(first?.value ?? 0)
    answer(`aim:${m.id}`)
    expect(answeredKeys(world)).toEqual(new Set([`aim:${m.id}`]))
    await refresh(world, silent, null)
    expect(ranked(world).map((q) => q.key)).not.toContain(`aim:${m.id}`)
    // the skip is remembered across the morning's refresh
    expect(loadPool(world).items.find((q) => q.key === 'goals')?.skips).toBe(1)
    // a year on, the answer is stale and its question comes back
    const later = Date.now() + (config.limits().interview_answer_stale_days + 1) * 86_400_000
    await refresh(world, silent, null, later)
    expect(ranked(world, null, later).map((q) => q.key)).toContain(`aim:${m.id}`)
  })
})

describe('the Interviewer skill', () => {
  it('is no character: Morning, Alpha’s own agent, re-ranks the pool each day', async () => {
    const ctx = { actor: { kind: 'system' as const }, user: world.owner().id }
    await keepDefaults(world, ctx, DEFAULT_KITS)
    firm()
    expect(agents(world).map((a) => a.name)).not.toContain('Interviewer')
    const morning = agents(world).find((x) => x.name === 'Morning')
    expect(morning?.state).toBe('on')
    expect(rankedToday(loadPool(world))).toBe(false)
    const engine = new BrowserEngine({
      browsers: join(home, 'b'),
      profiles: join(home, 'p'),
      pace: { minMs: 0, maxMs: 0 },
    })
    const runner = new AgentRunner(world, () => engine, {
      owner: world.owner().id,
      ask: silent,
      interview: async () => ({ answer: { questions: [] }, tokens: 0 }),
    })
    const out = await runner.runAgent(morning as never)
    expect(out.state).toBe('ok')
    expect(rankedToday(loadPool(world))).toBe(true)
    expect(world.lines({ kinds: ['told'] }).at(-1)?.words).toMatch(
      /\d+ questions worth asking in Interview me/,
    )
    // Alpha's own module asks nothing of itself
    const own = morning?.module
    expect(ranked(world).every((q) => q.module !== own)).toBe(true)
  }, 60_000)

  it('takes the Interviewer agent of an older Alpha away on update, as the kit no longer ships it', async () => {
    const ctx = { actor: { kind: 'system' as const }, user: world.owner().id }
    await keepDefaults(world, ctx, DEFAULT_KITS)
    const m = world.shape.module('Alpha')
    if (!m) throw new Error('no Alpha')
    const file =
      '---\nname: Interviewer\ntrigger: { every: day, at: "07:00" }\nruns: { script: skills/interviewer/run.js }\ntouches: []\n---\nOld.\n'
    writeFileSync(join(m.dir, 'agents/interviewer.md'), file)
    exec(
      world.db,
      'INSERT INTO module_files (module_id, path, installed_hash) VALUES (?, ?, ?)',
      m.id,
      'agents/interviewer.md',
      sha(Buffer.from(file)),
    )
    syncAgents(world, m, 'on')
    const old = agents(world, m.id).find((a) => a.name === 'Interviewer')
    if (!old) throw new Error('no Interviewer')
    // a run of it, as on a real install: taking the agent away keeps the run
    exec(
      world.db,
      "INSERT INTO runs (id, agent_id, module_id, started_at, state) VALUES ('r_old', ?, ?, '2026-10-30', 'ok')",
      old.id,
      m.id,
    )
    const report = await update(world, 'Alpha', join(DEFAULT_KITS, 'alpha'), ctx)
    expect(report.dropped).toEqual(['agents/interviewer.md'])
    expect(existsSync(join(m.dir, 'agents/interviewer.md'))).toBe(false)
    expect(agents(world, m.id).map((a) => a.name)).not.toContain('Interviewer')
    expect(world.db.prepare("SELECT agent_id FROM runs WHERE id = 'r_old'").get()).toEqual({
      agent_id: null,
    })
  }, 60_000)
})
