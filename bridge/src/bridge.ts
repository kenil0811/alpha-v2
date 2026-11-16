// The Bridge: a person's computer lending Alpha what they turn on there, a folder first. It
// connects outward to its Alpha over one websocket (nothing on the computer listens), proves who
// it is by signing Alpha's fresh challenge with its own key, says what it lends, and runs the
// connector processes Alpha calls. What it lends is its own list (config.ts): Alpha learns it at
// every connect and whenever it changes, and the Bridge refuses whatever else Alpha asks
// (docs/rules.md, B2). Pairing comes first, with the one-time link the person made in Alpha.
import { createPrivateKey, sign } from 'node:crypto'
import { hostname } from 'node:os'
import { Children, type Start } from './children.ts'
import { type Config, type Lend, lends } from './config.ts'
import type { KeyStore } from './keys.ts'
import { newKey } from './keys.ts'

export const VERSION = '0.3.1'

// What Alpha says to the Bridge, one JSON object a message.
type FromAlpha =
  | { t: 'pick'; connector: string }
  | { t: 'challenge'; challenge: string }
  | { t: 'welcome'; name: string; lent: Lend[] }
  | { t: 'lent'; lent: Lend[] }
  | { t: 'refused'; why: string }
  | { t: 'start'; connector: string }
  | { t: 'line'; connector: string; line: string }
  | { t: 'stop'; connector: string }

// The account a computer's key is kept under: the Alpha it is paired with.
export const keyAccount = (alpha: string) => new URL(alpha).host

// The Alpha's address and the code, from the link the person made in Alpha.
export function linkOf(link: string): { alpha: string; code: string } {
  let u: URL
  try {
    u = new URL(link.trim())
  } catch {
    throw new Error('That is not a pairing link. Copy it whole from Your computers in Alpha.')
  }
  const code = u.searchParams.get('pair')
  if (!code || !/^https?:$/.test(u.protocol))
    throw new Error('That is not a pairing link. Copy it whole from Your computers in Alpha.')
  return { alpha: u.origin, code }
}

// Pairing: a new key here, its public half sent with the link's code; Alpha answers with the id
// it keeps this computer by. The private half goes into this computer's own store.
export async function pair(
  link: string,
  keys: KeyStore,
  name: string = hostname(),
  replaces?: string, // this computer's own pairing with the same Alpha before: it goes
): Promise<Config> {
  const { alpha, code } = linkOf(link)
  const key = newKey()
  const res = await fetch(`${alpha}/api/bridge/pair`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      code,
      publicKey: key.publicPem,
      name,
      platform: process.platform,
      ...(replaces ? { replaces } : {}),
    }),
  })
  const body = (await res.json().catch(() => ({}))) as {
    computer?: string
    name?: string
    alpha?: string
    problem?: string
  }
  if (!res.ok || !body.computer)
    throw new Error(body.problem ?? `Alpha did not pair this computer (${res.status}).`)
  const at = body.alpha ?? alpha
  keys.set(keyAccount(at), key.privatePem)
  return { alpha: at, computer: body.computer, name: body.name ?? name, lends: [] }
}

export interface BridgeOptions {
  config: () => Config // read again whenever it is needed, so a lend made meanwhile counts
  keys: KeyStore
  start: Start // how a connector's process is started here
  helper?: (args: string[], options: Record<string, unknown>) => Promise<unknown> // on a Mac
  said?: (words: string) => void
  pick?: (connector: string) => void // Alpha asked its person to lend one: the picker opens here
  moved?: () => void // connected, gone or paused: the app's icon follows
  WebSocket?: typeof globalThis.WebSocket
}

// One run of the Bridge: connected while it can be, trying again with growing pauses when it
// cannot; stopped by stop().
export class Bridge {
  private options: BridgeOptions
  private socket: WebSocket | null = null
  private children: Children
  private alphaLends: Lend[] = []
  private stopped = false
  private pause = 1000
  private timer: ReturnType<typeof setTimeout> | null = null
  private resumes: ReturnType<typeof setTimeout> | null = null
  online = false
  // paused by its person here: until when (none: until resumed), or not
  paused: { until: string | null } | null = null
  // turned away by Alpha (removed, or not paired there): why, until it is paired again
  turnedAway: string | null = null

  constructor(options: BridgeOptions) {
    this.options = options
    this.children = new Children(options.start, {
      up: (m) => this.send(m),
      lent: (connector, account) => lends(this.options.config(), connector, account),
      lends: (connector) =>
        this.options
          .config()
          .lends.filter((l) => l.connector === connector)
          .map((l) => l.account),
      // a folder's process reads its folders; Calendar's and Contacts' reach them through the helper
      reads: (connector) =>
        connector === 'folder'
          ? this.options
              .config()
              .lends.filter((l) => l.connector === connector)
              .map((l) => l.account)
          : [],
      said: (w) => this.said(w),
      ...(options.helper ? { helper: options.helper } : {}),
    })
  }

  run(): void {
    this.stopped = false
    this.connect()
  }

  stop(): void {
    this.stopped = true
    if (this.timer) clearTimeout(this.timer)
    this.children.stopAll()
    this.socket?.close()
    this.socket = null
    this.online = false
  }

  // Its own list changed (a lend or an unlend here): Alpha is told now.
  changed(): void {
    if (this.online) this.reconcile()
  }

  // Paused by its person, for some minutes or until resumed: nothing runs here meanwhile, and
  // Alpha's tile says so.
  pauseFor(minutes: number | null): void {
    if (this.resumes) clearTimeout(this.resumes)
    const until = minutes ? new Date(Date.now() + minutes * 60_000).toISOString() : null
    this.paused = { until }
    this.children.stopAll()
    if (minutes) this.resumes = setTimeout(() => this.resume(), minutes * 60_000)
    this.send({ t: 'paused', until })
    this.said(minutes ? `Paused for ${minutes} minutes.` : 'Paused until resumed.')
    this.options.moved?.()
  }

  resume(): void {
    if (this.resumes) clearTimeout(this.resumes)
    this.resumes = null
    if (!this.paused) return
    this.paused = null
    this.send({ t: 'resumed' })
    this.said('Resumed.')
    this.options.moved?.()
  }

  // Signed out by its person: Alpha removes the computer; the key and the list are forgotten by
  // whoever runs this (serve.ts).
  signOut(): Promise<void> {
    return new Promise((done) => {
      const s = this.socket
      if (s?.readyState !== 1) {
        this.stop()
        done()
        return
      }
      s.addEventListener('close', () => done())
      this.send({ t: 'signout' })
      setTimeout(() => {
        this.stop()
        done()
      }, 3000)
    })
  }

  private said(words: string): void {
    this.options.said?.(words)
  }

  private send(m: Record<string, unknown>): void {
    if (this.socket?.readyState === 1) this.socket.send(JSON.stringify(m))
  }

  private connect(): void {
    if (this.stopped) return
    const c = this.options.config()
    const url = new URL('/ws/bridge', c.alpha)
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
    const Socket = this.options.WebSocket ?? globalThis.WebSocket
    const socket = new Socket(url)
    this.socket = socket
    socket.addEventListener('message', (e) => this.heard(String(e.data)))
    socket.addEventListener('close', (e) => {
      if (this.socket !== socket) return
      this.socket = null
      const was = this.online
      this.online = false
      this.children.stopAll()
      this.options.moved?.()
      if (this.stopped) return
      if (e.code === 4403) {
        this.turnedAway = e.reason || 'Alpha turned this computer away.'
        this.said(`${this.turnedAway} Pair it again to go on.`)
        this.stopped = true
        this.options.moved?.()
        return
      }
      if (was) this.said(`Lost ${new URL(c.alpha).host}; trying again.`)
      this.timer = setTimeout(() => this.connect(), this.pause)
      this.pause = Math.min(this.pause * 2, 30_000)
    })
    socket.addEventListener('error', () => undefined)
  }

  private heard(text: string): void {
    let m: FromAlpha
    try {
      m = JSON.parse(text) as FromAlpha
    } catch {
      return
    }
    const c = this.options.config()
    // paused here: what Alpha asks to run is refused, whatever it is
    if (this.paused && (m.t === 'start' || m.t === 'line')) this.refuse(m)
    else if (m.t === 'challenge') this.hello(c, m.challenge)
    else if (m.t === 'welcome') {
      this.online = true
      this.turnedAway = null
      this.pause = 1000
      // a fresh start: what ran for the last connection stops
      this.children.stopAll()
      this.said(`Connected to ${new URL(c.alpha).host} as ${m.name}.`)
      this.alphaLends = m.lent
      this.reconcile()
      if (this.paused) this.send({ t: 'paused', until: this.paused.until })
      this.options.moved?.()
    } else if (m.t === 'lent') this.alphaLends = m.lent
    else if (m.t === 'refused') this.said(`Alpha said: ${m.why}`)
    else if (m.t === 'start') void this.children.open(m.connector)
    else if (m.t === 'line') this.children.down(m.connector, m.line)
    else if (m.t === 'stop') this.children.stop(m.connector)
    else if (m.t === 'pick') {
      this.said('Alpha asked to lend a folder from this computer.')
      this.options.pick?.(m.connector)
    }
  }

  // A call while paused: refused here, as Alpha would be told by a computer that is away.
  private refuse(m: { t: 'start' | 'line'; connector: string; line?: string }): void {
    const why = 'This computer is paused by its person.'
    if (m.t === 'start') {
      this.send({ t: 'line', connector: m.connector, line: JSON.stringify({ t: 'failed', why }) })
      return
    }
    let line: { t?: string; id?: unknown }
    try {
      line = JSON.parse(m.line ?? '')
    } catch {
      return
    }
    if (line.t === 'req')
      this.send({
        t: 'line',
        connector: m.connector,
        line: JSON.stringify({ t: 'res', id: line.id, error: { message: why, kind: 'away' } }),
      })
    else this.children.down(m.connector, m.line ?? '')
  }

  // Alpha's challenge, signed with this computer's own key.
  private hello(c: Config, challenge: string): void {
    const pem = this.options.keys.get(keyAccount(c.alpha))
    if (!pem) {
      this.said('This computer’s key is not here any more. Pair it again.')
      this.stop()
      return
    }
    const signature = sign(null, Buffer.from(challenge), createPrivateKey(pem)).toString('base64')
    this.send({ t: 'hello', computer: c.computer, signature, version: VERSION })
  }

  // Alpha told what this computer lends, and what it no longer does.
  private reconcile(): void {
    const mine = this.options.config().lends
    const key = (l: Lend) => `${l.connector}\n${l.account}`
    const theirs = new Set(this.alphaLends.map(key))
    const ours = new Set(mine.map(key))
    for (const l of mine)
      if (!theirs.has(key(l))) {
        this.send({ t: 'lend', connector: l.connector, account: l.account })
        this.said(`Lending ${l.account}.`)
      }
    for (const l of this.alphaLends)
      if (!ours.has(key(l))) {
        this.send({ t: 'unlend', connector: l.connector, account: l.account })
        this.said(`No longer lending ${l.account}.`)
      }
  }
}
