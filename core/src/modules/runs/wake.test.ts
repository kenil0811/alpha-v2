// A schedule that wakes an agent: the check looks first, and only what it found opens a task.
// The real sandbox runs the checks; no model is called.
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { BrowserEngine } from '@alpha/connector-sdk'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { startOf, TaskRuns } from '../../engine/task-runs.ts'
import type { Task } from '../../world/tasks/index.ts'
import type { User } from '../../world/world.ts'
import { World } from '../../world/world.ts'
import { changeSchedule, makeSchedule, removeSchedule } from '../agent-schedules.ts'
import { removeAgent } from '../agents.ts'
import { install } from '../kits/index.ts'
import { agentSchedules, nextRun, type Schedule, whenWords } from '../schedules.ts'
import { ScheduleRunner } from './index.ts'

let home: string
let world: World
let user: User
let runner: ScheduleRunner
let given: string[]
let scout: string
const person = () => ({ actor: { kind: 'person' as const, id: user.id }, user: user.id })

beforeEach(async () => {
  home = mkdtempSync(join(tmpdir(), 'alpha-wake-'))
  world = await World.open(join(home, 'tenants', 't_test'))
  user = world.owner('Kenil')
  scout = world.agents.add({
    id: 'ag_scout',
    name: 'Scout',
    title: 'Finds things',
    description: 'Looks things up.',
    model: null,
    madeBy: user.id,
  }).id
  runner = new ScheduleRunner(world, () => ({}) as unknown as BrowserEngine, { owner: user.id })
  given = []
  runner.give = (_by, id) => given.push(id)
})

afterEach(() => {
  world.close()
  rmSync(home, { recursive: true, force: true })
})

const QUIET = 'export default async function () { return { wake: false } }'
const FOUND =
  "export default async function () { return { wake: true, found: { new: ['Oat Mill'] } } }"
const DAILY = { every: 'day', at: '08:00' } as const

async function made(name: string, check?: string): Promise<Schedule> {
  await makeSchedule(
    world,
    runner,
    scout,
    { name, when: DAILY, what: 'Tell me what is new.', ...(check ? { check } : {}) },
    person(),
  )
  return agentSchedules(world, scout).find((s) => s.name === name) as Schedule
}

const asked = { user: 'x', turn: null }
const run = (s: Schedule) => runner.runSchedule(s, asked, {}, { asked: true })
const taskOf = (id: string) => world.tasks.get(id) as Task

describe('a schedule that wakes an agent', () => {
  it('is a file in the agent’s folder, on, and waits for its first time to come round', async () => {
    const s = await made('Morning check')
    expect(existsSync(join(world.agents.dirOf(scout), 'schedules/morning-check.md'))).toBe(true)
    expect([s.state, s.agent, s.by, s.module]).toEqual(['on', scout, user.id, null])
    expect(runner.isDue(s, Date.now())).toBe(false)
  })

  it('leaves a line and opens nothing when its check finds nothing', async () => {
    const s = await made('Watch the mill', QUIET)
    const out = await run(s)
    expect(out.state).toBe('ok')
    expect(given).toEqual([])
    expect(world.tasks.list({ open: true })).toEqual([])
    const last = runner.runsOf(s.id, 1)[0]
    expect([last?.words, last?.quiet]).toEqual(['Nothing new.', true])
  })

  it('opens a task for its agent with what the check found', async () => {
    const s = await made('Watch the mill', FOUND)
    const out = await run(s)
    expect(out.state).toBe('ok')
    const task = taskOf(given[0] as string)
    expect(task.title).toBe('Watch the mill')
    expect(task.owner).toEqual({ kind: 'alpha', id: scout })
    expect(task.schedule).toBe(s.id)
    expect(task.opening).toContain('Oat Mill')
    expect(task.opening).toContain('Tell me what is new.')
    expect(task.opening).toContain('nothing_to_report')
    expect(runner.runsOf(s.id, 1)[0]?.task).toBe(task.id)
  })

  it('wakes every time with no check, and a run still open holds the next', async () => {
    const s = await made('Briefing')
    await run(s)
    expect(given).toHaveLength(1)
    await expect(run(s)).rejects.toThrow('still on its last run')
    // nor does the clock start another: it waits, and they become one
    const held = { ...s, lastRunAt: '2026-01-01T00:00:00.000Z' }
    expect(runner.isDue(held, Date.now())).toBe(true)
    world.tasks.setState(given[0] as string, 'done', person())
    await run(s)
    expect(given).toHaveLength(2)
  })

  it('tells a later run what it reported last', async () => {
    const s = await made('Briefing')
    await run(s)
    const first = given[0] as string
    world.tasks.setState(first, 'done', person())
    world.line({
      actor: { kind: 'alpha', id: scout },
      kind: 'replied',
      words: 'Oat Mill listed a new line.',
      user: user.id,
      turn: `task:${first}:1`,
    })
    await run(s)
    expect(taskOf(given[1] as string).opening).toContain('Oat Mill listed a new line.')
  })

  it('does not keep a check that crashes or answers neither way', async () => {
    await expect(
      makeSchedule(
        world,
        runner,
        scout,
        {
          name: 'Bad',
          when: DAILY,
          what: 'x',
          check: "export default async function () { throw new Error('no') }",
        },
        person(),
      ),
    ).rejects.toThrow('The check did not work')
    await expect(
      makeSchedule(
        world,
        runner,
        scout,
        {
          name: 'Vague',
          when: DAILY,
          what: 'x',
          check: 'export default async function () { return 1 }',
        },
        person(),
      ),
    ).rejects.toThrow('must return')
    expect(agentSchedules(world, scout)).toEqual([])
    expect(existsSync(join(world.agents.dirOf(scout), 'checks/bad'))).toBe(false)
  })

  it('fails loudly when a kept check stops answering', async () => {
    const s = await made('Watch', QUIET)
    await changeSchedule(world, runner, s, { check: QUIET }, person())
    const file = join(world.agents.dirOf(scout), 'checks/watch/check.js')
    const { writeFileSync } = await import('node:fs')
    writeFileSync(file, 'export default async function () { return { maybe: true } }')
    const out = await run(s)
    expect(out.state).toBe('failed')
    expect(out.words).toContain('must return')
    expect(given).toEqual([])
  })

  it('a check only looks: it cannot write a row', async () => {
    await install(world, join(import.meta.dirname, '..', 'test-kit'), person())
    await expect(
      makeSchedule(
        world,
        runner,
        scout,
        {
          name: 'Writes',
          when: DAILY,
          what: 'x',
          check:
            "export default async function (alpha) { await alpha.rows.land('Orders', []); return { wake: false } }",
        },
        person(),
      ),
    ).rejects.toThrow('A check only looks')
    expect(agentSchedules(world, scout)).toEqual([])
  })

  it('counts wakes, not the looks that found nothing', async () => {
    const s = await made('Watch', QUIET)
    for (let i = 0; i < 3; i++) await run(s)
    const place = runner.placeOf(s)
    const file = place && runner.fileOf(s.id, place)
    expect(
      file && runner.overRuns(s, { ...file, budget: { minutes: 15, runs: 1 } }, Date.now()),
    ).toBe(false)
  })

  it('goes when it is removed, and with its agent; its runs stay', async () => {
    const s = await made('Briefing')
    await run(s)
    world.tasks.setState(given[0] as string, 'done', person())
    await removeSchedule(world, s, person())
    expect(agentSchedules(world, scout)).toEqual([])
    expect(runner.runs(5).length).toBeGreaterThan(0)
    await made('Another')
    removeAgent(world, scout, person())
    expect(agentSchedules(world, scout)).toEqual([])
  })
})

describe('when a schedule runs', () => {
  it('says weekdays, named days and patterns in words', () => {
    expect(whenWords({ every: 'weekday', at: '08:00' })).toBe('every weekday at 08:00')
    expect(whenWords({ every: 'monday', at: '09:00' })).toBe('every Monday at 09:00')
    expect(whenWords({ cron: '*/15 * * * *' })).toBe('every 15 minutes')
    expect(whenWords({ cron: '0 9 1 * *' })).toBe('on day 1 of each month at 09:00')
  })

  it('skips the weekend and finds a named day', () => {
    // a Friday afternoon, having run that morning
    const friday = new Date(2026, 10, 13, 15, 0).getTime()
    const ranAt = new Date(2026, 10, 13, 8, 1).toISOString()
    expect(nextRun({ every: 'weekday', at: '08:00' }, ranAt, friday)?.getDay()).toBe(1)
    expect(nextRun({ every: 'wednesday', at: '08:00' }, ranAt, friday)?.getDay()).toBe(3)
  })
})

describe('a task that starts later or repeats', () => {
  function runs(): { runs: TaskRuns; started: string[] } {
    const started: string[] = []
    const lane = { takeWork: () => undefined, say: () => '', stop: async () => undefined }
    const out = new TaskRuns(
      world,
      (_u, _a, task) => {
        started.push(task)
        return lane as never
      },
      () => undefined,
    )
    return { runs: out, started }
  }

  it('waits for its start time', () => {
    const { runs: tasks, started } = runs()
    const later = new Date(Date.now() + 3_600_000).toISOString()
    const t = world.tasks.add(
      { title: 'Look at the deal', owner: { kind: 'alpha', id: scout }, startsAt: later },
      person(),
    )
    tasks.give(user, t.id)
    expect(started).toEqual([])
    world.tasks.change(t.id, { startsAt: new Date(Date.now() - 1000).toISOString() }, person())
    tasks.due()
    expect(started).toEqual([t.id])
  })

  it('starts each copy of a repeat on its own day, and an empty start is at once', () => {
    const { runs: tasks, started } = runs()
    const now = world.tasks.add({ title: 'Now', owner: { kind: 'alpha', id: scout } }, person())
    tasks.give(user, now.id)
    expect(started).toEqual([now.id])
    const repeat = world.tasks.add(
      {
        title: 'Weekly review',
        owner: { kind: 'alpha', id: scout },
        due: '2030-01-07',
        repeat: 'every Monday',
      },
      person(),
    )
    tasks.give(user, repeat.id)
    expect(started).toEqual([now.id])
    expect(startOf(taskOf(repeat.id))).toBe(new Date(2030, 0, 7, 8, 0).getTime())
    world.tasks.setState(repeat.id, 'done', person())
    const copy = world.tasks.list({ open: true }).find((t) => t.title === 'Weekly review') as Task
    expect(copy.due).toBe('2030-01-14')
    expect(copy.given?.by).toBe(user.id)
  })

  it('closes a scheduled run that found nothing without a notice', async () => {
    const s = await made('Briefing')
    const { runs: tasks } = runs()
    await run(s)
    const id = given[0] as string
    tasks.give(user, id)
    expect(taskOf(id).state).toBe('doing')
    tasks.quiet(id)
    tasks.idle(user, scout, id, 'ok', false)
    expect(taskOf(id).state).toBe('dropped')
    expect(world.lines({ kinds: ['task_finished'] })).toEqual([])
  })

  it('starts a scheduled run again after a restart, and lets other work wait', async () => {
    const s = await made('Briefing')
    const { runs: tasks, started } = runs()
    await run(s)
    const id = given[0] as string
    tasks.give(user, id)
    expect(started).toEqual([id])
    tasks.resume()
    expect(started).toEqual([id, id])
    expect(taskOf(id).state).toBe('doing')
  })
})
