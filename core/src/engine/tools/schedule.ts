// The schedule tools: an agent's standing work, on a clock or when something changes, and the way
// a scheduled run says it has nothing to tell.
import { Trigger } from '@alpha/kit-sdk'
import { z } from 'zod'
import { changeSchedule, makeSchedule, removeSchedule } from '../../modules/agent-schedules.ts'
import {
  agentSchedules,
  nextRun,
  type Schedule,
  setScheduleState,
  whenWords,
} from '../../modules/schedules.ts'
import { CHIEF } from '../../world/agents/index.ts'
import { Refused } from '../../world/kinds.ts'
import { taskOfTurn } from '../../world/tasks/index.ts'
import type { ToolEntry } from '../registry.ts'
import type { Tooling } from './common.ts'
import { guard, guardAsync, ok, tool } from './common.ts'

export function scheduleTools({ world, here, hands, ctx }: Tooling): ToolEntry[] {
  const agentOf = (name?: string): string => {
    if (!name?.trim()) return here.current.agent ?? CHIEF
    if (/^chief( of staff)?$/i.test(name.trim())) return CHIEF
    const a = world.agents.byName(name.trim())
    if (!a) throw new Refused(`There is no agent called ${name}.`)
    return a.id
  }
  const scheduledRun = () => {
    const task = taskOfTurn(here.current.turn)
    return task && world.tasks.get(task)?.schedule ? task : null
  }
  const shown = (s: Schedule) => ({
    name: s.name,
    state: s.state,
    when: whenWords(s.trigger),
    next: nextRun(s.trigger, s.lastRunAt, Date.now())?.toISOString() ?? null,
    last_ran: s.lastRunAt,
    has_check: !!s.runs,
  })
  return [
    tool(
      'schedule',
      [
        'Standing work for an agent: it runs by itself on a clock or when something changes. A task is one piece of work someone will want to see on the board, even if it repeats; a schedule is for watching and routines.',
        'Actions: make (name, when, what, and check when the job is watching something), change (name, then what changes), pause, resume, remove, list. It is your own unless you name another agent. A schedule that belongs to a module is a file instead: write schedules/<name>.md with keep.',
        "when: { every: 'hour' | 'day' | 'weekday' | 'week' | 'monday' ... 'sunday', at: '08:00' }, { cron: '*/15 * * * *' }, { changes: 'A table' } or { filed: true }, in the person's own time.",
        'what: what to do at each run, written for yourself with no memory of this conversation.',
        "check: plain JavaScript that looks first, so you wake only when there is something to do. It costs nothing to run: `export default async function (alpha) { ...; return { wake: false } }`, or `return { wake: true, found: ... }` with what you will need. alpha.input.lastRun is when it last ran. It can read (alpha.rows.list, alpha.documents.list, alpha.people.list, alpha.journal.list, alpha.browser.open, alpha.browser.extract) and keep files in its own folder to remember what it saw, and it cannot write, draft, send or use the model. A new site waits on the person's yes. It is tried once when you make it, and you see what it returned. A job with no check wakes you every time, which suits a daily briefing and not a frequent watch.",
      ].join('\n'),
      {
        action: z.enum(['make', 'change', 'pause', 'resume', 'remove', 'list']),
        name: z.string().optional(),
        new_name: z.string().optional(),
        agent: z.string().optional(),
        when: Trigger.optional(),
        what: z.string().optional(),
        check: z.string().nullable().optional(),
      },
      async (a) =>
        guardAsync(async () => {
          const runner = hands?.runner
          if (!runner) throw new Refused('Schedules are not set up here.')
          if (a.action === 'list') {
            const list = agentSchedules(world, agentOf(a.agent))
            return ok(list.length ? list.map(shown) : 'No schedules yet.')
          }
          if (scheduledRun())
            throw new Refused(
              'A scheduled run cannot make or change schedules. Say in your report what you would change.',
            )
          const agent = agentOf(a.agent)
          if (here.current.agent && agent !== here.current.agent)
            throw new Refused('Only the Chief of staff keeps schedules for another agent.')
          if (a.action === 'make')
            return ok(
              await makeSchedule(
                world,
                runner,
                agent,
                { name: a.name, when: a.when, what: a.what, check: a.check },
                ctx(),
              ),
            )
          const s = agentSchedules(world, agent).find(
            (x) => x.name.toLowerCase() === a.name?.trim().toLowerCase(),
          )
          if (!s) throw new Refused(`There is no schedule called ${a.name}.`)
          if (a.action === 'pause' || a.action === 'resume') {
            setScheduleState(
              world,
              s.id,
              a.action === 'pause' ? 'paused' : 'on',
              here.current.user.id,
            )
            return ok(`${s.name} is ${a.action === 'pause' ? 'paused' : 'on'}.`)
          }
          if (a.action === 'remove') {
            await removeSchedule(world, s, ctx())
            return ok(`${s.name} is removed.`)
          }
          return ok(
            await changeSchedule(
              world,
              runner,
              s,
              { name: a.new_name, when: a.when, what: a.what, check: a.check },
              ctx(),
            ),
          )
        }),
    ),
    tool(
      'nothing_to_report',
      'Only in a scheduled run: there is nothing worth telling the person this time. The run closes without a notice, and its history keeps it.',
      {},
      async () =>
        guard(() => {
          const task = scheduledRun()
          if (!task) throw new Refused('Only a scheduled run can have nothing to report.')
          here.bus?.quietTask?.(task)
          return ok('Noted. That finishes this run: end your turn now and write nothing more.')
        }),
      { alwaysLoad: true },
    ),
  ]
}
