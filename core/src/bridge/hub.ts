// The Bridge's door in the core: each paired computer connected now, the connector processes it
// runs for the core, and what it lends. A computer connects outward to its Alpha over one
// websocket and proves itself by signing a fresh challenge with its own key; nothing on the
// computer listens. What it lends (a folder, first) is said by the computer and becomes a
// connection that runs there; the core never names a folder for it (docs/rules.md, B2).
import { randomBytes, randomUUID } from 'node:crypto'
import type { Computer } from '../world/computers.ts'
import type { World } from '../world/world.ts'
import { awayWords, BridgedProcess, type Link, pausedWords } from './process.ts'

// The words a computer and the core say to each other, one JSON object a message.
export type FromComputer =
  | { t: 'hello'; computer: string; signature: string; version: string; browser?: boolean }
  | { t: 'line'; connector: string; line: string }
  | { t: 'ended'; connector: string; why: string }
  | { t: 'lend'; connector: string; account: string }
  | { t: 'unlend'; connector: string; account: string }
  | { t: 'paused'; until: string | null } // paused by its person, for an hour or until resumed
  | { t: 'resumed' }
  | { t: 'signout' } // its person signed out of it: removed, as from Your computers
  | { t: 'browser'; on: boolean } // its Browser switch
  | { t: 'site'; id: string; done: boolean; why?: string } // a sign-in window there, closed
  | { t: 'cdp'; id: string; m: string } // a site's Chrome there, speaking
  | { t: 'cdp-closed'; id: string; why: string | null }

// A site's Chrome on a computer, as the core speaks to it (cdp.ts carries it to Playwright).
export interface SitePipe {
  send(message: string): void
  close(): void
}

export interface Socket {
  send(text: string): void
  close(code?: number, reason?: string): void
}

interface Connected {
  computer: Computer
  version: string // the Bridge it runs, as it said in its hello
  socket: Socket
  processes: Map<string, BridgedProcess>
  paused: { until: string | null } | null
  browser: boolean // its Browser switch is on
  pipes: Map<string, { heard(m: string): void; closed(why: string | null): void }>
  signIns: Map<string, { done(): void; failed(why: string): void }>
}

// What the hub needs of the core: the window told of a computer coming or going, and what a
// computer lends or stops lending, made connections by the connector service.
export interface Hands {
  notify(): void
  lend(pc: Computer, connector: string, account: string): Promise<unknown>
  unlend(pc: Computer, connector: string, account: string): void
  signedOut(pc: Computer): void
  back(pc: Computer): void // connected again: what waited for it is read now
  sitesOn(pc: Computer): string[] // the sites signed in to there for Alpha
}

const NONE: Hands = {
  notify: () => undefined,
  lend: async () => {
    throw new Error('Nothing can be lent to this core.')
  },
  unlend: () => undefined,
  signedOut: () => undefined,
  back: () => undefined,
  sitesOn: () => [],
}

export class Hub {
  private world: World | null = null
  private connected = new Map<string, Connected>()
  private hands: Hands = NONE

  // The world its computers are paired in, and the core's hands.
  use(world: World, hands: Hands): void {
    this.world = world
    this.hands = hands
  }

  online(computer: string): boolean {
    return this.connected.has(computer)
  }

  // Whether its Browser switch is on, while it is connected.
  browserOn(computer: string): boolean {
    return this.connected.get(computer)?.browser === true
  }

  // Signing in to a site on a computer: its window opens there, and this ends when its person
  // closes it (the site then lent), or says why it did not.
  signInSite(computer: string, site: string, url: string): Promise<void> {
    const c = this.connected.get(computer)
    if (!c) return Promise.reject(new Error(awayWords(this.nameOf(computer))))
    const id = `${randomUUID()}/${site}`
    return new Promise((done, failed) => {
      c.signIns.set(id, { done, failed: (why) => failed(new Error(why)) })
      c.socket.send(JSON.stringify({ t: 'site-sign-in', id, site, url }))
    })
  }

  // Signed out of a site there: its profile on the computer goes.
  signOutSite(computer: string, site: string): void {
    this.connected.get(computer)?.socket.send(JSON.stringify({ t: 'site-sign-out', site }))
  }

  // A signed-in site's Chrome on a computer, driven out of sight: what it says goes to heard, and
  // closed says why it stopped. Null when the computer is not connected.
  pipe(
    computer: string,
    site: string,
    heard: (message: string) => void,
    closed: (why: string | null) => void,
  ): SitePipe | null {
    const c = this.connected.get(computer)
    if (!c) return null
    const id = `${randomUUID()}/${site}`
    c.pipes.set(id, { heard, closed })
    c.socket.send(JSON.stringify({ t: 'cdp-open', id, site }))
    return {
      send: (m) => this.connected.get(computer)?.socket.send(JSON.stringify({ t: 'cdp', id, m })),
      close: () => {
        const now = this.connected.get(computer)
        if (!now?.pipes.delete(id)) return
        now.socket.send(JSON.stringify({ t: 'cdp-close', id }))
      },
    }
  }

  private nameOf(computer: string): string {
    return (
      this.connected.get(computer)?.computer.name ??
      this.world?.computers.get(computer)?.name ??
      'The computer'
    )
  }

  // The Bridge a computer runs, while it is connected.
  versionOf(computer: string): string | null {
    return this.connected.get(computer)?.version ?? null
  }

  // Paused by its person on the computer: until when (none: until resumed), or not paused.
  pausedOf(computer: string): { until: string | null } | null {
    const p = this.connected.get(computer)?.paused ?? null
    if (p?.until && Date.parse(p.until) <= Date.now()) return null
    return p
  }

  // Lend a folder, asked from Alpha's window: the computer opens its own picker, and lends only
  // what its person picks there (docs/rules.md, B2). False when it is not connected.
  pick(computer: string, connector: string): boolean {
    const c = this.connected.get(computer)
    if (!c) return false
    c.socket.send(JSON.stringify({ t: 'pick', connector }))
    return true
  }

  // The process a computer runs for a connector: made once, started on its first call; a computer
  // away answers at once that it is.
  processFor(computer: string, connector: string, entry: string): BridgedProcess {
    const c = this.connected.get(computer)
    const name = c?.computer.name ?? this.world?.computers.get(computer)?.name ?? 'The computer'
    const link: Link = {
      name,
      online: () => this.connected.has(computer),
      paused: () => !!this.pausedOf(computer),
      send: (m) => this.connected.get(computer)?.socket.send(JSON.stringify(m)),
    }
    if (!c) return new BridgedProcess(entry, connector, link)
    const known = c.processes.get(connector)
    if (known) return known
    const made = new BridgedProcess(entry, connector, link)
    c.processes.set(connector, made)
    return made
  }

  // A computer's connection, from its first word to its last. It proves who it is by signing the
  // challenge it was sent; until it has, nothing else it says is heard.
  open(socket: Socket): { heard(text: string): void; closed(): void } {
    const challenge = randomBytes(32).toString('base64url')
    socket.send(JSON.stringify({ t: 'challenge', challenge }))
    let me: Connected | null = null
    return {
      heard: (text: string) => {
        let m: FromComputer
        try {
          m = JSON.parse(text) as FromComputer
        } catch {
          return
        }
        if (!me) {
          if (m.t !== 'hello') return socket.close(4401, 'Say hello first.')
          const c = this.world?.computers.proves(m.computer, challenge, m.signature) ?? null
          if (!c) return socket.close(4403, 'This computer is not paired with this Alpha.')
          // one connection a computer: a newer one takes over, and what waited on the older learns
          const older = this.connected.get(c.id)
          if (older) {
            for (const p of older.processes.values()) p.ended(awayWords(c.name))
            older.socket.close(4409, 'This computer connected again.')
          }
          me = {
            computer: c,
            version: m.version,
            socket,
            processes: new Map(),
            paused: null,
            browser: m.browser === true,
            pipes: new Map(),
            signIns: new Map(),
          }
          this.connected.set(c.id, me)
          this.world?.computers.seen(c.id)
          socket.send(JSON.stringify({ t: 'welcome', name: c.name, lent: this.lent(c.id) }))
          this.hands.back(c)
          this.hands.notify()
          return
        }
        this.from(me, m)
      },
      closed: () => {
        if (!me || this.connected.get(me.computer.id) !== me) return
        this.connected.delete(me.computer.id)
        for (const p of me.processes.values()) p.ended(awayWords(me.computer.name))
        for (const p of me.pipes.values()) p.closed(awayWords(me.computer.name))
        for (const s of me.signIns.values()) s.failed(awayWords(me.computer.name))
        this.world?.computers.seen(me.computer.id)
        this.hands.notify()
      },
    }
  }

  // A computer removed by its person is let go at once.
  drop(computer: string): void {
    this.connected.get(computer)?.socket.close(4403, 'This computer was removed.')
  }

  // What a computer lends now, as connections that run on it.
  lent(computer: string): { connector: string; account: string; connection: string }[] {
    const pc = this.world?.computers.get(computer)
    return [
      ...(this.world?.connections.on(computer) ?? [])
        .filter((k) => k.state !== 'paused')
        .map((k) => ({
          connector: k.connector,
          account: k.account,
          connection: k.id,
        })),
      ...(pc ? this.hands.sitesOn(pc) : []).map((site) => ({
        connector: 'browser',
        account: site,
        connection: '',
      })),
    ]
  }

  private from(me: Connected, m: FromComputer): void {
    if (m.t === 'line') {
      me.processes.get(m.connector)?.heard(m.line)
      return
    }
    if (m.t === 'ended') {
      me.processes.get(m.connector)?.ended(m.why, 'other')
      return
    }
    if (m.t === 'cdp') {
      me.pipes.get(m.id)?.heard(m.m)
      return
    }
    if (m.t === 'cdp-closed') {
      const p = me.pipes.get(m.id)
      me.pipes.delete(m.id)
      p?.closed(m.why)
      return
    }
    if (m.t === 'site') {
      const s = me.signIns.get(m.id)
      me.signIns.delete(m.id)
      if (m.done) s?.done()
      else s?.failed(m.why ?? 'The sign-in did not finish.')
      return
    }
    if (m.t === 'browser') {
      me.browser = m.on
      this.hands.notify()
      return
    }
    const say = (r: Record<string, unknown>) => me.socket.send(JSON.stringify(r))
    const lent = () => {
      say({ t: 'lent', lent: this.lent(me.computer.id) })
      this.hands.notify()
    }
    if (m.t === 'paused' || m.t === 'resumed') {
      me.paused = m.t === 'paused' ? { until: m.until } : null
      if (me.paused) for (const p of me.processes.values()) p.ended(pausedWords(me.computer.name))
      this.hands.notify()
    } else if (m.t === 'signout') {
      this.hands.signedOut(me.computer)
      me.socket.close(4403, 'This computer signed out.')
    } else if (m.t === 'lend')
      void this.hands
        .lend(me.computer, m.connector, m.account)
        .then(lent, (err) =>
          say({ t: 'refused', why: err instanceof Error ? err.message : String(err) }),
        )
    else if (m.t === 'unlend') {
      this.hands.unlend(me.computer, m.connector, m.account)
      lent()
    }
  }
}

// The one hub of this core.
export const bridges = new Hub()
