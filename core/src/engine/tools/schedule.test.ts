// The schedule tools' walls: a scheduled run cannot grow its own work, and only it can stay silent.
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { BrowserEngine } from '@alpha/connector-sdk'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ScheduleRunner } from '../../modules/runs/index.ts'
import { agentSchedules } from '../../modules/schedules.ts'
import type { User } from '../../world/world.ts'
import { World } from '../../world/world.ts'
import type { ToolEntry } from '../registry.ts'
import type { Tooling } from './common.ts'
import { scheduleTools } from './schedule.ts'

let home: string
let world: World
let user: User
let quieted: string[]
let current: { user: User; turn: string; said: null; message: string; agent?: string }
let schedule: ToolEntry
let silent: ToolEntry
const SCOUT = 'ag_scout'

beforeEach(async () => {
  home = mkdtempSync(join(tmpdir(), 'alpha-schedule-tool-'))
  world = await World.open(join(home, 'tenants', 't_test'))
  user = world.owner('Kenil')
  world.agents.add({
    id: SCOUT,
    name: 'Scout',
    title: 'Finds things',
    description: 'Looks things up.',
    model: null,
    madeBy: user.id,
  })
  quieted = []
  current = { user, turn: '1', said: null, message: 'keep a schedule', agent: SCOUT }
  const runner = new ScheduleRunner(world, () => ({}) as unknown as BrowserEngine, {
    owner: user.id,
  })
  const tooling = {
    world,
    hands: { runner },
    here: {
      current,
      fromSubagent: false,
      touched: new Set<string>(),
      afterTurn: [],
      bus: { quietTask: (id: string) => quieted.push(id) },
    },
    ctx: () => ({
      actor: { kind: 'alpha', id: SCOUT },
      user: user.id,
      turn: current.turn,
      said: null,
    }),
  } as unknown as Tooling
  const tools = scheduleTools(tooling)
  schedule = tools.find((t) => t.name === 'schedule') as ToolEntry
  silent = tools.find((t) => t.name === 'nothing_to_report') as ToolEntry
})

afterEach(() => {
  world.close()
  rmSync(home, { recursive: true, force: true })
})

const text = (r: Awaited<ReturnType<ToolEntry['handler']>>) =>
  r.content.map((c) => ('text' in c ? c.text : '')).join('')

const MAKE = {
  action: 'make',
  name: 'Morning check',
  when: { every: 'weekday', at: '08:00' },
  what: 'Tell me what is new.',
}

function scheduledTask(): string {
  const person = { actor: { kind: 'person' as const, id: user.id }, user: user.id }
  const t = world.tasks.add({ title: 'A run', owner: { kind: 'alpha', id: SCOUT } }, person)
  world.tasks.markScheduled(t.id, 'sch_1', 'do it')
  return t.id
}

describe('the schedule tools', () => {
  it('make one for the agent itself, and say so with Undo', async () => {
    const r = await schedule.handler(MAKE)
    expect(r.isError).toBeFalsy()
    expect(text(r)).toContain('every weekday at 08:00')
    expect(agentSchedules(world, SCOUT).map((s) => s.name)).toEqual(['Morning check'])
    const line = world.lines({ kinds: ['agent_changed'] }).at(-1)
    expect(line?.words).toContain('Morning check')
    expect(line?.data.commit).toBeTruthy()
  })

  it('refuse a bad time, and another agent’s unless it is the Chief of staff', async () => {
    const bad = await schedule.handler({ ...MAKE, when: { cron: 'not a pattern' } })
    expect(bad.isError).toBe(true)
    world.agents.add({
      id: 'ag_other',
      name: 'Other',
      title: 'Other',
      description: 'Other.',
      model: null,
      madeBy: user.id,
    })
    const other = await schedule.handler({ ...MAKE, agent: 'Other' })
    expect(text(other)).toContain('Only the Chief of staff')
    current.agent = undefined as unknown as string
    const chief = await schedule.handler({ ...MAKE, agent: 'Other' })
    expect(chief.isError).toBeFalsy()
  })

  it('refuse a scheduled run making or changing a schedule, but let it look', async () => {
    current.turn = `task:${scheduledTask()}:1`
    const made = await schedule.handler(MAKE)
    expect(text(made)).toContain('A scheduled run cannot')
    expect(agentSchedules(world, SCOUT)).toEqual([])
    expect((await schedule.handler({ action: 'list' })).isError).toBeFalsy()
  })

  it('let only a scheduled run have nothing to report', async () => {
    const plain = await silent.handler({})
    expect(plain.isError).toBe(true)
    const id = scheduledTask()
    current.turn = `task:${id}:1`
    const ok = await silent.handler({})
    expect(ok.isError).toBeFalsy()
    expect(quieted).toEqual([id])
  })
})
