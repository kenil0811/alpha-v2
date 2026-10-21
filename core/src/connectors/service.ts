// Connectors in the core (design §8): the known connectors, their connections in the world, the
// Host each connection gets, its syncs, and its tools served to the desk a few at a time through
// tool search. Every tool's effect goes to the gates before it runs.
import { createHash } from 'node:crypto'
import { folder } from '@alpha/connector-files'
import { gmail } from '@alpha/connector-gmail'
import { calendar, contactsConnector } from '@alpha/connector-mac'
import {
  type Call,
  type Connector,
  type Effect,
  type Fixtures,
  type Host,
  type ItemFile,
  judgeHealth,
  makeCall,
  Problem,
  type SecretStore,
} from '@alpha/connector-sdk'
import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk'
import { z } from 'zod'
import { config } from '../config.ts'
import { takeIn } from '../files/documents.ts'
import type { Connection } from '../world/connections.ts'
import { Refused } from '../world/kinds.ts'
import type { Table } from '../world/shape.ts'
import type { World } from '../world/world.ts'

export const KNOWN: Connector[] = [gmail, calendar, contactsConnector, folder]
export const SERVER = 'connectors'

export interface ServiceOptions {
  secrets: SecretStore
  fixtures?: string // a directory of recorded answers, one folder per connector: never a real account
}

export interface Preview {
  words: string
  detail?: string
  yes?: string // the card's yes in its own words (Send it)
}

export function connectorOf(name: string): Connector {
  const c = KNOWN.find((k) => k.manifest.name === name)
  if (!c) throw new Refused(`Alpha has no connector called ${name}.`)
  return c
}

// A connector tool as the model sees it: connector_tool.
export function toolName(c: Connector, t: string): string {
  return `${c.manifest.name}_${t}`
}

export class ConnectorService {
  private world: World
  private options: ServiceOptions
  private running = new Map<string, Promise<void>>()

  constructor(world: World, options: ServiceOptions) {
    this.world = world
    this.options = options
  }

  private judgements() {
    const l = config.limits()
    return {
      retries: l.connector_retries,
      fewerRowsRatio: l.health_fewer_rows_ratio,
      quietDays: l.health_quiet_days,
    }
  }

  private fixtures(c: Connector): Fixtures | undefined {
    return this.options.fixtures
      ? { dir: `${this.options.fixtures}/${c.manifest.name}`, mode: 'replay' }
      : undefined
  }

  // The module and tables a connector's items land in, made when it is first connected, and
  // any field a newer version adds.
  tables(c: Connector): Table[] {
    const actor = { kind: 'connector' as const, id: c.manifest.name }
    if (!c.tables.length) return []
    const module =
      this.world.shape.module(c.module) ?? this.world.shape.makeModule(c.module, { actor })
    return c.tables.map((spec) => {
      const t = this.world.shape.table(spec.name)
      // Alpha's working memory, out of the sidebar until the person shows it (Kenil, 19 Oct).
      if (!t)
        return this.world.shape.makeTable(
          module.id,
          spec.name,
          spec.fields,
          { actor },
          { hidden: true },
        )
      const missing = spec.fields.filter(
        (f) => !t.fields.some((x) => x.name.toLowerCase() === f.name.toLowerCase()),
      )
      return missing.length ? this.world.shape.addFields(t.id, missing, { actor }) : t
    })
  }

  host(c: Connector, conn: Connection): Host {
    const actor = { kind: 'connector' as const, id: c.manifest.name }
    return {
      account: conn.account,
      secret: async () => (conn.secretRef ? this.options.secrets.get(conn.secretRef) : null),
      cursor: () => this.world.connections.get(conn.id)?.cursor ?? null,
      setCursor: (cursor) => this.world.connections.setCursor(conn.id, cursor),
      land: (tableName, items, options) => {
        const t = this.world.shape.table(tableName)
        if (!t) throw new Problem(`The table ${tableName} is not there.`)
        return this.world.records.land(
          t.id,
          items,
          { connector: c.manifest.name, account: conn.account },
          { actor },
          options,
        )
      },
      keepFile: (name, bytes, mime) => {
        const known = this.world.files.file(hashOf(bytes))
        takeIn(this.world, bytes, name, mime, { actor })
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
    }
  }

  call(c: Connector, conn: Connection): Call {
    const fixtures = this.fixtures(c)
    return makeCall(c.manifest, this.host(c, conn), {
      judgements: this.judgements(),
      ...(fixtures ? { fixtures } : {}),
    })
  }

  // The person's own act in Alpha's form: the sign-in gate is answered by doing it (design §7).
  async connect(
    name: string,
    account: string,
    secret: string | null,
    user: string,
  ): Promise<Connection> {
    const c = connectorOf(name)
    if (c.manifest.auth === 'secret' && !secret?.trim())
      throw new Refused(`${c.manifest.title} needs its ${c.manifest.secret?.label ?? 'password'}.`)
    const ref = c.manifest.auth === 'secret' ? `${name}:${account.trim().toLowerCase()}` : null
    if (ref && secret) await this.options.secrets.set(ref, secret.trim())
    const conn = this.world.connections.add(name, account, ref, c.manifest.title, {
      actor: { kind: 'person', id: user },
      user,
    })
    try {
      await c.check?.(this.call(c, conn))
    } catch (err) {
      this.fail(c, conn, err)
      throw err instanceof Problem ? new Refused(err.message) : err
    }
    this.tables(c)
    void this.sync(conn.id)
    return this.world.connections.get(conn.id) as Connection
  }

  async disconnect(id: string, user: string): Promise<void> {
    const conn = this.world.connections.get(id)
    if (!conn) throw new Refused('That connection is not there.')
    if (conn.secretRef) await this.options.secrets.delete(conn.secretRef)
    this.world.connections.remove(id, connectorOf(conn.connector).manifest.title, {
      actor: { kind: 'person', id: user },
      user,
    })
  }

  // One sync of one connection at a time: a second ask waits for the one running. A failure says
  // what the person can do.
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
    const c = connectorOf(conn.connector)
    if (!c.sync) return
    const started = Date.now()
    // each read is a line for Activity: how long it took and whether it brought anything
    const read = (state: 'ok' | 'failed', words: string, quiet: boolean) =>
      this.world.line({
        actor: { kind: 'connector', id: c.manifest.name },
        kind: 'connection_read',
        words,
        data: { connection: id, name: c.manifest.title, ms: Date.now() - started, state, quiet },
      })
    try {
      this.tables(c)
      const result = await c.sync(this.call(c, conn))
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
      this.world.connections.synced(id, result.rows, result.sawNew, health, {
        actor: { kind: 'connector', id: c.manifest.name },
      })
      read(
        'ok',
        result.sawNew
          ? `Read ${conn.account}: something new.`
          : `Read ${conn.account}: nothing new.`,
        !result.sawNew,
      )
    } catch (err) {
      this.fail(c, conn, err)
      read(
        'failed',
        `Could not read ${conn.account}: ${err instanceof Error ? err.message : String(err)}`,
        false,
      )
    }
  }

  // What is due, by each connector's own rhythm.
  async syncDue(now = Date.now()): Promise<void> {
    for (const conn of this.world.connections.list()) {
      const every = connectorOf(conn.connector).manifest.syncEveryMinutes
      if (!every || conn.state === 'paused' || conn.state === 'needs_sign_in') continue
      const last = conn.lastSyncAt ? Date.parse(conn.lastSyncAt) : 0
      if (now - last >= every * 60_000) await this.sync(conn.id)
    }
  }

  private fail(c: Connector, conn: Connection, err: unknown): void {
    const words = err instanceof Error ? err.message : String(err)
    const signIn = err instanceof Problem && err.kind === 'sign_in'
    this.world.connections.setState(
      conn.id,
      signIn ? 'needs_sign_in' : 'broken',
      words,
      `${c.manifest.title} for ${conn.account}: ${words}`,
      { actor: { kind: 'connector', id: c.manifest.name } },
    )
  }

  // Which connection a tool call is for: the one account, or the one named.
  private connectionFor(c: Connector, account?: string): Connection {
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

  // A connector's tool run by the core itself, on the person's yes already given (an agent's draft
  // sent from its card): the gate is behind it, so it runs as asked.
  async runTool(connector: string, name: string, input: Record<string, unknown>): Promise<unknown> {
    const c = connectorOf(connector)
    const spec = c.tools[name]
    if (!spec) throw new Refused(`${c.manifest.title} has no ${name}.`)
    return spec.run(this.call(c, this.connectionFor(c)), input as never)
  }

  // The connections whose items carry files (an email's attachments), and an item's files.
  fileSources(): { connection: string; title: string; table: string; field: string }[] {
    return this.world.connections
      .list()
      .filter((k) => k.state === 'connected')
      .flatMap((k) => {
        const c = connectorOf(k.connector)
        return c.files
          ? [
              {
                connection: k.id,
                title: c.manifest.title,
                table: c.files.table,
                field: c.files.field,
              },
            ]
          : []
      })
  }

  async fetchFiles(connection: string, item: string): Promise<ItemFile[]> {
    const conn = this.world.connections.get(connection)
    if (!conn) throw new Refused('That connection is not there.')
    const c = connectorOf(conn.connector)
    if (!c.files) throw new Refused(`${c.manifest.title} carries no files.`)
    return c.files.fetch(this.call(c, conn), item)
  }

  effect(name: string, input: Record<string, unknown>): Effect | undefined {
    for (const c of KNOWN)
      for (const [t, spec] of Object.entries(c.tools))
        if (toolName(c, t) === name)
          return typeof spec.effect === 'function' ? spec.effect(input as never) : spec.effect
    return undefined
  }

  preview(name: string, input: Record<string, unknown>): Preview | undefined {
    for (const c of KNOWN)
      for (const [t, spec] of Object.entries(c.tools))
        if (toolName(c, t) === name && spec.preview) return spec.preview(input as never)
    return undefined
  }

  // Every known connector's tools, always, so the desk's tools never change when an account is
  // connected (a session is resumed only with the same tools). They load through tool search.
  names(): string[] {
    return KNOWN.flatMap((c) => Object.keys(c.tools).map((t) => toolName(c, t))).sort()
  }

  server() {
    const tools = KNOWN.flatMap((c) =>
      Object.entries(c.tools).map(([t, spec]) =>
        tool(
          toolName(c, t),
          `${c.manifest.title}: ${spec.description}`,
          { ...spec.input, account: z.string().optional() },
          async (input: Record<string, unknown>) => {
            try {
              const { account, ...rest } = input
              const conn = this.connectionFor(c, typeof account === 'string' ? account : undefined)
              const out = await spec.run(this.call(c, conn), rest as never)
              return { content: [{ type: 'text' as const, text: JSON.stringify(out, null, 1) }] }
            } catch (err) {
              const words =
                err instanceof Refused || err instanceof Problem
                  ? err.message
                  : `Something went wrong: ${err instanceof Error ? err.message : String(err)}`
              return { content: [{ type: 'text' as const, text: words }], isError: true }
            }
          },
        ),
      ),
    )
    return createSdkMcpServer({ name: SERVER, version: '0.1.0', tools })
  }

  // What the start layer says about connections.
  describe(): string {
    const conns = this.world.connections.list()
    if (!conns.length)
      return 'None yet. The person connects accounts and folders in Settings › Connections.'
    return conns
      .map((k) => {
        const c = connectorOf(k.connector)
        const state =
          k.state === 'connected'
            ? 'connected'
            : k.state === 'needs_sign_in'
              ? 'needs the person to sign in again'
              : k.state
        return `### ${c.manifest.title}: ${k.account} (${state}${k.health ? `; ${k.health}` : ''})\n${c.guide.replace(/^# .*\n+/, '').trim()}`
      })
      .join('\n\n')
  }
}

// The same bytes are the same file (design §4).
function hashOf(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex')
}
