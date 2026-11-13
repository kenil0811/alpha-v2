// A work's tab, watched and taken over: the live picture of the page an agent works on, over one
// websocket, for the person the work acts as and nobody else. Watching sends the page nothing. Take
// over holds the page: what the person clicks and types reaches it and passes no gate, the agent's
// steps on it wait, and the record says only that they had it and for how long. Hand back lets the
// agent carry on, on the page as it is now.
import { type LiveInput, type LiveTab, Problem } from '@alpha/connector-sdk'
import type { WebSocket } from '@fastify/websocket'
import { z } from 'zod'
import { handedBack } from '../engine/acting.ts'
import type { Engine } from '../engine/engine.ts'
import { CHIEF } from '../world/agents/index.ts'
import type { User, World } from '../world/world.ts'

const Point = { x: z.number(), y: z.number() }
const Sent = z.discriminatedUnion('kind', [
  z.object({ kind: z.enum(['take', 'back']) }),
  z.object({
    kind: z.enum(['move', 'down', 'up']),
    ...Point,
    button: z.enum(['left', 'right', 'middle']).optional(),
  }),
  z.object({ kind: z.literal('wheel'), ...Point, dx: z.number(), dy: z.number() }),
  z.object({ kind: z.enum(['keydown', 'keyup']), key: z.string().max(40) }),
  z.object({ kind: z.literal('paste'), text: z.string().max(4000) }),
])

export function watchTab(
  socket: WebSocket,
  tab: string,
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
  const hands = engine.hands
  if (!hands) {
    refuse('Alpha has no browser here.')
    return
  }
  // the browser as the person asking: a tab of someone else's work is not among theirs (rule L3)
  const browser = hands.browser().as(user.id)
  let live: LiveTab
  try {
    live = browser.watch(tab)
  } catch (err) {
    refuse(err instanceof Problem ? err.message : 'That page is not open any more.')
    return
  }
  let took = false // taken over through this window
  const back = () => {
    const site = hostOf(browser.openTabs().find((t) => t.work === tab)?.url)
    const had = took ? browser.release(tab) : null
    took = false
    say({ held: false })
    if (!had) return
    const next = handedBack(world, tab, site, had, user)
    // the card that asked them onto the page is answered, and its work goes on; else the agent
    // whose step waited is told to carry on
    if (next.card) engine.answer(user, next.card.id, next.card.options[0] ?? 'Yes')
    else if (next.text) {
      const task = next.work.startsWith('task:') ? next.work.slice(5) : undefined
      engine
        .desk(user, next.agent || CHIEF, task)
        .takeWork('You handed the page back.', next.text, task ? undefined : next.work)
    }
    engine.events.emit('event', { type: 'lines', user: user.id })
  }
  socket.on('message', (raw: Buffer) => {
    let sent: z.infer<typeof Sent>
    try {
      sent = Sent.parse(JSON.parse(raw.toString()))
    } catch {
      return
    }
    if (sent.kind === 'take') {
      browser.hold(tab)
      took = true
      say({ held: true })
    } else if (sent.kind === 'back') back()
    // what they do reaches the page only while they hold it
    else if (took) void live.input(sent as LiveInput).catch(() => undefined)
  })
  socket.on('close', () => {
    // a window closed with the page in hand hands it back
    if (took) back()
    void browser.unwatch(tab, live)
  })
  void (async () => {
    try {
      say({ size: live.size(), held: false })
      await live.start((frame) => say({ frame }))
    } catch (err) {
      refuse(err instanceof Error ? err.message : 'The page did not open.')
    }
  })()
}

const hostOf = (url: string | undefined): string => {
  try {
    return new URL(url ?? '').host || 'the page'
  } catch {
    return 'the page'
  }
}
