// A site's Chrome on a person's computer, as the core's browser drives it (step 4 of the Bridge,
// 17 Nov): the computer runs that Chrome with its DevTools on a pipe and carries what it says over
// its one connection (hub.ts); here a websocket on this machine's own loopback, one use per
// address, hands it to Playwright as if Chrome were local. Nothing listens on the computer, and
// this relay only on 127.0.0.1, under a one-time key.
import { randomBytes } from 'node:crypto'
import { connectOver, type OnComputer, Problem } from '@alpha/connector-sdk'
import websocket from '@fastify/websocket'
import Fastify from 'fastify'
import { bridges } from './hub.ts'

interface Waiting {
  attach(send: (m: string) => void, close: () => void): void
}

let relay: Promise<number> | null = null
const waiting = new Map<string, Waiting>()

// The relay, started on first use: its port on 127.0.0.1.
function port(): Promise<number> {
  relay ??= (async () => {
    const app = Fastify({ logger: false })
    await app.register(websocket)
    app.get('/cdp/:key', { websocket: true }, (socket, req) => {
      const { key } = req.params as { key: string }
      const w = waiting.get(key)
      waiting.delete(key)
      if (!w) return socket.close(4404, 'No such page here.')
      w.attach(
        (m) => socket.send(m),
        () => socket.close(),
      )
      socket.on('message', (raw: Buffer) => sendOf(key)?.(raw.toString()))
      socket.on('close', () => closeOf(key)?.())
    })
    await app.listen({ host: '127.0.0.1', port: 0 })
    const a = app.server.address()
    return typeof a === 'object' && a ? a.port : 0
  })()
  return relay
}

const senders = new Map<string, (m: string) => void>()
const closers = new Map<string, () => void>()
const sendOf = (key: string) => senders.get(key)
const closeOf = (key: string) => closers.get(key)
type SiteContext = Awaited<ReturnType<OnComputer['context']>>

// The site's own context in Chrome on the computer; it ends with that Chrome, or the computer.
export async function siteContext(computer: string, site: string): Promise<SiteContext> {
  const key = randomBytes(24).toString('hex')
  let toPlaywright: ((m: string) => void) | null = null
  let endPlaywright: (() => void) | null = null
  let failed: ((why: string) => void) | null = null
  const heard: string[] = []
  const pipe = bridges.pipe(
    computer,
    site,
    (m) => (toPlaywright ? toPlaywright(m) : heard.push(m)),
    (why) => {
      senders.delete(key)
      closers.delete(key)
      if (endPlaywright) endPlaywright()
      else failed?.(why ?? 'Google Chrome stopped on the computer.')
    },
  )
  if (!pipe) throw new Problem('That computer is not connected now.', 'away')
  senders.set(key, (m) => pipe.send(m))
  closers.set(key, () => {
    senders.delete(key)
    closers.delete(key)
    pipe.close()
  })
  waiting.set(key, {
    attach: (send, close) => {
      for (const m of heard.splice(0)) send(m)
      toPlaywright = send
      endPlaywright = close
    },
  })
  const stopped = new Promise<never>((_, reject) => {
    failed = (why) => reject(new Problem(why, 'blocked'))
  })
  try {
    return await Promise.race([connectOver(`ws://127.0.0.1:${await port()}/cdp/${key}`), stopped])
  } catch (err) {
    waiting.delete(key)
    closeOf(key)?.()
    throw err
  }
}
