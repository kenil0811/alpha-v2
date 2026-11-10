// An agent's schedules (docs/rules.md, R7): a check only looks, and a scheduled run cannot grow its
// own work.
import type { BrowserEngine } from '@alpha/connector-sdk'
import type { Tooling } from '../engine/tools/common.ts'
import { scheduleTools } from '../engine/tools/schedule.ts'
import { makeSchedule } from '../modules/agent-schedules.ts'
import { ScheduleRunner } from '../modules/runs/index.ts'
import { agentSchedules } from '../modules/schedules.ts'
import { rule } from './rule.ts'
import type { RuleWorld } from './world.ts'

const DAILY = { every: 'day', at: '08:00' } as const

function agentIn(w: RuleWorld): string {
  return w.world.agents.add({
    id: 'ag_rule',
    name: 'Scout',
    title: 'Finds things',
    description: 'Looks things up.',
    model: null,
    madeBy: w.user.id,
  }).id
}

const runnerIn = (w: RuleWorld) =>
  new ScheduleRunner(w.world, () => ({}) as unknown as BrowserEngine, { owner: w.user.id })

const person = (w: RuleWorld) => ({
  actor: { kind: 'person' as const, id: w.user.id },
  user: w.user.id,
})

rule('R7', 'an agent’s check only looks, and a scheduled run cannot make or change a schedule', {
  cases: {
    'a check cannot write to a table': async (w) => {
      const said = await makeSchedule(
        w.world,
        runnerIn(w),
        agentIn(w),
        {
          name: 'Writes',
          when: DAILY,
          what: 'x',
          check: `export default async function (alpha) {
            await alpha.rows.land('Orders', [])
            return { wake: false }
          }`,
        },
        person(w),
      ).then(
        () => 'kept',
        (err: Error) => err.message,
      )
      return said.includes('A check only looks')
    },
    'a scheduled run cannot make a schedule': async (w) => {
      const agent = agentIn(w)
      const task = w.world.tasks.add(
        { title: 'A run', owner: { kind: 'alpha', id: agent } },
        person(w),
      )
      w.world.tasks.markScheduled(task.id, 'sch_1', 'do it')
      const tool = scheduleTools({
        world: w.world,
        hands: { runner: runnerIn(w) },
        here: {
          current: { user: w.user, turn: `task:${task.id}:1`, said: null, message: '', agent },
          fromSubagent: false,
          touched: new Set<string>(),
          afterTurn: [],
        },
        ctx: () => ({
          actor: { kind: 'alpha', id: agent },
          user: w.user.id,
          turn: '1',
          said: null,
        }),
      } as unknown as Tooling).find((t) => t.name === 'schedule')
      await tool?.handler({ action: 'make', name: 'More', when: DAILY, what: 'x' })
      return agentSchedules(w.world, agent).length === 0
    },
  },
})
