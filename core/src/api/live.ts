// A site's sign-in on a server: the live picture of its browser, over one websocket. Frames go to
// the person's window, what they click and type comes back, and when the page that asked opens
// without a sign-in the card is answered and whatever met it carries on.
import { LIVE_SIZE, type LiveBrowser, type LiveInput } from '@alpha/connector-sdk'
import type { WebSocket } from '@fastify/websocket'
import { z } from 'zod'
import type { Engine } from '../engine/engine.ts'
import { schedules } from '../modules/schedules.ts'
import type { User, World } from '../world/world.ts'

const Point = { x: z.number(), y: z.number() }
const Sent = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('done') }),
  z.object({
    kind: z.enum(['move', 'down', 'up']),
    ...Point,
    button: z.enum(['left', 'right', 'middle']).optional(),
  }),
  z.object({ kind: z.literal('wheel'), ...Point, dx: z.number(), dy: z.number() }),
  z.object({ kind: z.enum(['keydown', 'keyup']), key: z.string().max(40) }),
  z.object({ kind: z.literal('paste'), text: z.string().max(4000) }),
])

export function liveSignIn(
  socket: WebSocket,
  id: string,
  world: World,
  engine: Engine,
  user: User,
): void {
  const say = (m: object) => {
    if (socket.readyState === 1) socket.send(JSON.stringify(m))
  }
  const refuse = (problem: string) => {
    say({ problem })
    socket.close()
  }
  const card = world.cards.get(id)
  const input = (card?.call?.input ?? {}) as { url?: string; schedule?: string | null }
  const hands = engine.hands
  if (card?.state !== 'waiting' || card.call?.tool !== 'site_sign_in' || !input.url) {
    refuse('That sign-in is not waiting.')
    return
  }
  if (card.user && card.user !== user.id) {
    refuse('That sign-in is someone else’s.')
    return
  }
  if (!hands) {
    refuse('Alpha has no browser here.')
    return
  }
  const url = input.url
  // the browser as the person the card is for: their profile for this site
  const browser = hands.browser().as(card.user ?? user.id)
  let live: LiveBrowser | null = null
  let gone = false
  let finished = false
  const finish = () => {
    if (finished) return
    finished = true
    browser.markSignedIn(url)
    world.cards.answer(id, 'Sign in', { kind: 'person', id: user.id })
    say({ done: true })
    socket.close()
    const schedule = schedules(world).find((a) => a.id === input.schedule)
    if (schedule)
      void hands.runner.runSchedule(schedule, { user: user.id, turn: null }).catch(() => undefined)
    engine.events.emit('event', { type: 'lines', user: user.id })
  }
  socket.on('message', (raw: Buffer) => {
    let sent: z.infer<typeof Sent>
    try {
      sent = Sent.parse(JSON.parse(raw.toString()))
    } catch {
      return
    }
    if (sent.kind === 'done') finish()
    else void live?.input(sent as LiveInput).catch(() => undefined)
  })
  socket.on('close', () => {
    gone = true
    void live?.close()
  })
  void (async () => {
    try {
      live = await browser.openLive(url)
      say({ size: LIVE_SIZE })
      await live.start((frame) => say({ frame }), finish)
      if (gone) await live.close()
    } catch (err) {
      refuse(err instanceof Error ? err.message : 'The site did not open.')
    }
  })()
}
