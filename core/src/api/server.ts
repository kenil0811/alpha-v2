// The api the window talks to (design §2, §14): HTTP and a websocket on loopback. Every request,
// HTTP or websocket, checks its Host, its Origin and the per-install token.
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { type Cell, sheetBytes } from '@alpha/connector-files'
import { chromePath } from '@alpha/connector-sdk'
import fastifyStatic from '@fastify/static'
import websocket from '@fastify/websocket'
import Fastify, { type FastifyInstance, type FastifyReply } from 'fastify'
import { z } from 'zod'
import { config } from '../config.ts'
import { connectorOf, KNOWN } from '../connectors/service.ts'
import type { Engine, EngineEvent } from '../engine/engine.ts'
import { instructionsFile } from '../engine/tools.ts'
import { agents, nextRun, setAgentState, whenWords } from '../modules/agents.ts'
import { install, installedKits, update } from '../modules/kits.ts'
import { moduleNetwork } from '../modules/runs.ts'
import { pageAnswer, pageDocument, pagesOf, printPage } from '../pages/pages.ts'
import type { Card } from '../world/cards.ts'
import { FIELD_KINDS, type Provenance, Refused } from '../world/kinds.ts'
import { findField, type Table } from '../world/shape.ts'
import type { View } from '../world/views.ts'
import type { User } from '../world/world.ts'
import type {
  AboutRows,
  CardView,
  ConnectorsView,
  FoundRow,
  Health,
  HistoryView,
  InstructionView,
  Me,
  ModelView,
  ModuleSummary,
  ModuleView,
  RunView,
  SavedView,
  SourceView,
  Stream,
  StreamLine,
  TableView,
  TodayView,
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
  'card_used',
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
  browsers?: string // where the core's own browser is kept, for printing pages
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

  app.get('/api/me', async (): Promise<Me> => {
    const theme = world.preference(user.id, 'theme')
    return {
      user: { id: user.id, name: user.name },
      tenant: world.tenant,
      theme: theme === 'light' || theme === 'dark' ? theme : 'mac',
    }
  })

  app.post('/api/appearance', async (req) => {
    const { theme } = z.object({ theme: z.enum(['mac', 'light', 'dark']) }).parse(req.body)
    world.setPreference(user.id, 'theme', theme === 'mac' ? null : theme)
    return { ok: true }
  })

  // Find (⌘K): rows by their words, each opening where it is.
  app.get('/api/find', async (req): Promise<FoundRow[]> => {
    const { words } = z.object({ words: z.string().trim().min(1) }).parse(req.query)
    return world
      .search(words, 12)
      .filter((h) => h.what === 'record')
      .flatMap((h) => {
        const rec = world.records.get(h.id)
        if (!rec || rec.table.hidden) return []
        return [
          {
            label: rowName(rec.table, rec.record.values),
            hint: rec.table.name,
            href: `#/table/${rec.table.id}/${h.id}`,
          },
        ]
      })
      .slice(0, 8)
  })

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
          module: moduleOf(l.module),
          data:
            l.kind === 'told'
              ? { about: aboutRows(l.data.about), agent: l.data.agent ?? null }
              : shown(l.kind, l.data),
        }),
      )
    return {
      lines,
      cards: world.cards.waiting(user.id).map(cardView),
      busy: engine.busy(user),
      running: (engine.hands?.runner.runs(50) ?? [])
        .filter((r) => r.state === 'running')
        .map((r) => ({
          id: r.id,
          name: (r.agent && agents(world).find((a) => a.id === r.agent)?.name) || 'A try',
          module: r.module,
        })),
      attention: world.connections
        .list()
        .filter((k) => k.state === 'needs_sign_in')
        .map((k) => ({ connector: k.connector, title: connectorOf(k.connector).manifest.title })),
      lastId: world.lastLineId(),
    }
  })

  app.post('/api/say', async (req) => {
    const { words, from } = z
      .object({ words: z.string().trim().min(1), from: z.string().optional() })
      .parse(req.body)
    const m = from ? world.shape.module(from) : undefined
    return { turn: engine.say(user, words, m ? { id: m.id, name: m.name } : null) }
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
          pages: pagesOf(m),
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

  // The person sets a value in the window (a board's column, a Home line's Pass, Correct it in the
  // source panel): their own word, journaled, and the value's source. The world checks its kind.
  app.post('/api/tables/:id/rows/:row', async (req) => {
    const { id, row } = z.object({ id: z.string(), row: z.string() }).parse(req.params)
    const { field, value } = z.object({ field: z.string(), value: z.unknown() }).parse(req.body)
    const t = world.shape.table(id)
    const f = t?.fields.find((x) => x.name === field)
    if (!t || !f) throw new Refused('That field is not there.')
    if (f.kind === 'relation' || f.kind === 'file' || f.kind === 'person')
      throw new Refused(`${f.name} is set by asking Alpha, not from here.`)
    const r = world.records.list(t.id).find((x) => x.id === row)
    if (!r) throw new Refused(`${t.name} has no such row.`)
    const said =
      value && typeof value === 'object' && 'amount' in value
        ? String((value as { amount: unknown }).amount)
        : String(value)
    const line = world.line({
      actor: { kind: 'person', id: user.id },
      kind: 'set',
      words: `Set ${field} to ${said} on ${rowName(t, r.values)}`,
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

  // The person adds a row in the window: each value theirs, the line saying so its source.
  app.post('/api/tables/:id/rows', async (req) => {
    const { id } = z.object({ id: z.string() }).parse(req.params)
    const { values } = z.object({ values: z.record(z.string(), z.unknown()) }).parse(req.body)
    const t = world.shape.table(id)
    if (!t) throw new Refused('That table is not there.')
    const given = Object.fromEntries(
      Object.entries(values).filter(([, v]) => v !== '' && v !== null && v !== undefined),
    )
    if (!Object.keys(given).length) throw new Refused('Give the row at least one value.')
    const line = world.line({
      actor: { kind: 'person', id: user.id },
      kind: 'set',
      words: `Added a row to ${t.name}`,
      data: { table: t.id, values: given },
      user: user.id,
      module: t.module.id,
    })
    const [row] = world.records.add(
      t.id,
      [{ values: given, provenance: { kind: 'stated', source: { message: line.id } } }],
      { actor: { kind: 'person', id: user.id }, user: user.id },
    )
    engine.events.emit('event', { type: 'lines', user: user.id })
    return { id: row }
  })

  // Many rows at once from the window: a paste, or a field set on ticked rows. Each value is the
  // person's word, with one line as its source; what is set by asking Alpha is refused.
  app.post('/api/tables/:id/rows/many', async (req) => {
    const { id } = z.object({ id: z.string() }).parse(req.params)
    const Values = z.record(z.string(), z.unknown())
    const body = z
      .object({
        set: z.array(z.object({ row: z.string(), values: Values })).default([]),
        add: z.array(z.object({ values: Values })).default([]),
      })
      .parse(req.body)
    const t = world.shape.table(id)
    if (!t) throw new Refused('That table is not there.')
    if (!body.set.length && !body.add.length) throw new Refused('There is nothing to put in.')
    for (const v of [...body.set, ...body.add])
      for (const name of Object.keys(v.values)) {
        const f = findField(t, name)
        if (f.kind === 'relation' || f.kind === 'file' || f.kind === 'person')
          throw new Refused(`${f.name} is set by asking Alpha, not from here.`)
      }
    const words = [
      body.set.length
        ? `set values on ${body.set.length} row${body.set.length === 1 ? '' : 's'}`
        : '',
      body.add.length ? `added ${body.add.length} row${body.add.length === 1 ? '' : 's'}` : '',
    ]
      .filter(Boolean)
      .join(' and ')
    const line = world.line({
      actor: { kind: 'person', id: user.id },
      kind: 'set',
      words: `In ${t.name}, ${words}`,
      data: { table: t.id, set: body.set, add: body.add },
      user: user.id,
      module: t.module.id,
    })
    const ctx = { actor: { kind: 'person' as const, id: user.id }, user: user.id }
    const provenance = { kind: 'stated' as const, source: { message: line.id } }
    if (body.set.length)
      world.records.change(
        t.id,
        body.set.map((s) => ({ id: s.row, values: s.values, provenance })),
        ctx,
      )
    const added = body.add.length
      ? world.records.add(
          t.id,
          body.add.map((a) => ({ values: a.values, provenance })),
          ctx,
        )
      : []
    engine.events.emit('event', { type: 'lines', user: user.id })
    return { changed: body.set.length, added: added.length }
  })

  // The person removes rows they ticked, having said yes in the window; the journal keeps them.
  app.post('/api/tables/:id/rows/remove', async (req) => {
    const { id } = z.object({ id: z.string() }).parse(req.params)
    const { rows } = z.object({ rows: z.array(z.string()).min(1) }).parse(req.body)
    const removed = world.records.remove(id, rows, {
      actor: { kind: 'person', id: user.id },
      user: user.id,
    })
    engine.events.emit('event', { type: 'lines', user: user.id })
    return { removed }
  })

  // The person adds a field from the table's header.
  app.post('/api/tables/:id/fields', async (req) => {
    const { id } = z.object({ id: z.string() }).parse(req.params)
    const f = z
      .object({
        name: z.string().trim().min(1),
        kind: z.enum(FIELD_KINDS),
        choices: z.array(z.string().trim().min(1)).optional(),
        relatesTo: z.string().optional(),
      })
      .parse(req.body)
    world.shape.addFields(
      id,
      [
        {
          name: f.name,
          kind: f.kind,
          ...(f.choices ? { choices: f.choices } : {}),
          ...(f.relatesTo ? { relatesTo: f.relatesTo } : {}),
        },
      ],
      { actor: { kind: 'person', id: user.id }, user: user.id },
    )
    engine.events.emit('event', { type: 'lines', user: user.id })
    return { ok: true }
  })

  // Export: exactly the rows and columns the person was looking at, as CSV or Excel.
  app.post('/api/tables/:id/export', async (req, reply) => {
    const { id } = z.object({ id: z.string() }).parse(req.params)
    const body = z
      .object({
        rows: z.array(z.string()),
        fields: z.array(z.string()),
        as: z.enum(['csv', 'xlsx']),
      })
      .parse(req.body)
    const t = world.shape.table(id)
    if (!t) throw new Refused('That table is not there.')
    const fields = body.fields.map((f) => findField(t, f))
    const byId = new Map(world.records.list(t.id).map((r) => [r.id, r]))
    const names = new Map<string, string>()
    for (const f of fields)
      if (f.kind === 'relation' && f.relatesTo) {
        const other = world.shape.table(f.relatesTo)
        if (other)
          for (const r of world.records.list(other.id)) names.set(r.id, rowName(other, r.values))
      }
    const cell = (kind: string, v: unknown): Cell => {
      if (v === null || v === undefined) return null
      if (kind === 'money' && typeof v === 'object') return (v as { amount: number }).amount
      if (kind === 'number') return Number(v)
      if (kind === 'relation')
        return (Array.isArray(v) ? v : [v]).map((x) => names.get(String(x)) ?? '').join(', ')
      if (Array.isArray(v)) return v.join(', ')
      return String(v)
    }
    const rows = body.rows
      .map((r) => byId.get(r))
      .filter((r) => !!r)
      .map((r) => fields.map((f) => cell(f.kind, r.values[f.slug])))
    const bytes = sheetBytes(
      t.name,
      fields.map((f) => f.name),
      rows,
      body.as,
    )
    return reply
      .header(
        'content-type',
        body.as === 'csv'
          ? 'text/csv; charset=utf-8'
          : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      )
      .header(
        'content-disposition',
        `attachment; filename="${encodeURIComponent(t.name)}.${body.as}"`,
      )
      .send(Buffer.from(bytes))
  })

  app.get('/api/tables/:id/rows/:row/history', async (req): Promise<HistoryView[]> => {
    const { row } = z.object({ id: z.string(), row: z.string() }).parse(req.params)
    const { field } = z.object({ field: z.string() }).parse(req.query)
    return world.records
      .history(row, field)
      .map((h) => ({ value: h.value, source: h.provenance ? sourceView(h.provenance) : null }))
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
        tones: f.tones,
      })),
      views: world.views.list(t.id).map(savedView),
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

  // A site's sign-in: it opens in the person's own Google Chrome on this Mac, they sign in there
  // themselves, and when they quit that Chrome the card is answered and the agent that met the
  // sign-in runs again.
  app.post('/api/cards/:id/sign-in', async (req) => {
    const { id } = z.object({ id: z.string() }).parse(req.params)
    const card = world.cards.get(id)
    const input = (card?.call?.input ?? {}) as { url?: string; agent?: string | null }
    if (card?.state !== 'waiting' || card.call?.tool !== 'site_sign_in' || !input.url)
      throw new Refused('That sign-in is not waiting.')
    const hands = engine.hands
    if (!hands) throw new Refused('Alpha has no browser here.')
    if (!chromePath()) throw new Refused('Signing in to a site needs Google Chrome on this Mac.')
    const url = input.url
    void (async () => {
      await hands.browser().signIn(url)
      world.cards.answer(id, 'Sign in', { kind: 'person', id: user.id })
      const agent = agents(world).find((a) => a.id === input.agent)
      if (agent) await hands.runner.runAgent(agent, { user: user.id, turn: null })
      engine.events.emit('event', { type: 'lines', user: user.id })
    })().catch(() => undefined)
    return { opened: true }
  })

  // Every agent of a module on, or paused, at once (a kit's readers start paused).
  app.post('/api/modules/:id/agents', async (req) => {
    const { id } = z.object({ id: z.string() }).parse(req.params)
    const { state } = z.object({ state: z.enum(['on', 'paused']) }).parse(req.body)
    const m = world.shape.module(id)
    if (!m) throw new Refused('That module is not there.')
    const list = agents(world, m.id)
    for (const a of list) setAgentState(world, a.id, state, user.id)
    engine.events.emit('event', { type: 'lines', user: user.id })
    return { changed: list.length }
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

  app.get('/api/modules/:id', async (req, reply): Promise<ModuleView | undefined> => {
    const { id } = z.object({ id: z.string() }).parse(req.params)
    const m = world.shape.module(id)
    if (!m) return reply.code(404).send({ problem: 'That module is not there.' })
    const k = installedKits(world).find((x) => x.module === m.id)
    const running = new Set(
      (engine.hands?.runner.runs(200) ?? [])
        .filter((r) => r.state === 'running')
        .map((r) => r.agent),
    )
    const notes = join(m.dir, 'NOTES.md')
    return {
      id: m.id,
      name: m.name,
      kit: k ? { name: k.kit, version: k.version } : null,
      agents: agents(world, m.id).map((a) => ({
        id: a.id,
        name: a.name,
        state: a.state,
        when: whenWords(a.trigger),
        lastRunAt: a.lastRunAt,
        running: running.has(a.id),
      })),
      sites: moduleNetwork(m).length,
      notes: existsSync(notes) ? readFileSync(notes, 'utf8') : '',
      pages: pagesOf(m),
      tables: world.shape
        .tables(m.id)
        .filter((t) => !t.hidden)
        .map((t) => ({ id: t.id, name: t.name, rows: world.records.count(t.id) })),
    }
  })

  // A module's page (design §13): the document its frame shows, the answers to what it asks (its
  // module's rows, read-only), and the page printed to a PDF with the choices the window had.
  const pageModule = (id: string) => {
    const m = world.shape.module(id)
    if (!m) throw new Refused('That module is not there.')
    return m
  }
  app.get('/api/modules/:id/pages/:name', async (req) => {
    const { id, name } = z.object({ id: z.string(), name: z.string() }).parse(req.params)
    const m = pageModule(id)
    const page = pagesOf(m).find((p) => p.name === name)
    if (!page) throw new Refused(`${m.name} has no page called ${name}.`)
    return { ...page, html: pageDocument(m, name) }
  })
  app.post('/api/modules/:id/pages/:name/ask', async (req) => {
    const { id } = z.object({ id: z.string(), name: z.string() }).parse(req.params)
    const { op, args } = z
      .object({ op: z.string(), args: z.record(z.string(), z.unknown()).default({}) })
      .parse(req.body)
    return { value: pageAnswer(world, pageModule(id), op, args) }
  })
  app.post('/api/modules/:id/pages/:name/pdf', async (req, reply) => {
    const { id, name } = z.object({ id: z.string(), name: z.string() }).parse(req.params)
    const { inputs } = z
      .object({ inputs: z.record(z.string(), z.string()).default({}) })
      .parse(req.body ?? {})
    if (!options.browsers) throw new Refused('Alpha has no browser here to print with.')
    const pdf = await printPage(world, pageModule(id), name, {
      browsers: options.browsers,
      inputs,
      as: 'pdf',
    })
    return reply.type('application/pdf').send(pdf)
  })

  // What Alpha remembers, each line removable by the person (the instructions files, design §6).
  const instructionLines = (who: 'me' | 'everyone') => {
    const file = instructionsFile(world, who === 'me' ? user.id : null)
    return existsSync(file)
      ? readFileSync(file, 'utf8')
          .split('\n')
          .filter((l) => l.startsWith('- '))
          .map((l) => l.slice(2).trim())
      : []
  }

  app.get(
    '/api/instructions',
    async (): Promise<InstructionView[]> => [
      ...instructionLines('me').map((words) => ({ for: 'me' as const, words })),
      ...instructionLines('everyone').map((words) => ({ for: 'everyone' as const, words })),
    ],
  )

  app.post('/api/instructions/remove', async (req) => {
    const b = z.object({ for: z.enum(['me', 'everyone']), words: z.string() }).parse(req.body)
    const file = instructionsFile(world, b.for === 'me' ? user.id : null)
    if (!existsSync(file)) throw new Refused('There is nothing remembered there.')
    const lines = readFileSync(file, 'utf8').split('\n')
    const at = lines.findIndex((l) => l.startsWith('- ') && l.slice(2).trim() === b.words)
    if (at < 0) throw new Refused('That is not remembered.')
    lines.splice(at, 1)
    writeFileSync(file, lines.join('\n'))
    world.line({
      actor: { kind: 'person', id: user.id },
      kind: 'forgot',
      words: `Will no longer remember: ${b.words}`,
      data: { for: b.for },
      user: user.id,
    })
    return { ok: true }
  })

  app.get('/api/model', async (): Promise<ModelView> => {
    const m = config.models()
    return { desk: m.desk, route: m.route }
  })

  // Saved views: the person makes, saves, renames, makes default and removes them.
  const ViewBody = z.object({
    name: z.string(),
    config: z.unknown(),
    isDefault: z.boolean().optional(),
  })
  app.post('/api/tables/:id/views', async (req): Promise<SavedView> => {
    const { id } = z.object({ id: z.string() }).parse(req.params)
    const body = ViewBody.parse(req.body)
    return savedView(
      world.views.save(
        { table: id, ...body },
        { actor: { kind: 'person', id: user.id }, user: user.id },
      ),
    )
  })
  app.put('/api/views/:id', async (req, reply): Promise<SavedView | undefined> => {
    const { id } = z.object({ id: z.string() }).parse(req.params)
    const v = world.views.get(id)
    if (!v) return reply.code(404).send({ problem: 'That view is not there.' })
    const body = ViewBody.partial().parse(req.body)
    return savedView(
      world.views.save(
        {
          table: v.table,
          id,
          name: body.name ?? v.name,
          config: body.config ?? v.config,
          ...(body.isDefault !== undefined ? { isDefault: body.isDefault } : {}),
        },
        { actor: { kind: 'person', id: user.id }, user: user.id },
      ),
    )
  })
  app.delete('/api/views/:id', async (req) => {
    const { id } = z.object({ id: z.string() }).parse(req.params)
    world.views.remove(id, { actor: { kind: 'person', id: user.id }, user: user.id })
    return { ok: true }
  })

  app.get('/api/activity', async (): Promise<RunView[]> => activity())

  // Today: what changed since the person last cleared it, and each clock agent's next run.
  app.get('/api/today', async (): Promise<TodayView> => {
    const start = new Date()
    start.setHours(0, 0, 0, 0)
    // never cleared yet: since the start of today
    const since = world.preference(user.id, 'seen_at') ?? start.toISOString()
    const changed = activity()
      .filter(
        (r) => r.startedAt > since && r.state !== 'running' && (!r.quiet || r.state === 'failed'),
      )
      .map((r) => ({ ...r, steps: [] }))
    const now = Date.now()
    const modules = new Map(world.shape.modules().map((m) => [m.id, m.name]))
    const coming = agents(world)
      .filter((a) => a.state === 'on')
      .flatMap((a) => {
        const next = nextRun(a.trigger, a.lastRunAt, now)
        if (!next) return []
        const moduleName = modules.get(a.module) ?? ''
        return [{ agent: a.id, name: a.name, module: a.module, moduleName, at: next.toISOString() }]
      })
      .sort((a, b) => a.at.localeCompare(b.at))
    return { since, changed, coming }
  })

  // The person cleared what changed: Today's list starts again from now.
  app.post('/api/today/seen', async () => {
    world.setPreference(user.id, 'seen_at', new Date().toISOString())
    return { ok: true }
  })

  // Activity: agents' runs and connections' reads, newest first. A run that ended having changed
  // nothing is quiet, so the window can fold it.
  const activity = (): RunView[] => {
    const names = new Map(agents(world).map((a) => [a.id, a.name]))
    const modules = new Map(world.shape.modules().map((m) => [m.id, m.name]))
    const CHANGES = new Set(['landed', 'wrote', 'changed', 'removed', 'told', 'card_opened'])
    const runs: RunView[] = (engine.hands?.runner.runs(100) ?? []).map((r) => {
      const steps = world
        .lines({
          run: r.id,
          kinds: ['run_step', 'told', 'landed', 'wrote', 'changed', 'removed', 'card_opened'],
        })
        .map((l) => ({ id: l.id, at: l.at, kind: l.kind, words: l.words }))
      return {
        id: r.id,
        kind: 'run',
        name: (r.agent && names.get(r.agent)) || 'A try',
        module: r.module ? (modules.get(r.module) ?? null) : null,
        moduleId: r.module,
        startedAt: r.startedAt,
        ms: r.endedAt ? Date.parse(r.endedAt) - Date.parse(r.startedAt) : null,
        state: r.state,
        words: r.words,
        tokens: null, // agents' scripts run without the model
        quiet: r.state === 'ok' && !steps.some((st) => CHANGES.has(st.kind)),
        steps,
      }
    })
    const reads: RunView[] = world.lines({ kinds: ['connection_read'], limit: 200 }).map((l) => ({
      id: `read-${l.id}`,
      kind: 'read',
      name: String(l.data.name ?? 'A connection'),
      module: null,
      moduleId: null,
      startedAt: new Date(Date.parse(l.at) - Number(l.data.ms ?? 0)).toISOString(),
      ms: Number(l.data.ms ?? 0),
      state: l.data.state === 'failed' ? 'failed' : 'ok',
      words: l.words,
      tokens: null,
      quiet: l.data.quiet === true,
      steps: [],
    }))
    return [...runs, ...reads].sort((a, b) => b.startedAt.localeCompare(a.startedAt)).slice(0, 200)
  }

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

  function moduleOf(id: string | null): { id: string; name: string } | null {
    const m = id ? world.shape.module(id) : undefined
    return m ? { id: m.id, name: m.name } : null
  }

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
          ...(p.source.note ? { note: p.source.note } : {}),
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

function savedView(v: View): SavedView {
  return { id: v.id, name: v.name, config: v.config, isDefault: v.isDefault, madeBy: v.madeBy }
}

function cardView(c: Card): CardView {
  const input = (c.call?.input ?? {}) as { connector?: unknown; host?: unknown }
  return {
    id: c.id,
    kind: c.kind,
    state: c.state,
    words: c.words,
    detail: c.detail,
    gate: c.gate,
    connector: c.gate === 'sign_in' && typeof input.connector === 'string' ? input.connector : null,
    site:
      c.gate === 'sign_in' && c.call?.tool === 'site_sign_in' && typeof input.host === 'string'
        ? input.host
        : null,
    options: c.options,
    cannotUndo: c.cannotUndo,
    answer: c.answer,
    restsOn: c.restsOn,
    module: c.module,
  }
}

// The window gets words, not the tools' inputs.
function shown(kind: string, data: Record<string, unknown>): Record<string, unknown> {
  if (kind === 'call') return { call: data.call }
  if (kind === 'called') return { call: data.call, ok: data.ok }
  if (kind === 'card_closed') return { state: data.state, answer: data.answer ?? null }
  if (kind === 'made' || kind === 'wrote' || kind === 'shaped') return { table: data.table ?? null }
  return {}
}
