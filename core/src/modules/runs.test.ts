// Runs of a made-up kit's agents, with a stand-in for the browser engine: never a real site.
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { BrowserEngine } from '@alpha/connector-sdk'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { World } from '../world/world.ts'
import { agents, setAgentState, syncAgents } from './agents.ts'
import { install } from './kits.ts'
import { AgentRunner } from './runs.ts'

let home: string
let world: World
const ctx = { actor: { kind: 'person' as const, id: 'u_1' }, user: 'u_1' }
const opened: string[] = []
const engine = {
  open: async () => ({}),
  extract: async (url: string) => {
    opened.push(url)
    return {
      url,
      pages: 1,
      items: [
        { _id: 'S1', name: 'Oat Mill', _url: `${url}/S1` },
        { _id: 'S2', name: 'Sugar Co', _url: `${url}/S2` },
      ],
    }
  },
} as unknown as BrowserEngine

beforeEach(async () => {
  home = mkdtempSync(join(tmpdir(), 'alpha-runs-'))
  world = await World.open(join(home, 'tenants', 't_test'))
  opened.length = 0
})

afterEach(() => {
  world.close()
  rmSync(home, { recursive: true, force: true })
})

describe('a run', () => {
  it('runs an agent’s script in its sandbox and reports its outcome', async () => {
    const m = await install(world, join(import.meta.dirname, 'test-kit'), ctx)
    const runner = new AgentRunner(world, () => engine)
    const [counter] = agents(world, m.id)
    const out = await runner.runAgent(counter as never)
    expect(out.state).toBe('ok')
    expect(out.result).toEqual({ orders: 0 })
    expect(runner.runs().map((r) => [r.state, r.words])).toEqual([['ok', 'Counter finished.']])
    expect(world.lines({ kinds: ['run_started', 'run_ended'] }).map((l) => l.words)).toEqual([
      'Counter started.',
      'Counter finished.',
    ])
  }, 60_000)

  it('reads only sites on its module’s list; a new one waits on the person’s yes, then stays allowed', async () => {
    const m = await install(world, join(import.meta.dirname, 'test-kit'), ctx)
    const runner = new AgentRunner(world, () => engine, { owner: 'u_1' })
    const first = await runner.runScript(
      m,
      'skills/read/run.js',
      { url: 'https://supplies.example/list' },
      'Reader',
      null,
    )
    expect(first.state).toBe('failed')
    expect(first.words).toMatch(/supplies.example is not on Bakery's list/)
    expect(opened).toEqual([])
    const [card] = world.cards.waiting()
    expect(card?.words).toBe('Let Bakery read supplies.example?')
    world.cards.answer(card?.id as string, 'Yes', { kind: 'person', id: 'u_1' })
    const second = await runner.runScript(
      m,
      'skills/read/run.js',
      { url: 'https://supplies.example/list' },
      'Reader',
      null,
    )
    expect(second.words).toBe('Reader: 2 seen, 2 new')
    expect(readFileSync(join(m.dir, 'module.yaml'), 'utf8')).toContain('supplies.example')
    const rows = world.records.list(world.shape.table('Suppliers')?.id as string)
    const oat = rows.find((r) => r.values.name === 'Oat Mill')
    expect(oat?.provenance.name?.source).toMatchObject({
      connector: 'agent:Reader',
      item: 'S1',
      url: 'https://supplies.example/list/S1',
    })
    const third = await runner.runScript(
      m,
      'skills/read/run.js',
      { url: 'https://supplies.example/list' },
      'Reader',
      null,
    )
    expect(third.words).toBe('Reader: 2 seen, 0 new')
    // what the reader told the person reaches their stream, once
    expect(world.lines({ user: 'u_1', kinds: ['told'] }).map((l) => l.words)).toEqual([
      'Reader: 2 new suppliers.',
    ])
  }, 60_000)
})

describe('a script’s rows', () => {
  it('reads rows with their values by field name, and lands a url only as a web link', async () => {
    const m = await install(world, join(import.meta.dirname, 'test-kit'), ctx)
    const runner = new AgentRunner(world, () => engine)
    writeFileSync(
      join(m.dir, 'skills/names.js'),
      "export default async (alpha) => (await alpha.rows.list('Suppliers')).map((r) => [r.key, r.values.Name])",
    )
    const names = await runner.runScript(m, 'skills/names.js', {}, 'Names', null)
    expect(names.result).toEqual([
      ['setup:mill', 'Mill & Co'],
      ['setup:dairy', 'Dairy Farm'],
    ])
    writeFileSync(
      join(m.dir, 'skills/fake.js'),
      "export default async (alpha) => alpha.rows.land('Suppliers', [{ key: 'x', values: { Name: 'X' }, url: 'alpha://Suppliers/x' }])",
    )
    const fake = await runner.runScript(m, 'skills/fake.js', {}, 'Fake', null)
    expect(fake.words).toMatch(/alpha:\/\/Suppliers\/x is not one/)
  }, 60_000)
})

describe('triggers', () => {
  it('run an agent on a change in any of its tables, handing its script its input', async () => {
    const m = await install(world, join(import.meta.dirname, 'test-kit'), ctx)
    const runner = new AgentRunner(world, () => engine)
    writeFileSync(join(m.dir, 'skills/echo.js'), 'export default async (alpha) => alpha.input')
    writeFileSync(
      join(m.dir, 'agents/watcher.md'),
      '---\nname: Watcher\ntrigger: { changes: [Orders, Suppliers] }\nruns: { script: skills/echo.js, input: { say: hi } }\n---\nWatches.\n',
    )
    syncAgents(world, m, 'on')
    await runner.runDue() // the kit's own rows count as a change, once
    expect(runner.runs().map((r) => r.words)).toEqual(['Watcher finished.'])
    await runner.runDue()
    expect(runner.runs()).toHaveLength(1)
    world.records.land(
      world.shape.table('Orders')?.id as string,
      [{ key: 'o1', values: { Item: 'Flour', Quantity: 3 } }],
      { connector: 'test' },
      ctx,
    )
    await runner.runDue()
    const out = runner.runs()
    expect(out).toHaveLength(2)
    const data = world.db.prepare('SELECT data FROM runs WHERE id = ?').get(out[0]?.id ?? '') as {
      data: string
    }
    expect(data.data).toContain('"say":"hi"')
  }, 60_000)

  it('run an agent that is on when its time comes, and never one that is paused', async () => {
    const m = await install(world, join(import.meta.dirname, 'test-kit'), ctx)
    const runner = new AgentRunner(world, () => engine)
    const at8 = new Date()
    at8.setHours(8, 0, 0, 0)
    await runner.runDue(at8.getTime())
    expect(runner.runs()).toHaveLength(0)
    const [counter] = agents(world, m.id)
    setAgentState(world, counter?.id as string, 'on', 'u_1')
    await runner.runDue(at8.getTime())
    expect(runner.runs()).toHaveLength(1)
    await runner.runDue(at8.getTime() + 60_000)
    expect(runner.runs()).toHaveLength(1)
  }, 60_000)
})
