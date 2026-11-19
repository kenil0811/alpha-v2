// A person's computers as the connector service holds them (the Bridge): what a computer lends
// becomes a connection that runs there and is theirs; a call or a read through it acts only as its
// person (docs/rules.md, B1); one whose computer is away or paused waits, said on its tile.
import type { BrowserEngine, Connector } from '@alpha/connector-sdk'
import { bridges, type Hands } from '../bridge/hub.ts'
import type { Computer } from '../world/computers.ts'
import type { Connection } from '../world/connections.ts'
import { Refused } from '../world/kinds.ts'
import type { World } from '../world/world.ts'
import { landIn } from './places.ts'
import type { ConnectorService } from './service.ts'

// What a person's computer lends: a connection that runs there and is theirs, checked there and
// read. The computer said it; Alpha never names a folder on a computer (docs/rules.md, B2).
export async function lend(
  service: ConnectorService,
  world: World,
  pc: Computer,
  name: string,
  account: string,
): Promise<Connection> {
  const c = service.find(name)
  if (!c || (c.manifest.runs ?? 'server') === 'server')
    throw new Refused(`${c?.manifest.title ?? name} does not run on a person's computer.`)
  const known = world.connections.find(name, account)
  if (known && known.computer !== pc.id) {
    // the same person's computer that no longer lends it (paired again, or the old pairing of
    // this one): it follows the computer lending it now; anyone else's, or one still connected
    // and lending it, keeps it
    const other = known.computer ? world.computers.get(known.computer) : undefined
    const theirs = !!other && other.user === pc.user
    if (!theirs || (other && !other.removedAt && bridges.online(other.id)))
      throw new Refused(`This Alpha has ${account} from somewhere else already.`)
    world.connections.runOn(known.id, pc.id)
  }
  const conn = world.connections.add(name, account, null, c.manifest.title, {
    actor: { kind: 'person', id: pc.user },
    user: pc.user,
  })
  world.connections.runOn(conn.id, pc.id)
  landIn(world, c)
  return service.checkNow(conn.id)
}

// What a computer no longer lends, or what a removed computer lent: paused, kept for the record.
export function unlend(world: World, pc: Computer, conn: Connection, words: string): void {
  if (conn.computer !== pc.id || conn.state === 'paused') return
  world.connections.setState(conn.id, 'paused', words, words, {
    actor: { kind: 'person', id: pc.user },
    user: pc.user,
  })
}

// A connection whose computer is away: no failure and no card, only its tile saying it waits; one
// paused meanwhile (its computer removed) stays paused.
export function waits(world: World, c: Connector, was: Connection): void {
  const conn = world.connections.get(was.id)
  if (!conn || conn.state === 'paused') return
  const name = (conn.computer && world.computers.get(conn.computer)?.name) || 'its computer'
  // paused there by its person, or not connected
  const paused = !!conn.computer && !!bridges.pausedOf(conn.computer)
  world.connections.setState(
    conn.id,
    conn.state === 'broken' ? 'connected' : conn.state,
    paused ? `Paused on ${name}` : `Waiting for ${name}`,
    paused
      ? `${c.manifest.title} for ${conn.account} is paused on ${name}.`
      : `${c.manifest.title} for ${conn.account} waits for ${name}.`,
    { actor: { kind: 'connector', id: c.manifest.name } },
  )
}

// A connection on a person's computer answers only that person: never the firm (asker none) or
// anyone else (docs/rules.md, B1).
export function onlyItsPerson(world: World, conn: Connection, asker: string | null): void {
  const pc = conn.computer ? world.computers.get(conn.computer) : undefined
  if (pc && pc.user !== asker)
    throw new Refused(`That connection runs on ${pc.name}, which acts only for its own person.`)
}

// The person's computer a connector tool's call would run on, by the connection it picks; none
// when it runs here, or when no connection fits (the call itself says so).
export function computerFor(
  service: ConnectorService,
  world: World,
  toolName: string,
  input: Record<string, unknown>,
): Computer | null {
  const t = service.toolOf(toolName)
  if (!t) return null
  try {
    const account = typeof input.account === 'string' ? input.account : undefined
    const conn = service.connectionFor(t.c, account)
    return conn.computer ? (world.computers.get(conn.computer) ?? null) : null
  } catch {
    return null
  }
}

// The hub's hands in a core: a computer's lend, unlend and sign out made through the world and
// the connector service, and the window told.
export function handsFor(
  service: ConnectorService,
  world: World,
  notify: () => void,
  browser?: () => BrowserEngine, // the core's browser: a site signed in to on a computer is its
): Hands {
  // a site signed in to on a computer, for its own person only (rules B1)
  const site = (pc: Computer, account: string, on: boolean) => {
    const mine = browser?.().as(pc.user)
    if (!mine) throw new Refused('This Alpha has no browser to work on sites with.')
    if (on) mine.markOnComputer(account, pc.id)
    else void mine.offComputer(account, pc.id)
    notify()
  }
  return {
    notify,
    lend: async (pc, name, account) =>
      name === 'browser' ? site(pc, account, true) : lend(service, world, pc, name, account),
    unlend: (pc, name, account) => {
      if (name === 'browser') return site(pc, account, false)
      const k = world.connections.find(name, account)
      if (k) unlend(world, pc, k, `${pc.name} no longer lends it.`)
    },
    // the readers that come with a plugin switched on here, for the Bridge to offer (rules P1)
    offers: () =>
      service
        .known()
        .filter((c) => c.manifest.plugin && c.manifest.runs === 'computer')
        .map((c) => c.manifest.name),
    sitesOn: (pc) =>
      (browser?.().as(pc.user).sites() ?? [])
        .filter((s) => s.computer === pc.id)
        .map((s) => s.site),
    // signed out on the computer: removed, as from Your computers, and what it lent paused
    signedOut: (pc) => {
      if (world.computers.get(pc.id)?.removedAt) return
      world.computers.remove(pc.id, { actor: { kind: 'person', id: pc.user }, user: pc.user })
      for (const k of world.connections.on(pc.id))
        unlend(world, pc, k, `${pc.name} signed out, so this is not read any more.`)
      notify()
    },
    // back again: each of its connections still saying it waits is read now, so its words go
    back: (pc) => {
      for (const k of world.connections.on(pc.id))
        if (k.state !== 'paused' && k.health) void service.sync(k.id).then(notify, notify)
    },
  }
}
