// The api the window talks to (design §2, §14): HTTP and a websocket on loopback. Every request,
// HTTP or websocket, checks its Host, its Origin and the per-install token.
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { SecretStore } from '@alpha/connector-sdk'
import fastifyStatic from '@fastify/static'
import websocket from '@fastify/websocket'
import Fastify, { type FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { Engine, EngineEvent } from '../engine/engine.ts'
import type { Install } from '../install.ts'
import type { Platform } from '../platform/index.ts'
import type { PluginRoute } from '../plugins/plugins.ts'
import type { Setup } from '../setup.ts'
import { Refused } from '../world/kinds.ts'
import type { User } from '../world/world.ts'
import type { BaseCtx, Ctx } from './ctx.ts'
import { registerActivity } from './routes/activity.ts'
import { registerCards } from './routes/cards.ts'
import { registerConnectors } from './routes/connectors.ts'
import { registerFiles } from './routes/files.ts'
import { registerKits } from './routes/kits.ts'
import { registerMe } from './routes/me.ts'
import { registerModules } from './routes/modules.ts'
import { registerPeople } from './routes/people.ts'
import { registerReadNow } from './routes/readnow.ts'
import { registerRows } from './routes/rows.ts'
import { registerRules } from './routes/rules.ts'
import { registerSettings } from './routes/settings.ts'
import { BACK, registerSignIn } from './routes/signin.ts'
import { registerStream } from './routes/stream.ts'
import { registerTables } from './routes/tables.ts'
import { registerTasks } from './routes/tasks.ts'
import { registerUsage } from './routes/usage.ts'
import type { Health } from './types.ts'
import { deny, makeViews } from './views.ts'

// The version this core ships as, which a release writes into the app's VERSION file
// (scripts/release.ts); a core run from a repository has none.
const versionFile = join(import.meta.dirname, '..', '..', '..', 'VERSION')
export const VERSION = existsSync(versionFile)
  ? readFileSync(versionFile, 'utf8').trim()
  : 'from a repository'

export interface ServerOptions {
  engine?: Engine
  user?: User
  token?: string
  ports?: number[] // the core's and the dev window's
  windowDir?: string // the built window, served at / when it is there
  browsers?: string // where the core's own browser is kept, for printing pages
  setup?: Setup // what this Mac still needs: Claude's sign-in, connections, the readers' downloads
  shell?: { seen: number } // when Alpha's Mac app last asked for notices: it shows them, not the core
  kits?: { now: string | null } // what the core is still setting up after it started listening
  connectorsDir?: string // Alpha's own connectors/: the added set, and the available packs
  platform?: Platform // the computer's own pieces; the plain one when not given
  // the person's own data (Settings › Data): where it is, and how the core restarts after a
  // restore, a bring-in or a removal (the world closed, the change applied, the process gone)
  data?: {
    home: string
    install: () => Install
    setCopy: (folder: string | null) => void
    secrets: SecretStore
    restart: (words: string, apply: () => Promise<void>) => Promise<void>
  }
  failedConnectors?: { folder: string; why: string }[] // folders that did not load at start
  plugins?: PluginRoute[] // what plugins answer, under /api/plugins/<name>/ (onboarding 4a)
}

export function buildServer(options: ServerOptions = {}): FastifyInstance {
  const app = Fastify({ bodyLimit: 200 * 1024 * 1024 })
  // the window it serves, by its index (whose asset names change with every build)
  const build = (() => {
    const index = options.windowDir ? join(options.windowDir, 'index.html') : null
    return index && existsSync(index)
      ? createHash('sha256').update(readFileSync(index)).digest('hex').slice(0, 12)
      : null
  })()
  app.get('/api/health', async (): Promise<Health> => ({ ok: true, version: VERSION, build }))

  const { engine, user, token } = options
  if (!engine || !user) return app
  const world = engine.world
  // a connection's connector, as the loaded set describes it
  const connectorOf = (name: string) => {
    if (!engine.connectors) throw new Refused('Connectors are not set up in this core.')
    return engine.connectors.connector(name)
  }
  const hosts = new Set((options.ports ?? []).flatMap((p) => [`127.0.0.1:${p}`, `localhost:${p}`]))

  // The check goes by the route the request reached and by its decoded path, never by the raw
  // address alone: Fastify decodes %61 to a before it picks the route, so /%61pi/me is /api/me
  // (item 1 of the problems list, 24 Oct).
  const pathOf = (req: { url: string; routeOptions?: { url?: string | undefined } }): string => {
    const raw = req.url.split('?')[0] ?? ''
    let decoded = raw
    try {
      decoded = decodeURIComponent(raw)
    } catch {
      decoded = raw
    }
    const route = req.routeOptions?.url ?? ''
    return [route, decoded].find((p) => p.startsWith('/api') || p.startsWith('/ws')) ?? decoded
  }
  app.addHook('onRequest', async (req, reply) => {
    const path = pathOf(req)
    if (!path.startsWith('/api') && !path.startsWith('/ws')) return
    if (path === '/api/health') return
    // the provider's page sends the person back here, without Alpha's token: its one-time state
    // is the proof (step 2, part 5); Host is still checked
    const back = path === BACK
    const host = req.headers.host ?? ''
    const origin = req.headers.origin
    const given = req.headers['x-alpha-token'] ?? (req.query as { t?: string }).t
    if (hosts.size && !hosts.has(host)) return deny(reply, 'This address is not Alpha’s.')
    if (origin && hosts.size && !hosts.has(origin.replace(/^https?:\/\//, '')))
      return deny(reply, 'This page is not Alpha’s.')
    if (token && given !== token && !back)
      return deny(reply, 'Open Alpha from the address the core printed.')
  })

  app.addContentTypeParser('*', { parseAs: 'buffer' }, (_req, body, done) => done(null, body))

  const person = { kind: 'person' as const, id: user.id }
  const live = () => engine.events.emit('event', { type: 'lines', user: user.id })
  const asPerson = { actor: person, user: user.id }
  const base: BaseCtx = { app, world, engine, user, options, person, live, asPerson, connectorOf }
  const ctx: Ctx = { ...base, views: makeViews(base) }
  registerMe(ctx)
  registerStream(ctx)
  registerCards(ctx)
  registerRules(ctx)
  registerPeople(ctx)
  registerTasks(ctx)
  registerTables(ctx)
  registerRows(ctx)
  registerFiles(ctx)
  registerConnectors(ctx)
  registerReadNow(ctx)
  registerSignIn(ctx)
  registerKits(ctx)
  registerModules(ctx)
  registerSettings(ctx)
  registerUsage(ctx)
  registerActivity(ctx)
  for (const r of options.plugins ?? [])
    app.route({
      method: r.method,
      url: r.path,
      handler: async (req) =>
        r.answer({
          params: req.params as Record<string, string>,
          query: req.query as Record<string, string>,
          body: req.body,
        }),
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
}
