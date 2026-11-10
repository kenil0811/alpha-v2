import { z } from 'zod'
import { Refused } from '../../world/kinds.ts'
import type { Task } from '../../world/tasks/index.ts'
import type { Ctx } from '../ctx.ts'
import { keptEdit, keptField, keptTable } from '../kept.ts'
import type { KeptTable, TasksView, TaskView } from '../types.ts'

export function registerTasks(ctx: Ctx): void {
  const { app, world, user, options, live, asPerson, engine } = ctx
  const { placeOf, lineOf, taskOut, given, today, inDays } = ctx.views

  const LISTS: Record<string, () => Task[]> = {
    today: () => world.tasks.list({ open: true, dueBy: today() }),
    week: () => world.tasks.list({ open: true, dueBy: inDays(7) }),
    overdue: () => world.tasks.list({ open: true, dueBy: inDays(-1) }),
    waiting: () => world.tasks.list({ open: true }).filter((t) => t.state === 'waiting'),
    open: () => world.tasks.list({ open: true }),
    // a schedule's finished runs live on the schedule, so an hourly job does not fill this
    done: () =>
      world.tasks
        .list()
        .filter((t) => !t.schedule && (t.state === 'done' || t.state === 'dropped'))
        .sort((a, b) => (b.doneAt ?? '').localeCompare(a.doneAt ?? ''))
        .slice(0, 200),
    // the last few finished, for Home, since the person last cleared them
    finished: () => {
      const cleared = world.preference(user.id, 'completed_cleared_at') ?? ''
      const week = new Date(Date.now() - 7 * 86_400_000).toISOString()
      return world.tasks
        .list({ state: 'done' })
        .filter((t) => (t.doneAt ?? '') > (cleared > week ? cleared : week))
        .sort((a, b) => (b.doneAt ?? '').localeCompare(a.doneAt ?? ''))
        .slice(0, 3)
    },
  }
  // Tasks as a table (UI batch 2, 26 Oct): a saved list's tasks, each changed in a cell or by
  // dragging it across the board, as the person's word on the task's own record
  const STATES = {
    todo: 'To do',
    doing: 'Doing',
    waiting: 'Waiting',
    done: 'Done',
    dropped: 'Dropped',
  } as const
  const PRIORITIES = { high: 'High', normal: 'Normal', low: 'Low' } as const
  const EDITABLE = ['Task', 'State', 'Due', 'Priority']
  const WHY = 'Who it is for and where it sits change on its page.'
  const counts = () =>
    Object.fromEntries(Object.entries(LISTS).map(([k, f]) => [k, k === 'done' ? 0 : f().length]))
  app.get('/api/kept/tasks', async (req): Promise<KeptTable> => {
    const { list } = z.object({ list: z.string().default('open') }).parse(req.query)
    return keptTable(
      'tasks',
      'Tasks',
      [
        keptField('Task', 'text'),
        keptField('State', 'choice', {
          'To do': 'accent',
          Doing: 'accent',
          Waiting: 'warn',
          Done: 'good',
          Dropped: 'bad',
        }),
        keptField('Due', 'date'),
        keptField('Priority', 'choice', { High: 'bad', Normal: 'accent', Low: 'good' }),
        keptField('Owner', 'text'),
        keptField('Where', 'text'),
      ],
      (LISTS[list] ?? (LISTS.open as () => Task[]))().map((t) => {
        const l = lineOf(t)
        return {
          id: l.id,
          values: {
            task: l.title,
            state: STATES[l.state],
            due: l.due,
            priority: PRIORITIES[l.priority],
            owner: l.owner,
            where: l.place.words,
          },
        }
      }),
      { editable: EDITABLE, why: WHY, counts: counts() },
    )
  })
  app.post('/api/kept/tasks/rows/:id', async (req) => {
    const { id } = z.object({ id: z.string() }).parse(req.params)
    const { field, value } = keptEdit(req.body, EDITABLE, WHY)
    const words = value === null || value === undefined ? '' : String(value).trim()
    if (field === 'State') {
      const state = Object.entries(STATES).find(([, w]) => w === words)?.[0]
      if (!state) throw new Refused(`A task's state is one of ${Object.values(STATES).join(', ')}.`)
      world.tasks.setState(id, state as keyof typeof STATES, asPerson)
    } else if (field === 'Priority') {
      const p = Object.entries(PRIORITIES).find(([, w]) => w === words)?.[0]
      if (!p) throw new Refused('A priority is High, Normal or Low.')
      world.tasks.change(id, { priority: p as keyof typeof PRIORITIES }, asPerson)
    } else if (field === 'Due') world.tasks.change(id, { due: words || null }, asPerson)
    else {
      if (!words) throw new Refused('A task needs its words.')
      world.tasks.change(id, { title: words }, asPerson)
    }
    live()
    return { ok: true }
  })

  app.get('/api/tasks', async (req): Promise<TasksView> => {
    const q = z
      .object({
        list: z.string().default('open'),
        module: z.string().optional(),
        table: z.string().optional(),
        row: z.string().optional(),
      })
      .parse(req.query)
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
    return {
      list: q.list,
      lines: tasks.map((t) => lineOf(t)),
      counts: counts(),
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
    for (const l of world.lines({ after, kinds: ['reminder', 'card_opened', 'task_finished'] })) {
      if (l.kind === 'task_finished') {
        notices.push({
          id: `line-${l.id}`,
          title: 'Finished',
          subtitle: null,
          body: l.words,
          open: `#/tasks/${String((l.data as { task?: string }).task ?? '')}`,
        })
        continue
      }
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
      notices.push({
        id: `card-${c.id}`,
        title: 'Needs you',
        subtitle: c.module ? (world.shape.module(c.module)?.name ?? null) : null,
        body: c.words,
        open: '#/',
      })
    }
    return { last, notices }
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
    startsAt: z.string().nullable().optional(),
    repeat: z.string().nullable().optional(),
    priority: z.enum(['high', 'normal', 'low']).optional(),
    owner: z
      .object({ kind: z.enum(['person', 'alpha']), id: z.string().nullable().optional() })
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
    if (b.owner?.kind === 'alpha' && b.owner.id) engine.tasks.give(user, t.id)
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
    if (b.owner?.kind === 'alpha' && b.owner.id) engine.tasks.give(user, id)
    live()
    return taskOut(id)
  })

  app.post('/api/tasks/clear-completed', async () => {
    world.setPreference(user.id, 'completed_cleared_at', new Date().toISOString())
    return { ok: true }
  })

  app.post('/api/tasks/:id/run', async (req): Promise<TaskView | undefined> => {
    const { id } = z.object({ id: z.string() }).parse(req.params)
    engine.tasks.again(user, id)
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
