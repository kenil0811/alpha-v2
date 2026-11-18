// The never-use list in Settings › Permissions (rules N1): the kinds Alpha ships, which the owner
// may turn off for everyone where they are the firm's own work, the firm's own words, kept by the
// owner, and each person's. A connection's next read leaves out what is on it.
import { z } from 'zod'
import { Refused } from '../../world/kinds.ts'
import { EVERYONE } from '../../world/never.ts'
import type { Ctx } from '../ctx.ts'
import type { NeverView } from '../never-types.ts'

export function registerNever(ctx: Ctx): void {
  const { app, world, user, asPerson, live } = ctx
  const owner = () => user.role === 'owner'
  const scopeOf = (who: 'me' | 'everyone') => {
    if (who === 'everyone' && !owner())
      throw new Refused('Only the owner changes the list for everyone.')
    return who === 'everyone' ? EVERYONE : user.id
  }

  app.get(
    '/api/never',
    async (): Promise<NeverView> => ({
      kinds: world.never.kinds(),
      everyone: world.never.words(EVERYONE),
      yours: world.never.words(user.id),
      owner: owner(),
    }),
  )

  app.post('/api/never/add', async (req) => {
    const b = z.object({ for: z.enum(['me', 'everyone']), word: z.string() }).parse(req.body)
    world.never.add(scopeOf(b.for), b.word, asPerson)
    live()
    return { ok: true }
  })

  app.post('/api/never/remove', async (req) => {
    const b = z.object({ for: z.enum(['me', 'everyone']), word: z.string() }).parse(req.body)
    world.never.remove(scopeOf(b.for), b.word, asPerson)
    live()
    return { ok: true }
  })

  app.post('/api/never/kind', async (req) => {
    const b = z.object({ key: z.string(), on: z.boolean() }).parse(req.body)
    if (!owner()) throw new Refused('Only the owner turns a kind on or off for everyone.')
    world.never.setKind(b.key, b.on, asPerson)
    live()
    return { ok: true }
  })
}
