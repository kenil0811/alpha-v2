// A rule world (docs/rules.md, R3): a fresh tenant of its own for each rule's door, holding what
// the rules are about. An open kit's module (the installer's made-up Bakery) with a supplier an
// schedule read; a connector's tables (a made-up mailbox) with one message it read; and, when a rule
// asks, a managed kit, a kit someone else maintains, Alpha's own kit and the made-up plugin. The
// window answers through the server, as the person; nothing calls the model.
import { generateKeyPairSync } from 'node:crypto'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Connector } from '@alpha/connector-sdk'
import type { PluginHost } from '@alpha/plugin-sdk'
import type { FastifyInstance } from 'fastify'
import { buildServer } from '../api/server.ts'
import { landIn, tableOf } from '../connectors/places.ts'
import { Engine } from '../engine/engine.ts'
import { Gatekeeper } from '../engine/gate.ts'
import type { Here } from '../engine/tools/index.ts'
import { keepKit } from '../modules/defaults.ts'
import { install } from '../modules/kits/index.ts'
import { installPack, pack } from '../modules/packs.ts'
import { type Loaded, loadPlugins, Plugins } from '../plugins/plugins.ts'
import { signPack } from '../signing.ts'
import { type Line, lastId } from '../world/journal.ts'
import type { Provenance } from '../world/kinds.ts'
import type { Table } from '../world/shape/index.ts'
import type { User } from '../world/world.ts'
import { World } from '../world/world.ts'

const SRC = join(import.meta.dirname, '..')
export const KITS = {
  bakery: join(SRC, 'modules', 'test-kit'),
  managed: join(SRC, 'rules', 'kits', 'case-desk'),
  managedNext: join(SRC, 'rules', 'kits', 'case-desk-next'),
  maintained: join(SRC, 'rules', 'kits', 'supply'),
  alpha: join(import.meta.dirname, 'kits', 'own'),
}

// A made-up mailbox, landed as the connector service lands a connection's items.
export const MAILBOX = {
  manifest: { name: 'mailbox', title: 'Mailbox' },
  module: 'Mailbox',
  tables: [
    {
      name: 'Messages',
      fields: [
        { name: 'From', kind: 'email' },
        { name: 'Subject', kind: 'text' },
      ],
    },
  ],
} as unknown as Connector
export const ACCOUNT = 'owner@example.com'

// Where a door writes in this world: its own tables for a connector and a plugin, else the
// open kit's supplier.
export interface Target {
  table: string
  row: string
  key: string | null
  field: string
}

const TOKEN = 'rule-token'
const HEADERS = { host: '127.0.0.1:4700', 'x-alpha-token': TOKEN }

export interface Answer {
  status: number
  body: Record<string, unknown>
}

export class RuleWorld {
  readonly home: string
  readonly world: World
  readonly user: User
  readonly engine: Engine
  readonly app: FastifyInstance
  readonly here: Here
  readonly gate: Gatekeeper
  private plugins: { host: PluginHost; note: string } | null = null
  private readonly targets = new Map<string, Target>()

  private constructor(home: string, world: World) {
    this.home = home
    this.world = world
    this.user = world.owner('Kenil')
    this.engine = new Engine(world)
    this.app = buildServer({ engine: this.engine, user: this.user, token: TOKEN, ports: [4700] })
    this.here = {
      current: { user: this.user, turn: 't1', said: null, message: 'Tidy up the suppliers.' },
      fromSubagent: false,
      touched: new Set<string>(),
    }
    this.gate = new Gatekeeper(world, this.here, this.user)
  }

  static async open(
    kits: ('managed' | 'maintained' | 'alpha')[] = [],
    options: { plugin?: boolean } = {},
  ): Promise<RuleWorld> {
    const home = mkdtempSync(join(tmpdir(), 'alpha-rules-'))
    const w = new RuleWorld(home, await World.open(join(home, 'tenants', 't_rules')))
    const person = { actor: { kind: 'person' as const, id: w.user.id }, user: w.user.id }
    await install(w.world, KITS.bakery, person)
    for (const k of kits)
      if (k === 'alpha') await keepKit(w.world, KITS.alpha, { actor: { kind: 'system' } })
      else if (k === 'managed') await w.installSigned(KITS.managed)
      else await install(w.world, KITS[k], person)
    // a supplier the Counter schedule read, and a message the mailbox read
    w.world.records.land(
      w.table('Suppliers').id,
      [{ key: 'harbor', values: { Name: 'Harbor Mills', Email: 'orders@harbor.example' } }],
      { connector: 'schedule:Counter', account: 'Bakery' },
      { actor: { kind: 'schedule', id: 'Counter' }, run: 'run_seed' },
    )
    landIn(w.world, MAILBOX)
    w.landMail('m1', { From: 'priya@harbor.example', Subject: 'The Harbor deal' })
    if (options.plugin) await w.plugin()
    return w
  }

  async close(): Promise<void> {
    await this.app.close()
    this.engine.close()
    this.world.close()
    rmSync(this.home, { recursive: true, force: true })
  }

  table(name: string): Table {
    const t = this.world.shape.table(name)
    if (!t) throw new Error(`The rule world has no table ${name}.`)
    return t
  }

  // a row's value and provenance by its field's name
  value(table: string, row: string, field: string): unknown {
    const t = this.table(table)
    const f = t.fields.find((x) => x.name === field)
    return f ? this.world.records.get(row)?.record.values[f.slug] : undefined
  }
  provenance(table: string, row: string, field: string): Provenance | undefined {
    const t = this.table(table)
    const f = t.fields.find((x) => x.name === field)
    return f ? this.world.records.get(row)?.record.provenance[f.slug] : undefined
  }
  rowOf(table: string, key: string): string {
    const id = this.world.records.byKey(this.table(table).id, key)
    if (!id) throw new Error(`${table} has no row ${key}.`)
    return id
  }
  rows(table: string): number {
    return this.world.records.count(this.table(table).id)
  }

  // where each door writes: a connector its own table, a plugin its own, the rest the supplier
  // (kept once worked out, so a row the test removes is still named)
  target(door: { by: string }): Target {
    if (door.by === 'plugin') return this.targetOf('plugin')
    const kind = door.by === 'connector' ? 'connector' : 'open'
    const known = this.targets.get(kind)
    if (known) return known
    const t = this.targetOf(kind)
    this.targets.set(kind, t)
    return t
  }
  private targetOf(by: string): Target {
    if (by === 'connector')
      return { table: 'Messages', row: this.rowOf('Messages', 'm1'), key: 'm1', field: 'Subject' }
    if (by === 'plugin')
      return { table: 'Notes', row: this.plugins?.note ?? '', key: null, field: 'Line' }
    return {
      table: 'Suppliers',
      row: this.rowOf('Suppliers', 'harbor'),
      key: 'harbor',
      field: 'Email',
    }
  }

  // The window, as the person: an answer and its words.
  async post(url: string, body: unknown): Promise<Answer> {
    const r = await this.app.inject({
      method: 'POST',
      url,
      headers: HEADERS,
      payload: body as object,
    })
    return { status: r.statusCode, body: (r.body ? r.json() : {}) as Record<string, unknown> }
  }

  // A kit installed from a pack signed by the key this rule world trusts, as a release's would be
  // by Kenil's (rules M1, M3): a test key, never his.
  readonly key = generateKeyPairSync('ed25519')
  async installSigned(folder: string): Promise<string> {
    const pem = this.key.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString()
    const file = signPack(pack(folder, join(this.home, 'packs')), pem)
    return installPack(
      this.world,
      file,
      join(this.home, 'kits'),
      { actor: { kind: 'person', id: this.user.id }, user: this.user.id },
      {
        developer: false,
        key: this.key.publicKey.export({ type: 'spki', format: 'pem' }).toString(),
      },
    )
  }

  // What the window reads, as the person.
  async get(url: string): Promise<Answer> {
    const r = await this.app.inject({ method: 'GET', url, headers: HEADERS })
    return { status: r.statusCode, body: (r.body ? r.json() : {}) as Record<string, unknown> }
  }

  // The person types a value over a row's, in the window.
  async personSets(t: Target, value: unknown): Promise<void> {
    const r = await this.post(`/api/tables/${this.table(t.table).id}/rows/${t.row}`, {
      field: t.field,
      value,
    })
    if (r.status !== 200)
      throw new Error(`The person's value was refused: ${JSON.stringify(r.body)}`)
  }

  // The mailbox reads a message, as its connection's land does.
  landMail(key: string, values: Record<string, unknown>) {
    const t = tableOf(this.world, MAILBOX, 'Messages')
    if (!t) throw new Error('The mailbox has no Messages table.')
    return this.world.records.land(
      t.id,
      [{ key, values }],
      { connector: 'mailbox', account: ACCOUNT },
      { actor: { kind: 'connector', id: 'mailbox' } },
    )
  }

  // The person says something in the conversation: the turn Alpha's tools write in.
  say(message: string): void {
    const line = this.world.line({
      actor: { kind: 'person', id: this.user.id },
      kind: 'said',
      words: message,
      user: this.user.id,
      turn: 't1',
    })
    this.here.current = {
      user: this.user,
      turn: 't1',
      said: { message: line.id, user: this.user.id },
      message,
    }
  }

  // The made-up plugin, loaded and given its host as the core gives it, with one note it keeps.
  async plugin(): Promise<PluginHost> {
    if (this.plugins) return this.plugins.host
    const { plugins } = await loadPlugins(join(SRC, 'plugins'))
    const deps = {
      world: this.world,
      user: this.user,
      home: this.home,
      region: () => null,
      ask: async () => ({ answer: null }),
      connectors: null,
    }
    const p = new Plugins(deps)
    await p.register(plugins)
    await p.keepKits({ actor: { kind: 'system' } })
    // the host as the plugin is given it: its own make, private to the plugin seam
    const host = (p as unknown as { host(l: Loaded): PluginHost }).host(plugins[0] as Loaded)
    const [note] = host.own.add('Notes', [
      { values: { Line: 'Order flour' }, basis: 'the rule world' },
    ])
    this.plugins = { host, note: note as string }
    return host
  }

  // The newest journal line's id, and the lines after one.
  lastLine(): number {
    return lastId(this.world.db)
  }
  linesAfter(id: number): Line[] {
    return this.world.lines({ after: id })
  }
}
