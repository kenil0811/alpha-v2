// What an agent saved the person this week (Monday to today, the person's own days): nothing records
// a real figure yet, so it is its finished work counted by kind, times the minutes each kind saves
// (limits.yaml). A schedule's wake is a task given to the agent, so tasks done count those too.

import { config } from '../../config.ts'
import { dayOf, dayPlus, startOf, weekdayOf } from '../../world/day.ts'
import { all } from '../../world/db.ts'
import type { World } from '../../world/world.ts'
import type { TimeSavedView } from '../agent-types.ts'

const KINDS = [
  {
    key: 'task_done',
    words: (n: number) => `${n} task${n === 1 ? '' : 's'} done`,
    sql: "SELECT done_at AS at FROM tasks WHERE owner_kind = 'alpha' AND owner_id = ? AND state = 'done' AND done_at >= ? AND done_at < ?",
  },
  {
    key: 'ask_answered',
    words: (n: number) => `${n} ask${n === 1 ? '' : 's'} answered`,
    sql: "SELECT settled_at AS at FROM agent_asks WHERE to_agent = ? AND state = 'answered' AND settled_at >= ? AND settled_at < ?",
  },
] as const

export function timeSaved(world: World, agent: string, at = new Date()): TimeSavedView | null {
  const monday = dayPlus(dayOf(at), -weekdayOf(dayOf(at)))
  const week = Array.from({ length: 7 }, (_, i) => dayPlus(monday, i))
  const from = startOf(monday).toISOString()
  const to = startOf(dayPlus(monday, 7)).toISOString()
  const each = config.limits().minutes_saved
  const days = week.map(() => 0)
  const how: string[] = []
  for (const k of KINDS) {
    const mins = each[k.key]
    if (mins === undefined) continue
    const rows = all<{ at: string }>(world.db, k.sql, agent, from, to)
    if (!rows.length) continue
    for (const r of rows) {
      const i = week.indexOf(dayOf(new Date(r.at)))
      if (i >= 0) days[i] = (days[i] ?? 0) + mins
    }
    how.push(`${k.words(rows.length)} × ${mins} min each`)
  }
  if (!how.length) return null
  return {
    minutes: days.reduce((a, b) => a + b, 0),
    days,
    source: 'estimated',
    how: how.join(', '),
  }
}
