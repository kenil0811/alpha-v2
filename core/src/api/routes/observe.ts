// The person's leave for Alpha to watch their work (world/observe.ts), given only on Home's offer
// once its prerequisite is met (offers.ts) and taken back in Settings › Permissions.
import { watchFrontApp } from '@alpha/connector-computer/observe'
import { bridges } from '../../bridge/hub.ts'
import { config } from '../../config.ts'
import { decide, decidedOf, nextOffer, type Offer } from '../../offers.ts'
import { giveLeave, leaveOf, mayNotWatch, takeBack } from '../../world/observe.ts'
import { progressOf } from '../../world/story.ts'
import type { User, World } from '../../world/world.ts'
import type { Ctx } from '../ctx.ts'

const online = (world: World, user: string) =>
  world.computers
    .of(user)
    .filter((pc) => bridges.online(pc.id))
    .map((pc) => pc.id)

// At the end of Set up Alpha: watching starts only past the wall (its computer stays connected,
// and the person said yes); else it never starts and nothing is said. What happened, in words.
export function watchAfterSetup(
  world: World,
  user: User,
  start: () => void = watchFrontApp,
): string {
  const not = mayNotWatch(leaveOf(world.db, user.id), user.id, online(world, user.id))
  if (not) return not
  let words = 'Alpha watches your work on your computer now.'
  try {
    start()
  } catch (err) {
    words = err instanceof Error ? err.message : String(err)
  }
  world.line({
    actor: { kind: 'system' },
    kind: 'observe',
    words: `Watching your work: ${words}`,
    user: user.id,
  })
  return words
}

// The facts an offer's prerequisites are judged on (offers.ts), for one person.
export function offerFor(world: World, user: string, now = Date.now()): Offer | null {
  const cfg = config.offers()
  const apps = world.shape.table('Apps')
  const app = apps?.fields.find((f) => f.name === 'App')?.slug ?? ''
  const on = world.computers.of(user).filter((pc) => bridges.online(pc.id))
  return nextOffer(cfg, {
    setUpAt: progressOf(world.db, user).doneAt,
    apps: apps ? world.records.list(apps.id).map((r) => String(r.values[app] ?? '')) : [],
    bridgeSince: on.map((pc) => pc.pairedAt).sort()[0] ?? null,
    decided: decidedOf(world.db, user, cfg),
    now,
  })
}

export function registerObserve(ctx: Ctx): void {
  const { app, world, user } = ctx
  const view = () => {
    const leave = leaveOf(world.db, user.id)
    return { leave, problem: mayNotWatch(leave, user.id, online(world, user.id)) }
  }
  app.get('/api/observe', async () => view())
  // the one offer to make now (one at a time, only once its prerequisite is met), and the answer
  app.get('/api/offers', async () => ({ offer: offerFor(world, user.id) }))
  app.post<{ Params: { key: string }; Body: { yes?: boolean } }>(
    '/api/offers/:key',
    async (req) => {
      const offer = offerFor(world, user.id)
      if (offer?.key !== req.params.key) return { offer, opened: false }
      const yes = req.body?.yes === true
      decide(world.db, user.id, offer.key, yes ? 'yes' : 'not now')
      if (yes && offer.key === 'watch') giveLeave(world.db, user.id)
      // Safari: the Mac's Full Disk Access opened by Alpha Bridge there
      const opened =
        yes &&
        offer.key === 'safari' &&
        world.computers.of(user.id).some((pc) => bridges.openFullDiskAccess(pc.id))
      ctx.live()
      return { offer: offerFor(world, user.id), opened }
    },
  )
  app.delete('/api/observe', async () => {
    takeBack(world.db, user.id)
    ctx.live()
    return view()
  })
}
