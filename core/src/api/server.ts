// The api the window talks to (design §2, §14): HTTP and a websocket on loopback. Every request,
// HTTP or websocket, checks its Host, its Origin and the per-install token.
import { existsSync } from 'node:fs'
import fastifyStatic from '@fastify/static'
import websocket from '@fastify/websocket'
import Fastify, { type FastifyInstance, type FastifyReply } from 'fastify'
import { z } from 'zod'
import { connectorOf, KNOWN } from '../connectors/service.ts'
import type { Engine, EngineEvent } from '../engine/engine.ts'
import { agents, setAgentState, whenWords } from '../modules/agents.ts'
import { install, installedKits, update } from '../modules/kits.ts'
import { moduleNetwork } from '../modules/runs.ts'
import type { Card } from '../world/cards.ts'
import { type Provenance, Refused } from '../world/kinds.ts'
import type { Table } from '../world/shape.ts'
import type { User } from '../world/world.ts'
import type {
  AboutRows,
  CardView,
  ConnectorsView,
  Health,
  Me,
  ModuleSummary,
  RunView,
  SourceView,
  Stream,
  StreamLine,
  TableView,
  WorkingModuleView,
} from './types.ts'

export const VERSION = '0.1.0'

// What the stream shows: the person's sentences, Alpha's replies, the steps and what they made.
const STREAM_KINDS = [
  'said',
  'replied',
  'error',
  'limit',
  'noticed',
  'card_opened',
  'card_closed',
  'call',
  'called',
  'made',
  'shaped',
  'wrote',
  'changed',
  'removed',
  'filed',
  'remembered',
  'kept',
  'told',
]

export interface ServerOptions {
  engine?: Engine
  user?: User
  token?: string
  ports?: number[] // the core's and the dev window's
  windowDir?: string // the built window, served at / when it is there
}

export function buildServer(options: ServerOptions = {}): FastifyInstance {
  const app = Fastify({ bodyLimit: 200 * 1024 * 1024 })
  app.get('/api/health', async (): Promise<Health> => ({ ok: true, version: VERSION }))

  const { engine, user, token } = options
  if (!engine || !user) return app
  const world = engine.world
  const hosts = new Set((options.ports ?? []).flatMap((p) => [`127.0.0.1:${p}`, `localhost:${p}`]))

  app.addHook('onRequest', async (req, reply) => {
    if (!req.url.startsWith('/api') && !req.url.startsWith('/ws')) return
    if (req.url === '/api/health') return
    const host = req.headers.host ?? ''
    const origin = req.headers.origin
    const given = req.headers['x-alpha-token'] ?? (req.query as { t?: string }).t
    if (hosts.size && !hosts.has(host)) return deny(reply, 'This address is not Alpha’s.')
    if (origin && hosts.size && !hosts.has(origin.replace(/^https?:\/\//, '')))
      return deny(reply, 'This page is not Alpha’s.')
    if (token && given !== token)
      return deny(reply, 'Open Alpha from the address the core printed.')
  })

  app.addContentTypeParser('*', { parseAs: 'buffer' }, (_req, body, done) => done(null, body))

  app.get(
    '/api/me',
    async (): Promise<Me> => ({ user: { id: user.id, name: user.name }, tenant: world.tenant }),
  )

  app.get('/api/stream', async (req): Promise<Stream> => {
    const q = z
      .object({
        after: z.coerce.number().optional(),
        before: z.coerce.number().optional(),
        limit: z.coerce.number().optional(),
      })
      .parse(req.query)
    const lines = world
      .lines({
        user: user.id,
        kinds: STREAM_KINDS,
        ...(q.after !== undefined ? { after: q.after } : {}),
        ...(q.before !== undefined ? { before: q.before } : {}),
        limit: q.limit ?? 400,
      })
      .map(
        (l): StreamLine => ({
          id: l.id,
          at: l.at,
          actor: l.actor.kind,
          kind: l.kind,
          words: l.words,
          turn: l.turn,
          card: l.card,
          data: l.kind === 'told' ? { about: aboutRows(l.data.about) } : shown(l.kind, l.data),
        }),
      )
    return {
      lines,
      cards: world.cards.waiting(user.id).map(cardView),
      busy: engine.busy(user),
      lastId: world.lastLineId(),
    }
  })

  app.post('/api/say', async (req) => {
    const { words } = z.object({ words: z.string().trim().min(1) }).parse(req.body)
    return { turn: engine.say(user, words) }
  })

  app.post('/api/stop', async () => {
    await engine.stop(user)
    return { ok: true }
  })

  app.post('/api/cards/:id', async (req, reply) => {
    const { id } = z.object({ id: z.string() }).parse(req.params)
    const { answer } = z.object({ answer: z.string().min(1) }).parse(req.body)
    try {
      return cardView(engine.answer(user, id, answer))
    } catch (err) {
      if (err instanceof Refused) return reply.code(409).send({ problem: err.message })
      throw err
    }
  })

  app.get(
    '/api/modules',
    async (): Promise<ModuleSummary[]> =>
      world.shape
        .modules()
        .map((m) => ({
          id: m.id,
          name: m.name,
          tables: world.shape
            .tables(m.id)
            .filter((t) => !t.hidden)
            .map((t) => ({ id: t.id, name: t.name, rows: world.records.count(t.id) })),
        }))
        .filter((m) => m.tables.length > 0),
  )

  // In the sidebar or out of it (Settings › Connections).
  app.post('/api/tables/:id/sidebar', async (req) => {
    const { id } = z.object({ id: z.string() }).parse(req.params)
    const { shown } = z.object({ shown: z.boolean() }).parse(req.body)
    const t = world.shape.setHidden(id, !shown, {
      actor: { kind: 'person', id: user.id },
      user: user.id,
    })
    return { id: t.id, hidden: t.hidden }
  })

  // The person sets a choice on a row in the window (a board's column, a Home line's Pass): their
  // own word, journaled, and the value's source.
  app.post('/api/tables/:id/rows/:row', async (req) => {
    const { id, row } = z.object({ id: z.string(), row: z.string() }).parse(req.params)
    const { field, value } = z.object({ field: z.string(), value: z.string() }).parse(req.body)
    const t = world.shape.table(id)
    const f = t?.fields.find((x) => x.name === field)
    if (!t || f?.kind !== 'choice') throw new Refused('Only a choice is set from here.')
    const r = world.records.list(t.id).find((x) => x.id === row)
    if (!r) throw new Refused(`${t.name} has no such row.`)
    const line = world.line({
      actor: { kind: 'person', id: user.id },
      kind: 'set',
      words: `Set ${field} to ${value} on ${rowName(t, r.values)}`,
      data: { table: t.id, row, field, value },
      user: user.id,
      module: t.module.id,
    })
    world.records.change(
      t.id,
      [
        {
          id: row,
          values: { [field]: value },
          provenance: { kind: 'stated', source: { message: line.id } },
        },
      ],
      { actor: { kind: 'person', id: user.id }, user: user.id },
    )
    engine.events.emit('event', { type: 'lines', user: user.id })
    return { ok: true }
  })

  app.get('/api/tables/:id', async (req, reply): Promise<TableView | undefined> => {
    const { id } = z.object({ id: z.string() }).parse(req.params)
    const t = world.shape.table(id)
    if (!t) return reply.code(404).send({ problem: 'That table is not there.' })
    return {
      id: t.id,
      name: t.name,
      module: { id: t.module.id, name: t.module.name },
      fields: t.fields.map((f) => ({
        id: f.id,
        name: f.name,
        slug: f.slug,
        kind: f.kind,
        choices: f.choices,
      })),
      rows: world.records.list(t.id).map((r) => ({
        id: r.id,
        values: r.values,
        sources: Object.fromEntries(
          Object.entries(r.provenance).map(([k, p]) => [k, sourceView(p)]),
        ),
      })),
      names: Object.fromEntries(
        t.fields
          .filter((f) => f.kind === 'relation' && f.relatesTo)
          .flatMap((f) => {
            const other = world.shape.table(f.relatesTo as string)
            return other
              ? world.records.list(other.id).map((r) => [r.id, rowName(other, r.values)])
              : []
          }),
      ),
    }
  })

  app.post('/api/files', async (req) => {
    const name = decodeURIComponent(String(req.headers['x-file-name'] ?? 'file'))
    const mime = String(req.headers['content-type'] ?? 'application/octet-stream')
    const body = req.body as Buffer
    const out = engine.drop(user, new Uint8Array(body), name, mime)
    return { name: out.file.name, readable: out.readable, pieces: out.document?.chunks ?? 0 }
  })

  app.get('/api/files/:hash', async (req, reply) => {
    const { hash } = z.object({ hash: z.string() }).parse(req.params)
    const f = world.files.file(hash)
    if (!f) return reply.code(404).send({ problem: 'That file is not there.' })
    return reply
      .type(f.mime)
      .header('content-disposition', `inline; filename="${encodeURIComponent(f.name)}"`)
      .send(world.files.bytes(hash))
  })

  app.get('/api/connectors', async (): Promise<ConnectorsView> => {
    return {
      connectors: KNOWN.map((c) => ({
        name: c.manifest.name,
        title: c.manifest.title,
        auth: c.manifest.auth,
        account: c.manifest.account,
        ...(c.manifest.secret ? { secret: c.manifest.secret } : {}),
      })),
      connections: world.connections.list().map((k) => ({
        id: k.id,
        connector: k.connector,
        title: connectorOf(k.connector).manifest.title,
        account: k.account,
        state: k.state,
        health: k.health,
        lastSyncAt: k.lastSyncAt,
        tables: connectorOf(k.connector).tables.flatMap((spec) => {
          const t = world.shape.table(spec.name)
          return t ? [{ id: t.id, name: t.name, hidden: t.hidden }] : []
        }),
      })),
    }
  })

  // The person connects in Alpha's own form: the secret goes to the Keychain, never the world.
  app.post('/api/connections', async (req) => {
    const b = z
      .object({
        connector: z.string(),
        account: z.string().trim().min(1),
        secret: z.string().optional(),
      })
      .parse(req.body)
    const c = await engine.connect(user, b.connector, b.account, b.secret ?? null)
    return { id: c.id, state: c.state }
  })

  app.delete('/api/connections/:id', async (req) => {
    const { id } = z.object({ id: z.string() }).parse(req.params)
    await engine.disconnect(user, id)
    return { ok: true }
  })

  app.post('/api/connections/:id/sync', async (req) => {
    const { id } = z.object({ id: z.string() }).parse(req.params)
    await engine.sync(user, id)
    return { ok: true }
  })

  // Kits and agents (design §10, §11): what each module does on its own.
  app.get('/api/working', async (): Promise<WorkingModuleView[]> => {
    const kits = new Map(installedKits(world).map((k) => [k.module, k]))
    const running = new Set(
      (engine.hands?.runner.runs(200) ?? [])
        .filter((r) => r.state === 'running')
        .map((r) => r.agent),
    )
    return world.shape
      .modules()
      .map((m) => {
        const k = kits.get(m.id)
        return {
          id: m.id,
          name: m.name,
          kit: k ? { name: k.kit, version: k.version, source: k.source } : null,
          network: moduleNetwork(m),
          agents: agents(world, m.id).map((a) => ({
            id: a.id,
            name: a.name,
            state: a.state,
            when: whenWords(a.trigger),
            lastRunAt: a.lastRunAt,
            running: running.has(a.id),
          })),
        }
      })
      .filter((m) => m.kit || m.agents.length)
  })

  // A kit is installed from a folder on this Mac, or updated from one by the ownership rule.
  app.post('/api/kits', async (req) => {
    const { folder } = z.object({ folder: z.string().trim().min(1) }).parse(req.body)
    const m = await install(world, folder, {
      actor: { kind: 'person', id: user.id },
      user: user.id,
    })
    engine.events.emit('event', { type: 'lines', user: user.id })
    return { module: m.id }
  })

  app.post('/api/kits/:module/update', async (req) => {
    const { module } = z.object({ module: z.string() }).parse(req.params)
    const { folder } = z.object({ folder: z.string().trim().optional() }).parse(req.body ?? {})
    const m = world.shape.module(module)
    const k = installedKits(world).find((x) => x.module === m?.id)
    if (!m || !k) throw new Refused('That module did not come from a kit.')
    const report = await update(world, m.name, folder || k.source, {
      actor: { kind: 'person', id: user.id },
      user: user.id,
    })
    engine.events.emit('event', { type: 'lines', user: user.id })
    return report
  })

  app.post('/api/agents/:id', async (req) => {
    const { id } = z.object({ id: z.string() }).parse(req.params)
    const { state } = z.object({ state: z.enum(['on', 'paused']) }).parse(req.body)
    setAgentState(world, id, state, user.id)
    engine.events.emit('event', { type: 'lines', user: user.id })
    return { ok: true }
  })

  // Run an agent now; its outcome reaches Activity, not this answer.
  app.post('/api/agents/:id/run', async (req) => {
    const { id } = z.object({ id: z.string() }).parse(req.params)
    const runner = engine.hands?.runner
    const a = agents(world).find((x) => x.id === id)
    if (!runner || !a) throw new Refused('That agent is not there.')
    void runner.runAgent(a, { user: user.id, turn: null }).catch(() => undefined)
    return { ok: true }
  })

  app.get('/api/activity', async (): Promise<RunView[]> => {
    const runner = engine.hands?.runner
    if (!runner) return []
    const names = new Map(agents(world).map((a) => [a.id, a.name]))
    const modules = new Map(world.shape.modules().map((m) => [m.id, m.name]))
    return runner.runs(50).map((r) => ({
      id: r.id,
      agent: r.agent ? (names.get(r.agent) ?? null) : null,
      module: r.module ? (modules.get(r.module) ?? null) : null,
      startedAt: r.startedAt,
      endedAt: r.endedAt,
      state: r.state,
      words: r.words,
      steps: world
        .lines({
          run: r.id,
          kinds: ['run_step', 'told', 'landed', 'wrote', 'changed', 'card_opened'],
        })
        .map((l) => ({ id: l.id, at: l.at, kind: l.kind, words: l.words })),
    }))
  })

  app.post('/api/runs/:id/stop', async (req) => {
    const { id } = z.object({ id: z.string() }).parse(req.params)
    return { stopped: engine.hands?.runner.stop(id) ?? false }
  })

  void app.register(websocket)
  void app.register(async (scope) => {
    scope.get('/ws', { websocket: true }, (socket) => {
      const send = (e: EngineEvent) => {
        if (e.user === user.id) socket.send(JSON.stringify({ ...e, user: undefined }))
      }
      engine.events.on('event', send)
      socket.on('close', () => engine.events.off('event', send))
    })
  })

  if (options.windowDir && existsSync(options.windowDir))
    void app.register(fastifyStatic, { root: options.windowDir, prefix: '/' })

  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof z.ZodError)
      return reply.code(400).send({ problem: 'That request is not right.' })
    if (err instanceof Refused) return reply.code(409).send({ problem: err.message })
    reply.code(500).send({ problem: 'Something went wrong in the core.' })
  })

  return app

  function aboutRows(about: unknown): AboutRows | null {
    const a = about as
      | { table: string; rows: string[]; choice?: { field: string; value: string; label: string } }
      | undefined
    const t = a ? world.shape.table(a.table) : undefined
    if (!a || !t) return null
    const field = a.choice ? t.fields.find((f) => f.name === a.choice?.field) : undefined
    const byId = new Map(world.records.list(t.id).map((r) => [r.id, r]))
    return {
      table: t.id,
      rows: a.rows.flatMap((id) => {
        const r = byId.get(id)
        if (!r) return []
        const v = field ? r.values[field.slug] : null
        return [{ id, name: rowName(t, r.values), value: typeof v === 'string' ? v : null }]
      }),
      choice: a.choice ?? null,
    }
  }

  function sourceView(p: Provenance): SourceView {
    const at = p.at
    switch (p.kind) {
      case 'stated': {
        const line = p.source.message !== undefined ? world.lineById(p.source.message) : null
        if (line?.kind === 'set') return { kind: 'stated', words: 'You set it in your window', at }
        const words = line?.words
        return {
          kind: 'stated',
          words: words
            ? `You said “${words}”`
            : p.source.card
              ? 'You accepted it on a card'
              : 'You said it',
          at,
        }
      }
      case 'looked_up': {
        if (p.source.file) {
          const f = world.files.findFile(p.source.file)
          return {
            kind: 'looked_up',
            words: `From ${f?.name ?? 'a file'}${p.source.page ? `, page ${p.source.page}` : ''}${p.source.sheet ? `, ${p.source.sheet}` : ''}${p.source.cell ? ` ${p.source.cell}` : ''}`,
            at,
            open: {
              file: f?.hash ?? p.source.file,
              ...(p.source.cell ? { cell: p.source.cell } : {}),
              ...(p.source.sheet ? { sheet: p.source.sheet } : {}),
            },
          }
        }
        const by = p.source.connector?.startsWith('agent:')
          ? `, read by ${p.source.connector.slice('agent:'.length)}`
          : ''
        if (p.source.url)
          return {
            kind: 'looked_up',
            words: `From ${URL.canParse(p.source.url) ? new URL(p.source.url).host : p.source.url}${by}`,
            at,
            open: { url: p.source.url },
          }
        if (p.source.connector === 'kit')
          return {
            kind: 'looked_up',
            words: `Set up by the kit ${p.source.account ?? ''}`.trim(),
            at,
          }
        if (by) return { kind: 'looked_up', words: `Read by ${by.slice(', read by '.length)}`, at }
        return { kind: 'looked_up', words: 'Looked up', at }
      }
      case 'computed':
        return {
          kind: 'computed',
          words: p.source.formula ? `Computed: ${p.source.formula}` : 'Computed from other values',
          at,
        }
      case 'estimated':
        return { kind: 'estimated', words: `Estimated: ${p.basis ?? ''}`.trim(), at }
      case 'assumed':
        return { kind: 'assumed', words: `Assumed: ${p.basis ?? ''}`.trim(), at }
    }
  }
}

// A row as a person names it: its first text value.
function rowName(t: Table, values: Record<string, unknown>): string {
  for (const f of t.fields)
    if (f.kind === 'text' && typeof values[f.slug] === 'string' && values[f.slug])
      return String(values[f.slug])
  return 'a row'
}

function deny(reply: FastifyReply, words: string) {
  return reply.code(403).send({ problem: words })
}

function cardView(c: Card): CardView {
  const input = (c.call?.input ?? {}) as { connector?: unknown }
  return {
    id: c.id,
    kind: c.kind,
    state: c.state,
    words: c.words,
    detail: c.detail,
    gate: c.gate,
    connector: c.gate === 'sign_in' && typeof input.connector === 'string' ? input.connector : null,
    options: c.options,
    cannotUndo: c.cannotUndo,
    answer: c.answer,
  }
}

// The window gets words, not the tools' inputs.
function shown(kind: string, data: Record<string, unknown>): Record<string, unknown> {
  if (kind === 'call') return { call: data.call }
  if (kind === 'called') return { call: data.call, ok: data.ok }
  if (kind === 'card_closed') return { state: data.state }
  if (kind === 'made' || kind === 'wrote' || kind === 'shaped') return { table: data.table ?? null }
  return {}
}
