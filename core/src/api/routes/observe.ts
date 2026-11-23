// The person's leave for Alpha to watch their work (world/observe.ts), given and taken back in
// Settings › Permissions, each person's own.
import { watchFrontApp } from '@alpha/connector-computer/observe'
import { bridges } from '../../bridge/hub.ts'
import { giveLeave, leaveOf, mayNotWatch, takeBack } from '../../world/observe.ts'
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

export function registerObserve(ctx: Ctx): void {
  const { app, world, user } = ctx
  const view = () => {
    const leave = leaveOf(world.db, user.id)
    return { leave, problem: mayNotWatch(leave, user.id, online(world, user.id)) }
  }
  app.get('/api/observe', async () => view())
  app.post('/api/observe', async () => {
    giveLeave(world.db, user.id)
    ctx.live()
    return view()
  })
  app.delete('/api/observe', async () => {
    takeBack(world.db, user.id)
    ctx.live()
    return view()
  })
}
