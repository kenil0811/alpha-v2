import { z } from 'zod'
import { agents, nextRun } from '../../modules/agents.ts'
import { Refused } from '../../world/kinds.ts'
import { revert } from '../../world/records/index.ts'
import type { Ctx } from '../ctx.ts'
import type { RunView, TodayView, UndoTarget, UndoView } from '../types.ts'

export function registerActivity(ctx: Ctx): void {
  const { app, world, engine, user } = ctx
  const { activity } = ctx.views

  app.get('/api/activity', async (): Promise<RunView[]> => activity())

  // Today: what changed since the person last cleared it, and each clock agent's next run.
  app.get('/api/today', async (): Promise<TodayView> => {
    const start = new Date()
    start.setHours(0, 0, 0, 0)
    // never cleared yet: since the start of today
    const since = world.preference(user.id, 'seen_at') ?? start.toISOString()
    const changed = activity()
      .filter(
        (r) =>
          (r.kind === 'run' || r.kind === 'read') &&
          r.startedAt > since &&
          r.state !== 'running' &&
          (!r.quiet || r.state === 'failed'),
      )
      .map((r) => ({ ...r, steps: [] }))
    const now = Date.now()
    const modules = new Map(world.shape.modules().map((m) => [m.id, m.name]))
    const coming = agents(world)
      .filter((a) => a.state === 'on')
      .flatMap((a) => {
        const next = nextRun(a.trigger, a.lastRunAt, now)
        if (!next) return []
        const moduleName = modules.get(a.module) ?? ''
        return [{ agent: a.id, name: a.name, module: a.module, moduleName, at: next.toISOString() }]
      })
      .sort((a, b) => a.at.localeCompare(b.at))
    return { since, changed, coming }
  })

  // The person cleared what changed: Today's list starts again from now.
  app.post('/api/today/seen', async () => {
    world.setPreference(user.id, 'seen_at', new Date().toISOString())
    return { ok: true }
  })

  // Revert or Bring back (core step 1): what it would do, then doing it, on the person's word in
  // the one pop-up. The target is an Activity entry's, and so are the words naming it.
  const Target = z.union([
    z.object({ run: z.string() }),
    z.object({ turn: z.string() }),
    z.object({ line: z.coerce.number().int() }),
  ])
  const entry = (target: UndoTarget) =>
    activity().find((r) => r.undo && JSON.stringify(r.undo.target) === JSON.stringify(target))
  app.post('/api/undo/preview', async (req): Promise<UndoView> => {
    const target = Target.parse(req.body)
    const e = entry(target)
    if (!e?.undo) throw new Refused('That can’t be reverted.')
    return revert(
      world.records,
      target,
      { actor: { kind: 'person', id: user.id }, user: user.id },
      e.undo.what,
      {
        preview: true,
      },
    )
  })
  app.post('/api/undo', async (req): Promise<UndoView> => {
    const target = Target.parse(req.body)
    const e = entry(target)
    if (!e?.undo) throw new Refused('That can’t be reverted.')
    const done = revert(
      world.records,
      target,
      { actor: { kind: 'person', id: user.id }, user: user.id },
      e.undo.what,
    )
    engine.events.emit('event', { type: 'lines', user: user.id })
    return done
  })

  app.post('/api/runs/:id/stop', async (req) => {
    const { id } = z.object({ id: z.string() }).parse(req.params)
    return { stopped: engine.hands?.runner.stop(id) ?? false }
  })
}
