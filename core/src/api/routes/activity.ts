import { z } from 'zod'
import { revertAll } from '../../connectors/takeback.ts'
import { one } from '../../world/db.ts'
import { Refused } from '../../world/kinds.ts'
import type { Ctx } from '../ctx.ts'
import type { RunView, UndoTarget, UndoView } from '../types.ts'

// The person's seen mark: the last journal line and the time when they last opened Activity.
const SEEN = 'activity_seen'
// The lines Activity shows on their own (activity-view.ts): rows a turn or the person wrote or
// took away, a connection's read, an act that went through a connector.
const NEW_KINDS = ['landed', 'wrote', 'changed', 'removed', 'reverted', 'connection_read', 'called']

export function registerActivity(ctx: Ctx): void {
  const { app, world, engine, user } = ctx
  const { activity } = ctx.views

  app.get('/api/activity', async (): Promise<RunView[]> => activity())

  // What is new since the person last opened Activity, counted in the database: runs started after
  // their seen mark, and the lines on their own after it (a turn's rows once, a connection's read,
  // an act through a connector). With no mark yet nothing counts, and asking writes nothing: the
  // window marks it (POST seen) when it hears there is none, and whenever Activity opens.
  app.get('/api/activity/new', async () => {
    const mark = seenMark()
    if (!mark) return { count: 0, marked: false }
    const n = one<{ n: number }>(
      world.db,
      `SELECT (SELECT count(*) FROM runs WHERE started_at > ?) + (SELECT count(DISTINCT coalesce('t' || turn_id, 'l' || id)) FROM journal WHERE id > ? AND run_id IS NULL AND kind IN (${NEW_KINDS.map(() => '?').join(', ')})) AS n`,
      mark.at,
      mark.line,
      ...NEW_KINDS,
    )
    return { count: Number(n?.n ?? 0), marked: true }
  })
  app.post('/api/activity/seen', async () => {
    const line = one<{ id: number | null }>(world.db, 'SELECT max(id) AS id FROM journal')?.id ?? 0
    world.setPreference(user.id, SEEN, JSON.stringify({ line, at: new Date().toISOString() }))
    return { count: 0, marked: true }
  })
  const seenMark = (): { line: number; at: string } | null => {
    try {
      const m = JSON.parse(world.preference(user.id, SEEN) ?? 'null') as {
        line?: unknown
        at?: unknown
      } | null
      return m && typeof m.line === 'number' && typeof m.at === 'string'
        ? { line: m.line, at: m.at }
        : null
    } catch {
      return null
    }
  }

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
