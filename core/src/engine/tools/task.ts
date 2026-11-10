// The task tool: find, add, change, remove.

import { z } from 'zod'
import { config } from '../../config.ts'
import { CHIEF } from '../../world/agents/index.ts'
import { Refused } from '../../world/kinds.ts'
import type { Table } from '../../world/shape/index.ts'
import { PRIORITIES, type Task, taskOfTurn } from '../../world/tasks/index.ts'
import type { ToolEntry } from '../registry.ts'
import type { Tooling } from './common.ts'
import { guard, ok, tool } from './common.ts'

export function taskTools({ world, here, ctx }: Tooling): ToolEntry[] {
  return [
    tool(
      'task',
      [
        "Keep the person's tasks: one list of all work, each on the place it concerns. Read them in the view tasks.",
        'Actions: add (on the place it concerns, with due, remind_at, repeat, priority, owner (me, alpha, or an agent’s name: that agent starts on it at once), parent, touches), change, start, wait, done, drop, reopen (one task by id), remove (ids, with asked_in: the person’s words), find (open tasks by words and place). Read the task grammar with guide (about: tasks) before you add or change one.',
      ].join('\n'),
      {
        action: z.enum([
          'add',
          'change',
          'start',
          'wait',
          'done',
          'drop',
          'reopen',
          'remove',
          'find',
        ]),
        id: z.string().optional(),
        ids: z.array(z.string()).optional(),
        title: z.string().optional(),
        notes: z.string().nullable().optional(),
        due: z.string().nullable().optional(),
        remind_at: z.string().nullable().optional(),
        starts: z.string().nullable().optional(),
        repeat: z.string().nullable().optional(),
        priority: z.enum(PRIORITIES).optional(),
        owner: z.string().optional(),
        parent: z.string().nullable().optional(),
        on: z
          .object({
            module: z.string().optional(),
            table: z.string().optional(),
            row: z.string().optional(),
            field: z.string().optional(),
            page: z.string().optional(),
          })
          .nullable()
          .optional(),
        touches: z
          .array(z.object({ kind: z.enum(['row', 'person', 'file']), ref: z.string() }))
          .optional(),
        words: z.string().optional(),
        asked_in: z.string().optional(),
      },
      async (a) =>
        guard(() => {
          const c = ctx()
          const owner = (o: string) => {
            if (/^(me|you|the person|person)$/i.test(o.trim()))
              return { kind: 'person' as const, id: here.current.user.id }
            if (/^alpha$/i.test(o.trim())) return { kind: 'alpha' as const, id: null }
            if (/^chief( of staff)?$/i.test(o.trim())) return { kind: 'alpha' as const, id: CHIEF }
            const agent = world.agents.byName(o.trim())
            if (agent) return { kind: 'alpha' as const, id: agent.id }
            throw new Refused(`The owner is me, alpha or an agent's name, not ${o}.`)
          }
          // an agent set on a task starts on it; a request gives out only so many, a chain goes
          // only so deep, and Alpha counts them
          const give = (t: Task) => {
            if (!(t.owner.kind === 'alpha' && t.owner.id)) return
            const cur = here.current
            const root = cur.root ?? cur.turn
            const limits = config.limits()
            const parent = cur.ask ? world.asks.get(cur.ask)?.hop : undefined
            const own = taskOfTurn(cur.turn)
            const hop = (parent ?? (own ? world.tasks.get(own)?.given?.hop : 0) ?? 0) + 1
            if (hop > limits.hops_in_a_chain)
              throw new Refused(
                `This chain is ${limits.hops_in_a_chain} steps deep, so it stops here.`,
              )
            if (
              root &&
              world.tasks.givenIn(root) + world.asks.ofRoot(root).length >= limits.asks_per_request
            )
              throw new Refused(
                `This request has given out ${limits.asks_per_request} pieces of work, so it stops here. Tell the person.`,
              )
            here.bus?.giveTask?.(cur.user, t.id, { root: root ?? null, hop })
          }
          const shown = (t: Task) => ({
            id: t.id,
            title: t.title,
            state: t.state,
            due: t.due,
            on: world.tasks.placeWords(t.place, (table, row) =>
              world.rowName(
                world.shape.table(table) as Table,
                world.records.get(row)?.record.values ?? {},
              ),
            ),
          })
          const one = () => {
            if (!a.id) throw new Refused('Give the task by its id.')
            return a.id
          }
          switch (a.action) {
            case 'add': {
              const from = here.current.from
              const on = a.on ?? (from ? { module: from.id } : null)
              const placeOf = on ? world.tasks.resolvePlace(on) : null
              const similar = placeOf && a.title ? world.tasks.similar(a.title, placeOf) : []
              const t = world.tasks.add(
                {
                  title: a.title ?? '',
                  notes: a.notes ?? null,
                  due: a.due ?? null,
                  remindAt: a.remind_at ?? null,
                  startsAt: a.starts ?? null,
                  repeat: a.repeat ?? null,
                  ...(a.priority ? { priority: a.priority } : {}),
                  ...(a.owner !== undefined ? { owner: owner(a.owner) } : {}),
                  parent: a.parent ?? null,
                  on,
                  refs: a.touches ?? [],
                  placedBy: a.on ? 'alpha' : from ? 'asked from' : null,
                },
                c,
              )
              give(t)
              return ok({
                task: shown(t),
                ...(similar.length ? { similar: similar.map(shown) } : {}),
              })
            }
            case 'change': {
              const t = world.tasks.change(
                one(),
                {
                  ...(a.title !== undefined ? { title: a.title } : {}),
                  ...(a.notes !== undefined ? { notes: a.notes } : {}),
                  ...(a.due !== undefined ? { due: a.due } : {}),
                  ...(a.remind_at !== undefined ? { remindAt: a.remind_at } : {}),
                  ...(a.starts !== undefined ? { startsAt: a.starts } : {}),
                  ...(a.repeat !== undefined ? { repeat: a.repeat } : {}),
                  ...(a.priority ? { priority: a.priority } : {}),
                  ...(a.owner !== undefined ? { owner: owner(a.owner) } : {}),
                  ...(a.parent !== undefined ? { parent: a.parent } : {}),
                  ...(a.on !== undefined ? { on: a.on, placedBy: 'alpha' } : {}),
                  ...(a.touches !== undefined ? { refs: a.touches } : {}),
                },
                c,
              )
              if (a.owner !== undefined) give(t)
              return ok({ task: shown(t) })
            }
            case 'start':
              return ok({ task: shown(world.tasks.setState(one(), 'doing', c)) })
            case 'wait':
            case 'done':
            case 'drop':
            case 'reopen': {
              const state = {
                wait: 'waiting',
                done: 'done',
                drop: 'dropped',
                reopen: 'todo',
              } as const
              const t = world.tasks.setState(one(), state[a.action], c)
              return ok({ task: shown(t) })
            }
            case 'remove': {
              const ids = a.ids ?? (a.id ? [a.id] : [])
              if (!ids.length) throw new Refused('Give the tasks to remove by their ids.')
              return ok(`Removed ${world.tasks.remove(ids, c)} task(s).`)
            }
            case 'find': {
              const on = a.on ? world.tasks.resolvePlace(a.on) : undefined
              return ok(
                world.tasks
                  .list({
                    open: true,
                    ...(on ? { on } : {}),
                    ...(a.words ? { words: a.words } : {}),
                  })
                  .slice(0, 100)
                  .map(shown),
              )
            }
          }
        }),
      { alwaysLoad: true },
    ),
  ]
}
