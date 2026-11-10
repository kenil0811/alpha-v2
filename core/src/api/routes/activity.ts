import { z } from 'zod'
import { revertAll } from '../../connectors/takeback.ts'
import { Refused } from '../../world/kinds.ts'
import type { Ctx } from '../ctx.ts'
import type { RunView, UndoTarget, UndoView } from '../types.ts'

export function registerActivity(ctx: Ctx): void {
  const { app, world, engine, user } = ctx
  const { activity } = ctx.views

  app.get('/api/activity', async (): Promise<RunView[]> => activity())

  // Revert or Bring back: what it would do, then doing it, on the person's word in
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
    return revertAll(
      world,
      engine.connectors,
      target,
      { actor: { kind: 'person', id: user.id }, user: user.id },
      e.undo.what,
      { preview: true },
    )
  })
  app.post('/api/undo', async (req): Promise<UndoView> => {
    const target = Target.parse(req.body)
    const e = entry(target)
    if (!e?.undo) throw new Refused('That can’t be reverted.')
    const done = await revertAll(
      world,
      engine.connectors,
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
