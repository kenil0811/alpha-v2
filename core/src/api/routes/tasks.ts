import { z } from 'zod'
import { Refused } from '../../world/kinds.ts'
import type { Task } from '../../world/tasks/index.ts'
import type { Ctx } from '../ctx.ts'
import type { TasksView, TaskView } from '../types.ts'

export function registerTasks(ctx: Ctx): void {
  const { app, world, engine, user, options, live, asPerson } = ctx
  const { placeOf, waitingCards, workingOn, lineOf, taskOut, taskOfRun, given, today, inDays } =
    ctx.views

  const LISTS: Record<string, () => Task[]> = {
    today: () => world.tasks.list({ open: true, dueBy: today() }),
    week: () => world.tasks.list({ open: true, dueBy: inDays(7) }),
    overdue: () => world.tasks.list({ open: true, dueBy: inDays(-1) }),
    waiting: () => {
      const w = waitingCards()
      return world.tasks.list({ open: true }).filter((t) => t.state === 'waiting' || w.has(t.id))
    },
    // the tasks given to agents, the ones they work on now first
    agents: () => {
      const w = workingOn()
      return world.tasks
        .list({ open: true, owner: { kind: 'agent' } })
        .sort((a, b) => Number(w.has(b.id)) - Number(w.has(a.id)))
    },
    open: () => world.tasks.list({ open: true }),
    done: () =>
      world.tasks
        .list()
        .filter((t) => t.state === 'done' || t.state === 'dropped')
        .sort((a, b) => (b.doneAt ?? '').localeCompare(a.doneAt ?? ''))
        .slice(0, 200),
  }
  app.get('/api/tasks', async (req): Promise<TasksView> => {
    const q = z
      .object({
        list: z.string().default('open'),
        module: z.string().optional(),
        table: z.string().optional(),
        row: z.string().optional(),
      })
      .parse(req.query)
    const waiting = waitingCards()
    const on =
      q.module || q.table || q.row
        ? {
            module: q.module ?? null,
            table: q.table ?? null,
            row: q.row ?? null,
            field: null,
            page: null,
          }
        : null
    const tasks = on ? world.tasks.list({ on }) : (LISTS[q.list] ?? (LISTS.open as () => Task[]))()
    const working = workingOn()
    return {
      list: q.list,
      lines: tasks.map((t) => lineOf(t, waiting, working)),
      counts: Object.fromEntries(
        Object.entries(LISTS).map(([k, f]) => [k, k === 'done' ? 0 : f().length]),
      ),
    }
  })

  // What Alpha's Mac app shows as notifications (Kenil's plan, 21 Oct): reminders that came and
  // cards that began waiting on the person since the app last asked, each with the place a click
  // opens. Asked first with no cursor, it gives only where to start, so nothing old comes back.
  app.get('/api/notices', async (req) => {
    const { after } = z.object({ after: z.coerce.number().optional() }).parse(req.query)
    if (options.shell) options.shell.seen = Date.now()
    const last = world.lastLineId()
    if (after === undefined) return { last, notices: [] }
    const notices: {
      id: string
      title: string
      subtitle: string | null
      body: string
      open: string
    }[] = []
    for (const l of world.lines({ after, kinds: ['reminder', 'card_opened'] })) {
      if (l.kind === 'reminder') {
        const t = world.tasks.get(String((l.data as { task?: string }).task ?? ''))
        if (!t) continue
        const place = placeOf(t.place).words
        notices.push({
          id: `line-${l.id}`,
          title: 'Reminder',
          subtitle: place === 'nowhere yet' ? null : place,
          body: t.title,
          open: `#/tasks/${t.id}`,
        })
        continue
      }
      const c = world.cards.get(String((l.data as { card?: string }).card ?? l.card ?? ''))
      if (c?.state !== 'waiting' || (c.user && c.user !== user.id)) continue
      const task = c.run ? taskOfRun(c.run) : null
      notices.push({
        id: `card-${c.id}`,
        title: 'Needs you',
        subtitle: c.module ? (world.shape.module(c.module)?.name ?? null) : null,
        body: c.words,
        open: task ? `#/tasks/${task}` : '#/',
      })
    }
    return { last, notices }
  })

  // Start the agent a task is given to on it; its run goes on after this answers.
  app.post('/api/tasks/:id/start', async (req): Promise<TaskView | undefined> => {
    const { id } = z.object({ id: z.string() }).parse(req.params)
    const runner = engine.hands?.runner
    if (!runner) throw new Refused('Agents are not set up in this core.')
    runner.startTask(id, { user: user.id, turn: null }).run.catch(() => undefined)
    live()
    return taskOut(id)
  })

  app.get('/api/tasks/:id', async (req, reply): Promise<TaskView | undefined> => {
    const { id } = z.object({ id: z.string() }).parse(req.params)
    const t = taskOut(id)
    if (!t) return reply.code(404).send({ problem: 'That task is not there.' })
    return t
  })

  const TaskBody = z.object({
    title: z.string().optional(),
    notes: z.string().nullable().optional(),
    due: z.string().nullable().optional(),
    remindAt: z.string().nullable().optional(),
    repeat: z.string().nullable().optional(),
    priority: z.enum(['high', 'normal', 'low']).optional(),
    owner: z
      .object({ kind: z.enum(['person', 'alpha', 'agent']), id: z.string().nullable().optional() })
      .optional(),
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
  })
  app.post('/api/tasks', async (req): Promise<TaskView | undefined> => {
    const b = TaskBody.parse(req.body)
    const t = world.tasks.add(
      { ...given(b), title: b.title ?? '', ...(b.on ? { placedBy: 'person' } : {}) } as Parameters<
        typeof world.tasks.add
      >[0],
      asPerson,
    )
    live()
    return taskOut(t.id)
  })

  app.post('/api/tasks/:id', async (req): Promise<TaskView | undefined> => {
    const { id } = z.object({ id: z.string() }).parse(req.params)
    const b = TaskBody.parse(req.body)
    world.tasks.change(
      id,
      {
        ...given(b),
        ...(b.on !== undefined ? { placedBy: 'person', placedWhy: null } : {}),
      } as Parameters<typeof world.tasks.change>[1],
      asPerson,
    )
    live()
    return taskOut(id)
  })

  app.post('/api/tasks/:id/state', async (req): Promise<TaskView | undefined> => {
    const { id } = z.object({ id: z.string() }).parse(req.params)
    const { state } = z
      .object({ state: z.enum(['todo', 'doing', 'waiting', 'done', 'dropped']) })
      .parse(req.body)
    world.tasks.setState(id, state, asPerson)
    live()
    return taskOut(id)
  })

  // the person's own removal, from their window: their word is the ask
  app.delete('/api/tasks/:id', async (req) => {
    const { id } = z.object({ id: z.string() }).parse(req.params)
    const n = world.tasks.remove([id], asPerson)
    live()
    return { removed: n }
  })

  // open tasks per row of a table, for the counts beside its rows
  app.get('/api/tables/:id/tasks', async (req): Promise<Record<string, number>> => {
    const { id } = z.object({ id: z.string() }).parse(req.params)
    const counts: Record<string, number> = {}
    for (const t of world.tasks.list({
      open: true,
      on: { module: null, table: id, row: null, field: null, page: null },
    }))
      if (t.place.row) counts[t.place.row] = (counts[t.place.row] ?? 0) + 1
    return counts
  })
}
