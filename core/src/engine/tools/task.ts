// The task tool: find, add, change, remove, hand to an agent (design §12).

import { z } from 'zod'
import { agents } from '../../modules/agents.ts'
import { Refused } from '../../world/kinds.ts'
import type { Table } from '../../world/shape.ts'
import { PRIORITIES, type Task } from '../../world/tasks/index.ts'
import type { ToolEntry } from '../registry.ts'
import type { Tooling } from './common.ts'
import { guard, ok, tool } from './common.ts'

export function taskTools({ world, here, hands, ctx }: Tooling): ToolEntry[] {
  return [
    tool(
      'task',
      [
        "Keep the person's tasks: one list of all work, each on the place it concerns. Read them in the view tasks.",
        'add: a task with its title, on the place it concerns: on { module, table, row, field, page } (find the row first with query or search). Without on it sits on the module the person asked from, or nowhere yet. Then say in a line where you put it, so they can change it. touches: other rows ({ kind: row, ref: <row id> }), people ({ kind: person, ref: <id in view people> }) or files ({ kind: file, ref: <hash> }) it is about. An open task on the same place with most of the same words comes back as similar: offer to keep one.',
        "due: a day (2026-10-24) or a moment (2026-10-24T10:00:00, the person's time unless it says its zone); remind_at: when to remind them (a Mac notification and a line on Home); repeat: every day, every weekday, every Monday, every 2 weeks, monthly, on the 1st of each month (each occurrence its own task, the next made when one is done); priority: high, normal or low; owner: me (the person), alpha, or the name of an agent that takes tasks (its file says tasks: true); parent: the task it sits under.",
        'change (and on, to move it), start, wait, done, drop, reopen: one task by its id. Giving a task to an agent never starts it: start does, when the person says so, and runs the agent on it; its run says when it is done. remove: tasks by their ids (with the ones beneath), with asked_in: the person’s words asking for it, when they did. find: open tasks, by words and place.',
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
            const agent = agents(world).find((x) => x.name.toLowerCase() === o.trim().toLowerCase())
            if (!agent)
              throw new Refused(
                `There is no agent called ${o}; the owner is me, alpha or an agent's name.`,
              )
            return { kind: 'agent' as const, id: agent.id }
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
                  ...(a.repeat !== undefined ? { repeat: a.repeat } : {}),
                  ...(a.priority ? { priority: a.priority } : {}),
                  ...(a.owner !== undefined ? { owner: owner(a.owner) } : {}),
                  ...(a.parent !== undefined ? { parent: a.parent } : {}),
                  ...(a.on !== undefined ? { on: a.on, placedBy: 'alpha' } : {}),
                  ...(a.touches !== undefined ? { refs: a.touches } : {}),
                },
                c,
              )
              return ok({ task: shown(t) })
            }
            case 'start': {
              const t = world.tasks.get(one())
              if (t?.owner.kind === 'agent') {
                if (!hands?.runner) throw new Refused('Agents are not set up in this core.')
                hands.runner
                  .startTask(t.id, { user: here.current.user.id, turn: here.current.turn })
                  .run.catch(() => undefined)
                return ok(
                  `Started ${world.tasks.ownerWords(t)} on it; its steps go to the task's page and Activity, and its run says when it is done.`,
                )
              }
              return ok({ task: shown(world.tasks.setState(one(), 'doing', c)) })
            }
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
