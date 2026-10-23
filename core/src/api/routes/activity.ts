import { z } from 'zod'
import { agents, nextRun } from '../../modules/agents.ts'
import type { Ctx } from '../ctx.ts'
import type { RunView, TodayView } from '../types.ts'

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
        (r) => r.startedAt > since && r.state !== 'running' && (!r.quiet || r.state === 'failed'),
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

  app.post('/api/runs/:id/stop', async (req) => {
    const { id } = z.object({ id: z.string() }).parse(req.params)
    return { stopped: engine.hands?.runner.stop(id) ?? false }
  })
}
