// The api the window talks to (design §2, §14): HTTP and a websocket on loopback. Every request,
// HTTP or websocket, checks its Host, its Origin and the per-install token.
import { existsSync } from 'node:fs'
import fastifyStatic from '@fastify/static'
import websocket from '@fastify/websocket'
import Fastify, { type FastifyInstance, type FastifyReply } from 'fastify'
import { z } from 'zod'
import type { Engine, EngineEvent } from '../engine/engine.ts'
import { type Provenance, Refused } from '../world/kinds.ts'
import type { User } from '../world/world.ts'
import type {
  CardView,
  Health,
  Me,
  ModuleSummary,
  SourceView,
  Stream,
  StreamLine,
  TableView,
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
          data: shown(l.kind, l.data),
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
      world.shape.modules().map((m) => ({
        id: m.id,
        name: m.name,
        tables: world.shape
          .tables(m.id)
          .map((t) => ({ id: t.id, name: t.name, rows: world.records.count(t.id) })),
      })),
  )

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

  function sourceView(p: Provenance): SourceView {
    const at = p.at
    switch (p.kind) {
      case 'stated': {
        const words =
          p.source.message !== undefined ? world.lineById(p.source.message)?.words : null
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
            words: `From ${f?.name ?? 'a file'}${p.source.sheet ? `, ${p.source.sheet}` : ''}${p.source.cell ? ` ${p.source.cell}` : ''}`,
            at,
            open: {
              file: f?.hash ?? p.source.file,
              ...(p.source.cell ? { cell: p.source.cell } : {}),
              ...(p.source.sheet ? { sheet: p.source.sheet } : {}),
            },
          }
        }
        if (p.source.url)
          return {
            kind: 'looked_up',
            words: `From ${URL.canParse(p.source.url) ? new URL(p.source.url).host : p.source.url}`,
            at,
            open: { url: p.source.url },
          }
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

function deny(reply: FastifyReply, words: string) {
  return reply.code(403).send({ problem: words })
}

function cardView(c: {
  id: string
  kind: string
  state: string
  words: string
  options: string[]
  cannotUndo: string | null
  answer: string | null
}): CardView {
  return {
    id: c.id,
    kind: c.kind,
    state: c.state,
    words: c.words,
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
