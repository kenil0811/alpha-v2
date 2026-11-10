import { Trigger, triggersOf } from '@alpha/kit-sdk'
import { z } from 'zod'
import { changeSchedule, makeSchedule, removeSchedule } from '../../modules/agent-schedules.ts'
import type { ScheduleRunner } from '../../modules/runs/index.ts'
import {
  agentName,
  nextRun,
  type Schedule,
  schedules,
  setScheduleAgent,
  whenWords,
} from '../../modules/schedules.ts'
import { CHIEF } from '../../world/agents/index.ts'
import { Refused } from '../../world/kinds.ts'
import type { World } from '../../world/world.ts'
import type { AgentScheduleView } from '../agent-types.ts'
import type { Ctx } from '../ctx.ts'

const HOW_IT_WENT: Record<string, string> = {
  todo: 'Waiting its turn',
  doing: 'Working on it',
  waiting: 'Waiting on you',
  done: 'Reported',
  dropped: 'Nothing to report',
}

export function scheduleOut(
  world: World,
  runner: ScheduleRunner | undefined,
  s: Schedule,
): AgentScheduleView {
  const place = runner?.placeOf(s)
  const file = runner && place ? runner.fileOf(s.id, place) : null
  const rows = runner?.runsOf(s.id, 30) ?? []
  const list = triggersOf(s.trigger)
  const first = list[0]
  const agent = s.agent as string
  return {
    id: s.id,
    name: s.name,
    state: s.state,
    what: file?.brief ?? '',
    when: whenWords(s.trigger),
    every:
      list.length === 1 && first && 'every' in first
        ? { every: first.every, at: first.at ?? null }
        : null,
    hasCheck: !!s.runs,
    next:
      s.state === 'on'
        ? (nextRun(s.trigger, s.lastRunAt, Date.now())?.toISOString() ?? null)
        : null,
    lastRunAt: s.lastRunAt,
    running: rows.some((r) => r.state === 'running') || !!world.tasks.openOfSchedule(s.id),
    agent: { id: agent, name: agentName(world, agent) },
    runs: rows.map((r) => {
      const task = r.task ? world.tasks.get(r.task) : undefined
      return {
        id: r.id,
        at: r.startedAt,
        words: task
          ? (HOW_IT_WENT[task.state] ?? task.state)
          : r.quiet
            ? 'Nothing new'
            : (r.words ?? ''),
        task: r.task,
        usd: r.task ? world.spend.ofTask(r.task) : null,
      }
    }),
  }
}

const Def = z.object({
  name: z.string().optional(),
  what: z.string().optional(),
  when: Trigger.optional(),
})

export function registerSchedules(ctx: Ctx): void {
  const { app, world, engine, user, live, asPerson } = ctx
  const hands = () => {
    const r = engine.hands?.runner
    if (!r) throw new Refused('Schedules are not set up here.')
    return r
  }
  const agentsOwn = (id: string): Schedule => {
    const s = schedules(world).find((x) => x.id === id && x.module === null)
    if (!s) throw new Refused('That schedule is not there.')
    return s
  }

  app.get('/api/schedules/:id', async (req): Promise<AgentScheduleView> => {
    const { id } = z.object({ id: z.string() }).parse(req.params)
    return scheduleOut(world, engine.hands?.runner, agentsOwn(id))
  })

  // How a time reads, and when it would next come, before it is saved.
  app.post('/api/schedules/when', async (req) => {
    const { when } = z.object({ when: Trigger }).parse(req.body)
    return {
      words: whenWords(when),
      next: nextRun(when, new Date().toISOString(), Date.now())?.toISOString() ?? null,
    }
  })

  app.post('/api/agents/:id/schedules', async (req) => {
    const { id } = z.object({ id: z.string() }).parse(req.params)
    if (id !== CHIEF && !world.agents.get(id)) throw new Refused('That agent is not there.')
    const made = await makeSchedule(world, hands(), id, Def.parse(req.body), asPerson)
    live()
    return made
  })

  app.post('/api/schedules/:id/change', async (req) => {
    const { id } = z.object({ id: z.string() }).parse(req.params)
    const done = await changeSchedule(world, hands(), agentsOwn(id), Def.parse(req.body), asPerson)
    live()
    return done
  })

  app.post('/api/schedules/:id/remove', async (req) => {
    const { id } = z.object({ id: z.string() }).parse(req.params)
    await removeSchedule(world, agentsOwn(id), asPerson)
    live()
    return { ok: true }
  })

  // Which agent a module's schedule wakes.
  app.post('/api/schedules/:id/agent', async (req) => {
    const { id } = z.object({ id: z.string() }).parse(req.params)
    const { agent } = z.object({ agent: z.string() }).parse(req.body)
    setScheduleAgent(world, id, agent, user.id)
    live()
    return { ok: true }
  })
}
