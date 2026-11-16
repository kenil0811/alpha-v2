// The Bridge's door in the core: each paired computer connected now, the connector processes it
// runs for the core, and what it lends. A computer connects outward to its Alpha over one
// websocket and proves itself by signing a fresh challenge with its own key; nothing on the
// computer listens. What it lends (a folder, first) is said by the computer and becomes a
// connection that runs there; the core never names a folder for it (docs/rules.md, B2).
import { randomBytes } from 'node:crypto'
import type { Computer } from '../world/computers.ts'
import type { World } from '../world/world.ts'
import { awayWords, BridgedProcess, type Link } from './process.ts'

// The words a computer and the core say to each other, one JSON object a message.
export type FromComputer =
  | { t: 'hello'; computer: string; signature: string; version: string }
  | { t: 'line'; connector: string; line: string }
  | { t: 'ended'; connector: string; why: string }
  | { t: 'lend'; connector: string; account: string }
  | { t: 'unlend'; connector: string; account: string }

export interface Socket {
  send(text: string): void
  close(code?: number, reason?: string): void
}

interface Connected {
  computer: Computer
  socket: Socket
  processes: Map<string, BridgedProcess>
}

// What the hub needs of the core: the window told of a computer coming or going, and what a
// computer lends or stops lending, made connections by the connector service.
export interface Hands {
  notify(): void
  lend(pc: Computer, connector: string, account: string): Promise<unknown>
  unlend(pc: Computer, connector: string, account: string): void
}

const NONE: Hands = {
  notify: () => undefined,
  lend: async () => {
    throw new Error('Nothing can be lent to this core.')
  },
  unlend: () => undefined,
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

  // The process a computer runs for a connector: made once, started on its first call; a computer
  // away answers at once that it is.
  processFor(computer: string, connector: string, entry: string): BridgedProcess {
    const c = this.connected.get(computer)
    const name = c?.computer.name ?? this.world?.computers.get(computer)?.name ?? 'The computer'
    const link: Link = {
      name,
      online: () => this.connected.has(computer),
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
          me = { computer: c, socket, processes: new Map() }
          this.connected.set(c.id, me)
          this.world?.computers.seen(c.id)
          socket.send(JSON.stringify({ t: 'welcome', name: c.name, lent: this.lent(c.id) }))
          this.hands.notify()
          return
        }
        this.from(me, m)
      },
      closed: () => {
        if (!me || this.connected.get(me.computer.id) !== me) return
        this.connected.delete(me.computer.id)
        for (const p of me.processes.values()) p.ended(awayWords(me.computer.name))
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
    return (this.world?.connections.on(computer) ?? [])
      .filter((k) => k.state !== 'paused')
      .map((k) => ({
        connector: k.connector,
        account: k.account,
        connection: k.id,
      }))
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
    const say = (r: Record<string, unknown>) => me.socket.send(JSON.stringify(r))
    const lent = () => {
      say({ t: 'lent', lent: this.lent(me.computer.id) })
      this.hands.notify()
    }
    if (m.t === 'lend')
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
