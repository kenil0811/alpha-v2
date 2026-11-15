// The run tool waits a short while for what it starts: a quick script's outcome comes back, and
// a whole schedule that takes longer goes on by itself while the turn is told it is running.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { BrowserEngine } from '@alpha/connector-sdk'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { config } from '../../config.ts'
import { ScheduleRunner } from '../../modules/runs/index.ts'
import { schedules, syncSchedules } from '../../modules/schedules.ts'
import type { Module } from '../../world/shape/index.ts'
import type { User } from '../../world/world.ts'
import { World } from '../../world/world.ts'
import type { ToolEntry } from '../registry.ts'
import type { Tooling } from './common.ts'
import { deskTools } from './desk.ts'

let home: string
let world: World
let user: User
let module: Module
let runner: ScheduleRunner
let run: ToolEntry

// longer than the wait for a schedule, by a second
const SLOW_MS = (config.limits().run_wait_seconds.schedule + 1) * 1000

beforeEach(async () => {
  home = mkdtempSync(join(tmpdir(), 'alpha-run-tool-'))
  world = await World.open(join(home, 'tenants', 't_test'))
  user = world.owner('Kenil')
  module = world.shape.makeModule('Reading room', { actor: { kind: 'alpha' } })
  mkdirSync(join(module.dir, 'skills', 'read'), { recursive: true })
  mkdirSync(join(module.dir, 'schedules'), { recursive: true })
  writeFileSync(
    join(module.dir, 'skills', 'read', 'quick.js'),
    'export default async (alpha) => ({ words: `Read ${alpha.input.what}.` })\n',
  )
  writeFileSync(
    join(module.dir, 'skills', 'read', 'slow.js'),
    `export default async () => {\n  await new Promise((r) => setTimeout(r, ${SLOW_MS}))\n  return { words: 'Every source read.' }\n}\n`,
  )
  writeFileSync(
    join(module.dir, 'schedules', 'read-everything.md'),
    '---\nname: Read everything\ntrigger: { every: day, at: "07:00" }\nruns: { script: skills/read/slow.js }\n---\nReads every source.\n',
  )
  syncSchedules(world, module, 'on')
  runner = new ScheduleRunner(world, () => ({}) as unknown as BrowserEngine, { owner: user.id })
  const current = { user, turn: '1', said: null, message: 'run it now' }
  const tooling = {
    world,
    hands: { runner },
    here: { current, fromSubagent: false, touched: new Set<string>(), afterTurn: [] },
    ctx: () => ({ actor: { kind: 'alpha' }, user: user.id, turn: current.turn, said: null }),
  } as unknown as Tooling
  run = deskTools(tooling).find((t) => t.name === 'run') as ToolEntry
})

afterEach(() => {
  world.close()
  rmSync(home, { recursive: true, force: true })
})

const said = async (input: Record<string, unknown>) => {
  const r = await run.handler(input)
  return JSON.parse(r.content.map((c) => ('text' in c ? c.text : '')).join('')) as {
    state: string
    words: string
  }
}

describe('the run tool', () => {
  it('gives back the outcome of a script that ends within the wait', async () => {
    const out = await said({
      module: 'Reading room',
      script: 'skills/read/quick.js',
      input: { what: 'one page' },
    })
    expect(out.state).toBe('ok')
    expect(out.words).toContain('Read one page.')
  })

  it('leaves a long schedule running by itself and says so, and the run still ends', async () => {
    const started = Date.now()
    const out = await said({ module: 'Reading room', schedule: 'Read everything' })
    expect(out.state).toBe('running')
    expect(out.words).toMatch(/Read everything is still running and goes on by itself/)
    // the turn was not held for the whole run
    expect(Date.now() - started).toBeLessThan(SLOW_MS)
    const [schedule] = schedules(world, module.id)
    expect(runner.runs(5).find((r) => r.schedule === schedule?.id)?.state).toBe('running')
    // it goes on to its end with nobody waiting
    await new Promise((r) => setTimeout(r, 3000))
    const ended = runner.runs(5).find((r) => r.schedule === schedule?.id)
    expect(ended?.state).toBe('ok')
    expect(ended?.words).toContain('Every source read.')
  }, 30_000)
})
