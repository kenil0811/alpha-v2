// A journey's checks on agents' schedules and the tasks they open.
import { z } from 'zod'
import { agentSchedules } from '../modules/schedules.ts'
import { CHIEF } from '../world/agents/index.ts'
import { all } from '../world/db.ts'
import type { World } from '../world/world.ts'

export const ScheduleChecks = [
  z.object({
    schedule: z.object({
      agent: z.string(),
      count: z.number().optional(),
      check: z.boolean().optional(),
    }),
  }),
  z.object({ last_run_words: z.object({ agent: z.string(), matches: z.string() }) }),
  z.object({
    task: z.object({
      title: z.string(),
      state: z.string().optional(),
      count: z.number().optional(),
    }),
  }),
] as const

const agentId = (world: World, name: string) => world.agents.byName(name)?.id ?? CHIEF

export function scheduleCheck(check: object, world: World) {
  if ('schedule' in check) {
    const c = check.schedule as { agent: string; count?: number; check?: boolean }
    const list = agentSchedules(world, agentId(world, c.agent))
    const ok =
      (c.count === undefined || list.length === c.count) &&
      (c.check === undefined || list.some((s) => !!s.runs === c.check))
    return {
      check: `${c.agent} keeps ${c.count ?? 'some'} schedule(s)${c.check === undefined ? '' : c.check ? ' with a check' : ' with no check'}`,
      ok,
      saw: list.map((s) => `${s.name} (${s.runs ? 'check' : 'no check'})`).join(', ') || 'none',
    }
  }
  if ('last_run_words' in check) {
    const c = check.last_run_words as { agent: string; matches: string }
    const ids = agentSchedules(world, agentId(world, c.agent)).map((s) => s.id)
    const words =
      all<{ words: string | null }>(
        world.db,
        `SELECT words FROM runs WHERE schedule_id IN (${ids.map(() => '?').join(', ')}) ORDER BY started_at DESC LIMIT 1`,
        ...ids,
      )[0]?.words ?? ''
    return {
      check: `${c.agent}'s last run matches /${c.matches}/`,
      ok: new RegExp(c.matches, 'i').test(words),
      saw: words,
    }
  }
  const c = (check as { task: { title: string; state?: string; count?: number } }).task
  const found = world.tasks.list().filter((t) => t.title === c.title)
  const newest = [...found].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).at(0)
  return {
    check: `the task ${c.title}${c.state ? ` is ${c.state}` : ''}${c.count === undefined ? '' : `, ${c.count} of them`}`,
    ok:
      (c.count === undefined || found.length === c.count) &&
      (c.state === undefined || newest?.state === c.state),
    saw: found.length ? `${found.length}, the newest ${newest?.state}` : 'none',
  }
}
