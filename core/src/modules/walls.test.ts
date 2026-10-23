// The walls an agent's file sets (Stage 1, step 2, sub-step 3): what it touches, what it may
// read, the effects it may have, what it needs, and its budget, each enforced where the call
// lands and said in the run.
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { BrowserEngine } from '@alpha/connector-sdk'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { World } from '../world/world.ts'
import { agents, setAgentState } from './agents.ts'
import { install } from './kits.ts'
import { AgentRunner } from './runs/index.ts'

const KIT = join(import.meta.dirname, 'test-kit')
let home: string
let world: World
const ctx = { actor: { kind: 'person' as const, id: 'u_1' }, user: 'u_1' }
const engine = {
  open: async () => ({}),
  extract: async (url: string) => ({ url, pages: 1, items: [{ _id: 'S1', name: 'Oat Mill' }] }),
} as unknown as BrowserEngine

beforeEach(async () => {
  home = mkdtempSync(join(tmpdir(), 'alpha-walls-'))
  world = await World.open(join(home, 'tenants', 't_test'))
})
afterEach(() => {
  world.close()
  rmSync(home, { recursive: true, force: true })
})

// The test kit with one more agent and its script.
async function kitWith(front: string, script: string) {
  const dir = join(home, 'kit')
  cpSync(KIT, dir, { recursive: true })
  mkdirSync(join(dir, 'skills', 'walled'), { recursive: true })
  writeFileSync(join(dir, 'skills', 'walled', 'run.js'), script)
  writeFileSync(
    join(dir, 'agents', 'walled.md'),
    `---\nname: Walled\n${front}\nruns: { script: skills/walled/run.js }\n---\nA made-up agent for the walls.\n`,
  )
  const m = await install(world, dir, ctx)
  const agent = agents(world, m.id).find((a) => a.name === 'Walled')
  if (!agent) throw new Error('no agent')
  return { m, agent, runner: new AgentRunner(world, () => engine, { owner: 'u_1' }) }
}

describe('the walls of an agent', () => {
  it('refuses a landing in a table it does not touch, and says so in the run', async () => {
    const { agent, runner } = await kitWith(
      'trigger: { every: day }\ntouches: [Orders]',
      "export default async (alpha) => alpha.rows.land('Suppliers', [{ key: 's', values: { Name: 'X' } }])",
    )
    const out = await runner.runAgent(agent)
    expect(out.state).toBe('failed')
    expect(out.words).toMatch(/Walled does not touch Suppliers: its file says touches: \[orders\]/)
    expect(world.lines({ kinds: ['run_step'] }).some((l) => /^Refused: /.test(l.words))).toBe(true)
  }, 60_000)

  it('refuses a read of a table that is neither its module’s nor one its kit uses', async () => {
    const other = world.shape.makeModule('Elsewhere', { actor: { kind: 'alpha' } })
    world.shape.makeTable(other.id, 'Secrets', [{ name: 'Name', kind: 'text' }], {
      actor: { kind: 'alpha' },
    })
    const { agent, runner } = await kitWith(
      'trigger: { every: day }\ntouches: [Orders]',
      "export default async (alpha) => alpha.rows.list('Secrets')",
    )
    const out = await runner.runAgent(agent)
    expect(out.words).toMatch(/may not read Secrets/)
  }, 60_000)

  it('refuses an effect its file does not name, before any card; an older file that names none is allowed', async () => {
    const { agent, runner } = await kitWith(
      'trigger: { every: day }\ntouches: [Suppliers]\neffects: []',
      "export default async (alpha) => alpha.browser.extract('https://supplies.example/list', { list: '.item' })",
    )
    const out = await runner.runAgent(agent)
    expect(out.words).toMatch(/may not browser.extract: its file names no such effect/)
    expect(world.cards.waiting().filter((c) => c.kind === 'permission')).toHaveLength(0)
    world.close()
    world = await World.open(join(home, 'tenants', 't_two'))
    const older = await kitWith(
      'trigger: { every: day }\ntouches: [Suppliers]',
      "export default async (alpha) => alpha.browser.extract('https://supplies.example/list', { list: '.item' })",
    )
    const out2 = await older.runner.runAgent(older.agent)
    expect(out2.words).not.toMatch(/no such effect/)
  }, 90_000)

  it('stops a run past the minutes of its budget, and says so', async () => {
    const { agent, runner } = await kitWith(
      'trigger: { every: day }\ntouches: [Orders]\nbudget: { minutes: 0.002 }',
      'export default async () => { await new Promise((r) => setTimeout(r, 3000)); return { words: "slept" } }',
    )
    const out = await runner.runAgent(agent)
    expect(out.state).toBe('stopped')
    expect(out.words).toMatch(/stopped at 0.002 minutes, its budget/)
  }, 60_000)

  it('skips a run past the runs of its budget for the day, saying so once', async () => {
    const { agent, runner } = await kitWith(
      'trigger: { every: hour }\ntouches: [Orders]\nbudget: { runs: 1 }',
      'export default async () => ({ words: "ran" })',
    )
    setAgentState(world, agent.id, 'on', 'u_1')
    const t0 = Date.now()
    await runner.runDue(t0)
    await runner.runDue(t0 + 2 * 3_600_000)
    await runner.runDue(t0 + 3 * 3_600_000)
    expect(runner.runs().filter((r) => r.agent === agent.id)).toHaveLength(1)
    const said = world
      .lines({ kinds: ['run_step'] })
      .filter((l) => /its budget; it runs again tomorrow/.test(l.words))
    expect(said).toHaveLength(1)
  }, 60_000)

  it('does not run when what it needs is not there, and says what', async () => {
    const { agent, runner } = await kitWith(
      'trigger: { every: day }\ntouches: [Orders]\nneeds: { connectors: [gmail] }',
      'export default async () => ({ words: "ran" })',
    )
    const out = await runner.runAgent(agent)
    expect(out.state).toBe('failed')
    expect(out.words).toBe('Walled did not run: it needs gmail connected.')
  }, 60_000)
})
