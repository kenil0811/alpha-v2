// A person's day for Home: the Next chip and the day beside the page (ui-rules O1, L14). The window
// gives the day and its edges in the person's own time (W7). Reads only.
import { z } from 'zod'
import { theDay } from '../../modules/day.ts'
import type { Ctx } from '../ctx.ts'
import type { DayView } from '../types.ts'

export function registerDay(ctx: Ctx): void {
  const { app, world, user } = ctx
  app.get('/api/day', async (req): Promise<DayView> => {
    const on = z
      .object({
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        from: z.iso.datetime({ offset: true }),
        to: z.iso.datetime({ offset: true }),
      })
      .parse(req.query)
    return theDay(world, user.id, on)
  })
}
