// Connectors in the core: the loaded connectors, their connections in the world, the
// Host each connection gets, its syncs, and its tools served to the desk a few at a time through
// tool search, one MCP server per connector. Every tool's effect goes to the gates before it
// runs. The core names no connector: each describes itself in its manifest, and the service
// answers for the set it was given.
import { createHash } from 'node:crypto'
import {
  type BrowserEngine,
  type Call,
  type CallOptions,
  type Connector,
  checkConnector,
  type Effect,
  type Fixtures,
  type Host,
  judgeHealth,
  makeCall,
  Problem,
  type SecretStore,
  type Tool,
} from '@alpha/connector-sdk'
import { bridges } from '../bridge/hub.ts'
import { config } from '../config.ts'
import { Registry, type ToolEntry } from '../engine/registry.ts'
import { takeIn } from '../files/documents.ts'
import { type Connection, ownerOf } from '../world/connections.ts'
import { Refused } from '../world/kinds.ts'
import type { World } from '../world/world.ts'
import { waits } from './computers.ts'
import { neverList } from './never.ts'
import { landIn, tableOf } from './places.ts'
import { type CallSays, isRemote, undoSaid } from './process.ts'
import { readThrough } from './reads.ts'
import { rulesFor } from './rules.ts'
import { describeConnections, entriesOf } from './served.ts'
import type { SignIn } from './signin.ts'
import { count, readLine, type Tally, tallyWords, totals } from './tally.ts'

export interface ServiceOptions {
  secrets: SecretStore
  fixtures?: string // a directory of recorded answers, one folder per connector: never a real account
  browser?: () => BrowserEngine // the human-pace browser, for a site the person signs in to
  known?: Connector[] // the loaded set (discover.ts); none when not given
  signIn?: SignIn // signing in as the person
  // this core is a server: a connector that runs on a person's computer (runs: computer or
  // either) runs only there, through the Bridge, never on the server itself
  server?: boolean
  // a plugin's computer reader is read on the clock only while its person keeps learning (23 Nov)
  keepsReading?: (conn: Connection) => boolean
}

import { gateKey, mcpName, splitMcpName } from './names.ts'

export { gateKey, mcpName, type Preview, splitMcpName } from './names.ts'

// A tool's effect for this input: a tool may say it by what it is asked.
const effectOf = (spec: Tool, input: Record<string, unknown>): Effect =>
  typeof spec.effect === 'function' ? spec.effect(input as never) : spec.effect

export class ConnectorService {
  private world: World
  private options: ServiceOptions
  private running = new Map<string, Promise<void>>()
  private readonly set: Connector[] = []
  readonly signIn: SignIn | undefined

  constructor(world: World, options: ServiceOptions) {
    this.world = world
    this.options = options
    this.signIn = options.signIn
    for (const c of options.known ?? []) this.add(c)
  }

  // A connector joins the loaded set (at start, or added from Settings without a restart): the
  // SDK's check first, so a wrong one never gets in.
  add(c: Connector): void {
    const problems = checkConnector(
      c,
      this.set.map((k) => k.manifest.name),
    )
    if (problems.length) throw new Refused(problems.join(' '))
    this.set.push(c)
    if (isRemote(c)) c.remote.process.govern(rulesFor(this.world, (n) => this.find(n)))
  }

  // A connector leaves the loaded set, when nothing is connected through it.
  drop(name: string): Connector {
    const at = this.set.findIndex((k) => k.manifest.name === name)
    if (at < 0) throw new Refused(`Alpha has no connector called ${name}.`)
    if (this.world.connections.list().some((k) => k.connector === name))
      throw new Refused(`${this.set[at]?.manifest.title} is connected: disconnect it first.`)
    const c = this.set.splice(at, 1)[0] as Connector
    // its process ends with the last connector it held
    if (isRemote(c) && !this.set.some((k) => isRemote(k) && k.remote.process === c.remote.process))
      c.remote.process.close()
    return c
  }

  // The loaded connectors, as they describe themselves.
  known(): Connector[] {
    return this.set
  }

  find(name: string): Connector | undefined {
    return this.set.find((k) => k.manifest.name === name)
  }

  connector(name: string): Connector {
    const c = this.find(name)
    if (!c) throw new Refused(`Alpha has no connector called ${name}: it is not loaded.`)
    return c
  }

  // The tool a model-facing name stands for, when it is a connector's.
  toolOf(name: string): { c: Connector; tool: string; spec: Tool } | null {
    const parts = splitMcpName(name)
    if (!parts) return null
    const c = this.set.find((k) => k.manifest.name === parts.connector)
    const spec = c?.tools[parts.tool]
    return c && spec ? { c, tool: parts.tool, spec } : null
  }

  isTool(name: string): boolean {
    return this.toolOf(name) !== null
  }

  private judgements() {
    const l = config.limits()
    return {
      retries: l.connector_retries,
      busyWaitMs: l.connector_busy_wait_seconds * 1000,
      fewerRowsRatio: l.health_fewer_rows_ratio,
      quietDays: l.health_quiet_days,
    }
  }

  private fixtures(c: Connector): Fixtures | undefined {
    return this.options.fixtures
      ? { dir: `${this.options.fixtures}/${c.manifest.name}`, mode: 'replay' }
      : undefined
  }

  // The connections that fill a table: those whose loaded connector reads into it, found by its
  // lasting key, so a renamed table still knows what fills it.
  filling(tableId: string): { conn: Connection; c: Connector }[] {
    return this.world.connections.list().flatMap((conn) => {
      const c = this.find(conn.connector)
      return c?.tables.some((spec) => tableOf(this.world, c, spec.name)?.id === tableId)
        ? [{ conn, c }]
        : []
    })
  }

  host(c: Connector, conn: Connection): Host {
    const actor = { kind: 'connector' as const, id: c.manifest.name }
    const world = this.world
    return {
      account: conn.account,
      // read fresh: the sign-in that names it may come after this host was made
      get place() {
        return world.connections.get(conn.id)?.place ?? null
      },
      // signed in as the person: a short-lived token, renewed by the core
      secret: async () => {
        if (c.manifest.auth !== 'oauth')
          return conn.secretRef ? this.options.secrets.get(conn.secretRef) : null
        if (!this.signIn) throw new Problem('Signing in is not set up in this core.')
        return this.signIn.token(conn, c)
      },
      cursor: () => this.world.connections.get(conn.id)?.cursor ?? null,
      setCursor: (cursor) => this.world.connections.setCursor(conn.id, cursor),
      land: (tableName, items, options) => {
        const t = tableOf(this.world, c, tableName)
        if (!t) throw new Problem(`The table ${tableName} is not there.`)
        const out = this.world.records.land(
          t.id,
          items,
          { connector: c.manifest.name, account: conn.account },
          { actor },
          options,
        )
        const skipped = items.length - out.added - out.changed - out.same
        this.count(conn.id, t.id, t.name, { ...out, read: items.length, skipped })
        return out
      },
      gone: (tableName, keys, options) => {
        const t = tableOf(this.world, c, tableName)
        if (!t) throw new Problem(`The table ${tableName} is not there.`)
        const itemKeys = this.world.records.itemKeys(t.id)
        const by = options?.by
        return this.world.records.gone(
          t.id,
          by
            ? this.world.records.idsWhere(t.id, by, keys).flatMap((id) => itemKeys.get(id) ?? [])
            : keys,
          { connector: c.manifest.name, account: conn.account },
          { actor },
        )
      },
      // the browser as the connection's owner: their profile for its site
      ...(this.options.browser
        ? { browser: () => (this.options.browser as () => BrowserEngine)().as(ownerOf(conn)) }
        : {}),
      keys: (tableName) => {
        const t = tableOf(this.world, c, tableName)
        return t ? this.world.records.keys(t.id) : []
      },
      keepFile: (name, bytes, mime) => {
        const known = this.world.files.file(hashOf(bytes))
        takeIn(this.world, bytes, name, mime, { actor })
        this.count(conn.id, 'files', 'Files', { read: 1, ...(known ? { same: 1 } : { added: 1 }) })
        return { isNew: !known }
      },
      journal: (words, data) => {
        this.world.line({
          actor,
          kind: 'connector_call',
          words,
          data: { ...(data ?? {}), connection: conn.id },
        })
      },
      // counted for the read under way, and said on the connection when it ends (rules N1)
      leftOut: (table, n) => {
        const t = table === 'files' ? null : tableOf(this.world, c, table)
        this.count(conn.id, t?.id ?? table, t?.name ?? 'Files', { read: n, leftOut: n })
      },
    }
  }

  // What each read under way brought, by its connection (tally.ts): live in What Alpha read while
  // it runs, then kept on its journal line.
  private tallies = new Map<string, Tally>()
  private count(id: string, table: string, name: string, c: Parameters<typeof count>[3]) {
    count(this.tallies.get(id) ?? this.tallies.set(id, {}).get(id) ?? {}, table, name, c)
  }
  tallyOf = (id: string): Tally | null =>
    this.running.has(id) ? (this.tallies.get(id) ?? {}) : null

  // A tool's call, by its effect: one that changes something is never tried again when its fate
  // is unknown; a read keeps its retries.
  call(c: Connector, conn: Connection, effect: Effect = 'read'): Call {
    const fixtures = this.fixtures(c)
    const options: CallOptions = {
      judgements: this.judgements(),
      ...(fixtures ? { fixtures } : {}),
      ...(effect !== 'read' ? { once: true } : {}),
      // what Alpha never keeps, left out as it reads, wherever it runs (rules N1)
      never: neverList(),
    }
    // a connector in its own process paces and retries there, by the same options
    // the computer it runs on, when a person's computer runs it (the Bridge)
    return Object.assign(makeCall(c.manifest, this.host(c, conn), options), {
      options,
      computer: conn.computer,
    })
  }

  // What a call of a connector's tool is, by the tool's model-facing name, before the gates: its
  // effect, what a card shows and the step's words in Activity (its own, or "Reached Gmail"). A
  // connector in its own process is asked; one in the core answers here.
  async says(name: string, input: Record<string, unknown>): Promise<CallSays | undefined> {
    const t = this.toolOf(name)
    if (!t) return undefined
    const says = isRemote(t.c)
      ? await t.c.remote.says(t.tool, input)
      : {
          effect: effectOf(t.spec, input),
          preview: t.spec.preview ? t.spec.preview(input as never) : null,
          words: t.spec.words ? t.spec.words(input as never) : null,
          undo: undoSaid(effectOf(t.spec, input), t.spec.undo),
        }
    return { ...says, words: says.words ?? `Reached ${t.c.manifest.title}` }
  }

  // The connectors' own processes, ended (a core that stops, a test that ends).
  close(): void {
    for (const c of this.set) if (isRemote(c)) c.remote.process.close()
  }

  // Whether a connector runs only on a person's computer here: lent from the Bridge there, never
  // connected in Alpha's own form.
  onComputer(c: Connector): boolean {
    const runs = c.manifest.runs ?? 'server'
    return runs === 'computer' || (runs === 'either' && !!this.options.server)
  }

  // The person's own act in Alpha's form: the sign-in gate is answered by doing it.
  async connect(
    name: string,
    account: string,
    secret: string | null,
    user: string,
  ): Promise<Connection> {
    const c = this.connector(name)
    if (this.onComputer(c))
      throw new Refused(
        `${c.manifest.title} runs on your own computer: lend it from the Bridge there (Connections › Your computers).`,
      )
    if (c.manifest.auth === 'secret' && !secret?.trim())
      throw new Refused(`${c.manifest.title} needs its ${c.manifest.secret?.label ?? 'password'}.`)
    const ref = refOf(c, account)
    if (ref && secret && c.manifest.auth === 'secret')
      await this.options.secrets.set(ref, secret.trim())
    const conn = this.world.connections.add(name, account, ref, c.manifest.title, {
      actor: { kind: 'person', id: user },
      user,
    })
    // signed in as the person: connected once they sign in, in their own browser
    if (c.manifest.auth === 'oauth') {
      this.signIn?.forget(conn.id)
      this.failed(conn.id, new Problem('Sign in to finish connecting.', 'sign_in'))
      return this.world.connections.get(conn.id) as Connection
    }
    try {
      await c.check?.(this.call(c, conn))
    } catch (err) {
      this.fail(c, conn, err)
      // a site the person signs in to is connected waiting on their sign-in, in Chrome; one
      // waiting on the customer's own step is kept, waiting
      if (
        err instanceof Problem &&
        ((c.manifest.auth === 'browser' && err.kind === 'sign_in') || err.kind === 'waiting')
      ) {
        landIn(this.world, c)
        return this.world.connections.get(conn.id) as Connection
      }
      throw err instanceof Problem ? new Refused(err.message) : err
    }
    landIn(this.world, c)
    void this.sync(conn.id)
    return this.world.connections.get(conn.id) as Connection
  }

  // A connection checked now (back from signing in, or Try again): connected when its check holds,
  // and read; else in the state its failure says.
  async checkNow(id: string): Promise<Connection> {
    const conn = this.world.connections.get(id)
    if (!conn) throw new Refused('That connection is not there.')
    const c = this.connector(conn.connector)
    try {
      await c.check?.(this.call(c, conn))
    } catch (err) {
      if (err instanceof Problem && err.kind === 'away') waits(this.world, c, conn)
      else this.fail(c, conn, err)
      return this.world.connections.get(id) as Connection
    }
    // paused while it was checked (its computer removed): it stays paused
    if (this.world.connections.get(id)?.state === 'paused')
      return this.world.connections.get(id) as Connection
    if (conn.state !== 'connected')
      this.world.connections.setState(
        id,
        'connected',
        null,
        `${c.manifest.title} for ${conn.account} is connected.`,
        { actor: { kind: 'connector', id: c.manifest.name } },
      )
    landIn(this.world, c)
    if (c.sync) void this.sync(id)
    return this.world.connections.get(id) as Connection
  }

  // A connection's state from a failure found outside a call (a sign-in that came back with no).
  failed(id: string, err: unknown): void {
    const conn = this.world.connections.get(id)
    if (conn) this.fail(this.connector(conn.connector), conn, err)
  }

  // Disconnect: the kept sign-in or password goes and reads stop, the connection stays, paused and
  // saying so, until the person reconnects it (paused, so Home asks for no sign-in).
  async signOut(id: string, user: string): Promise<void> {
    const conn = this.world.connections.get(id)
    if (!conn) throw new Refused('That connection is not there.')
    if (conn.secretRef) await this.options.secrets.delete(conn.secretRef)
    this.signIn?.forget(id)
    const title = this.find(conn.connector)?.manifest.title ?? conn.connector
    this.world.connections.setState(
      id,
      'paused',
      SIGNED_OUT,
      `Disconnected ${title} for ${conn.account}.`,
      {
        actor: { kind: 'person', id: user },
        user,
      },
    )
  }

  // An account brought back from Excluded: there again, disconnected, ready to sign in again.
  async restore(name: string, account: string, user: string): Promise<Connection> {
    const c = this.connector(name)
    const conn = this.world.connections.add(name, account, refOf(c, account), c.manifest.title, {
      actor: { kind: 'person', id: user },
      user,
    })
    await this.signOut(conn.id, user)
    return this.world.connections.get(conn.id) as Connection
  }

  async disconnect(id: string, user: string): Promise<void> {
    const conn = this.world.connections.get(id)
    if (!conn) throw new Refused('That connection is not there.')
    if (conn.secretRef) await this.options.secrets.delete(conn.secretRef)
    this.signIn?.forget(id)
    this.world.connections.remove(id, this.find(conn.connector)?.manifest.title ?? conn.connector, {
      actor: { kind: 'person', id: user },
      user,
    })
  }

  // The connections being read right now, for Home's Running list (a read shows in Activity
  // only once it ends, and a long one would look like nothing happening).
  reading(): { connection: string; title: string; account: string }[] {
    return [...this.running.keys()].flatMap((id) => {
      const conn = this.world.connections.get(id)
      return conn
        ? [
            {
              connection: id,
              title: this.find(conn.connector)?.manifest.title ?? conn.connector,
              account: conn.account,
            },
          ]
        : []
    })
  }

  // One sync of one connection at a time: a second ask waits for the one running.
  sync(id: string): Promise<void> {
    const running = this.running.get(id)
    if (running) return running
    const p = this.syncOnce(id).finally(() => this.running.delete(id))
    this.running.set(id, p)
    return p
  }

  private async syncOnce(id: string): Promise<void> {
    const conn = this.world.connections.get(id)
    if (!conn || conn.state === 'paused') return
    const c = this.find(conn.connector)
    if (!c?.sync) return
    // on a person's computer that is not connected now: it waits, said once on its tile, and the
    // first read after the computer is back takes everything since (its cursor keeps the rest)
    if (conn.computer && (!bridges.online(conn.computer) || bridges.pausedOf(conn.computer)))
      return waits(this.world, c, conn)
    // waiting for the customer: Try again checks once more, and reads only once that is done
    if (conn.state === 'waiting') {
      try {
        await c.check?.(this.call(c, conn))
      } catch (err) {
        this.fail(c, conn, err)
        return
      }
    }
    const started = Date.now()
    // each read is a line for Activity: how long it took and whether it brought anything
    const read = (state: 'ok' | 'failed', words: string, quiet: boolean) =>
      readLine(this.world, c.manifest.name, c.manifest.title, conn, {
        ms: Date.now() - started,
        state,
        quiet,
        words,
        tally: this.tallies.get(id) ?? {},
      })
    this.tallies.set(id, {})
    try {
      landIn(this.world, c)
      const result = await c.sync(this.call(c, conn))
      const tally = this.tallies.get(id) ?? {}
      const { leftOut, skipped } = totals(tally)
      const health = judgeHealth(
        { rows: conn.lastRows, lastNewAt: conn.lastNewAt },
        result,
        this.judgements(),
      )
      if (conn.state !== 'connected')
        this.world.connections.setState(
          id,
          'connected',
          null,
          `${c.manifest.title} for ${conn.account} works again.`,
          { actor: { kind: 'connector', id: c.manifest.name } },
        )
      this.world.connections.synced(
        id,
        result.rows,
        result.sawNew,
        health,
        { actor: { kind: 'connector', id: c.manifest.name } },
        leftOut,
      )
      // a read that left something out or passed something over is never folded away
      read('ok', tallyWords(conn.account, tally), !result.sawNew && !leftOut && !skipped)
    } catch (err) {
      if (err instanceof Problem && err.kind === 'away') return waits(this.world, c, conn)
      this.tried.set(id, Date.now())
      this.fail(c, conn, err)
      read(
        'failed',
        `Could not read ${conn.account}: ${err instanceof Error ? err.message : String(err)}`,
        false,
      )
    }
  }

  // What is due, by each connector's own rhythm. A read that failed waits before its next try
  // (its own rhythm, or half an hour, whichever is shorter), not the next minute's tick.
  private tried = new Map<string, number>()
  async syncDue(now = Date.now()): Promise<void> {
    for (const conn of this.world.connections.list()) {
      const m = this.find(conn.connector)?.manifest
      const every = m?.syncEveryMinutes
      if (!every || ['paused', 'needs_sign_in', 'waiting'].includes(conn.state)) continue
      // a plugin's computer reader: only while its person keeps learning
      if (m?.plugin && m.runs === 'computer' && !this.options.keepsReading?.(conn)) continue
      const last = conn.lastSyncAt ? Date.parse(conn.lastSyncAt) : 0
      const tried = this.tried.get(conn.id) ?? 0
      const again = Math.min(every, 30) * 60_000
      if (now - last >= every * 60_000 && now - tried >= again) await this.sync(conn.id)
    }
  }

  private fail(c: Connector, conn: Connection, err: unknown): void {
    const words = err instanceof Error ? err.message : String(err)
    const signIn = err instanceof Problem && err.kind === 'sign_in'
    // a step only the customer can do: waited on, not retried
    const waiting = err instanceof Problem && err.kind === 'waiting'
    this.world.connections.setState(
      conn.id,
      signIn ? 'needs_sign_in' : waiting ? 'waiting' : 'broken',
      words,
      `${c.manifest.title} for ${conn.account}: ${words}`,
      { actor: { kind: 'connector', id: c.manifest.name } },
    )
  }

  // The person's mail: the connected connector that sends (a draft goes from it when none is
  // named). None when nothing connected sends.
  mailer(): string | undefined {
    const connected = this.world.connections.list().filter((k) => k.state === 'connected')
    return this.set.find(
      (c) => c.tools.send && connected.some((k) => k.connector === c.manifest.name),
    )?.manifest.name
  }

  // Which connection a tool call is for: the one account, or the one named.
  connectionFor(c: Connector, account?: string): Connection {
    const conns = this.world.connections.list().filter((k) => k.connector === c.manifest.name)
    const conn = account
      ? conns.find((k) => k.account.toLowerCase() === account.toLowerCase())
      : conns[0]
    if (!conn)
      throw new Refused(
        `${c.manifest.title} is not connected: the person connects it in Settings › Connections.`,
      )
    if (!account && conns.length > 1)
      throw new Refused(
        `${c.manifest.title} is connected for ${conns.map((k) => k.account).join(' and ')}: say which account.`,
      )
    return conn
  }

  // One of a connector's reads through one connection, for a module's script (reads.ts), asked as
  // the person the run is for, or the firm (none).
  readThrough(
    id: string,
    read: string,
    input: Record<string, unknown>,
    asker: string | null = null,
  ): Promise<unknown> {
    return readThrough(this, this.world, id, read, input, asker)
  }

  // A connector's tool run by the core itself, on the person's yes already given (a schedule's draft
  // sent from its card): the gate is behind it, so it runs as asked. No connector named: the
  // person's mail, whichever connected connector sends.
  async runTool(
    connector: string | null,
    name: string,
    input: Record<string, unknown>,
  ): Promise<unknown> {
    const named = connector ?? this.mailer()
    if (!named)
      throw new Refused(
        'Nothing connected sends mail: the person connects their mail in Settings › Connections.',
      )
    const c = this.connector(named)
    const spec = c.tools[name]
    if (!spec) throw new Refused(`${c.manifest.title} has no ${name}.`)
    const effect = (await this.says(mcpName(c.manifest.name, name), input))?.effect ?? 'outward'
    return spec.run(this.call(c, this.connectionFor(c), effect), input as never)
  }

  // The gate's key for a tool, by its model-facing name.
  keyOf(name: string): string | undefined {
    const t = this.toolOf(name)
    return t ? gateKey(t.c.manifest.name, t.tool) : undefined
  }

  // What a rule calls the tool (gmail.send; a rule through gmail covers all of Gmail's), as an
  // schedule's draft names its send: never the gate's key, which a rule's words never hold.
  ruleName(name: string): string | undefined {
    const t = this.toolOf(name)
    return t ? `${t.c.manifest.name}.${t.tool}` : undefined
  }

  // Every loaded connector's tools, always, so the desk's tools never change when an account is
  // connected (a session is resumed only with the same tools). They load through tool search.
  toolNames(): string[] {
    return this.set
      .flatMap((c) => Object.keys(c.tools).map((t) => mcpName(c.manifest.name, t)))
      .sort()
  }

  // Every connector's tools as entries of the tool registry: served.ts.
  entries(): ToolEntry[] {
    return entriesOf(this)
  }

  // One MCP server per connector, named after it, from the same entries.
  servers() {
    return new Registry(this.entries()).servers()
  }

  // What the start layer says about connections: served.ts.
  describe(): string {
    return describeConnections(this, this.world)
  }
}

// The same bytes are the same file.
function hashOf(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex')
}

// What a disconnected connection says: reconnecting it is the person's.
export const SIGNED_OUT = 'Disconnected: reconnect to read it again.'

// Where a connection's secret or sign-in is kept, for a connector that keeps one.
const refOf = (c: Connector, account: string): string | null =>
  ['secret', 'oauth'].includes(c.manifest.auth)
    ? `${c.manifest.name}:${account.trim().toLowerCase()}`
    : null
