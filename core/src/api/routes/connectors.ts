import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { type Connector, chromePath } from '@alpha/connector-sdk'
import { z } from 'zod'
import {
  addFolder,
  available,
  loadConnector,
  removeFolder,
  unpack,
} from '../../connectors/discover.ts'
import { FOLDERS, isDeveloper } from '../../signing.ts'
import { Refused } from '../../world/kinds.ts'
import type { Ctx } from '../ctx.ts'
import type { ConnectorsView } from '../types.ts'

export function registerConnectors(ctx: Ctx): void {
  const { app, world, engine, user, options, person, live, connectorOf, asPerson } = ctx

  // the hosts each connector was refused, newest first, once each (step 2, part 1, slice 2)
  const refusals = () => {
    const by = new Map<string, { host: string; at: string }[]>()
    for (const l of world.lines({ kinds: ['reach_refused'], limit: 500 }).reverse()) {
      const name = String(l.data.connector)
      const list = by.get(name) ?? []
      if (!list.some((r) => r.host === l.data.host) && list.length < 5)
        list.push({ host: String(l.data.host), at: l.at })
      by.set(name, list)
    }
    return by
  }

  app.get('/api/connectors', async (): Promise<ConnectorsView> => {
    const refused = refusals()
    return {
      connectors: (engine.connectors?.known() ?? []).map((c) => ({
        name: c.manifest.name,
        title: c.manifest.title,
        auth: c.manifest.auth,
        icon: c.manifest.icon ?? 'plug',
        account: c.manifest.account,
        ...(c.manifest.secret ? { secret: c.manifest.secret } : {}),
        ...(c.manifest.system ? { system: c.manifest.system } : {}),
        ...(c.manifest.setup ? { setup: c.manifest.setup } : {}),
        ...(c.manifest.warning ? { warning: c.manifest.warning } : {}),
      })),
      connections: world.connections.list().map((k) => {
        const c = engine.connectors?.find(k.connector)
        return {
          id: k.id,
          connector: k.connector,
          title: c?.manifest.title ?? k.connector,
          account: k.account,
          inBrowser: c?.manifest.auth === 'browser',
          loaded: !!c,
          state: k.state,
          health: c
            ? k.health
            : 'Its connector is not loaded: add it below, and this connection reads again.',
          lastSyncAt: k.lastSyncAt,
          settings: k.state === 'needs_sign_in' ? (c?.manifest.system?.pane ?? null) : null,
          tables: (c?.tables ?? []).flatMap((spec) => {
            const t = world.shape.table(spec.name)
            return t ? [{ id: t.id, name: t.name, hidden: t.hidden }] : []
          }),
          reaches: [...new Set([...(c?.manifest.reaches ?? []), ...k.hosts])],
          refused: refused.get(k.connector) ?? [],
          canAllow: !!c?.manifest.chosenSites,
        }
      }),
      available: options.connectorsDir ? available(options.connectorsDir) : [],
      added: options.connectorsDir
        ? (engine.connectors?.known() ?? [])
            .filter((c) => existsSync(join(options.connectorsDir ?? '', c.manifest.name)))
            .map((c) => c.manifest.name)
        : [],
      failed: options.failedConnectors ?? [],
    }
  })

  // A host the person allows a connection to reach, from a refusal beside it: only for a connector
  // that reads sites they choose (call 2 of step 2, part 1).
  app.post('/api/connections/:id/allow', async (req) => {
    const { id } = req.params as { id: string }
    const { host } = z
      .object({ host: z.string().regex(/^[a-z0-9.-]+(:\d{1,5})?$/i) })
      .parse(req.body)
    const k = world.connections.get(id)
    if (!k) throw new Refused('That connection is not there.')
    if (!engine.connectors?.find(k.connector)?.manifest.chosenSites)
      throw new Refused('This connector reaches only the hosts it names.')
    world.connections.approve(id, host, asPerson)
    live()
    return { ok: true }
  })

  // A connector added without a restart (decision 10): from a folder, from a pack sent as a
  // file, or one of the packs that came with the release; it lands in Alpha's own connectors/
  // and joins the loaded set, with a journal line. Removed again when nothing is connected
  // through it; its folder goes with it.
  const addConnector = async (
    fn: () => Promise<{ name: string; dir: string }> | { name: string; dir: string },
  ) => {
    const service = engine.connectors
    if (!service || !options.connectorsDir)
      throw new Refused('Connectors cannot be added in this core.')
    const { name, dir } = await fn()
    let loaded: Connector[]
    try {
      loaded = await loadConnector(
        dir,
        service.known().map((c) => c.manifest.name),
      )
    } catch (err) {
      rmSync(dir, { recursive: true, force: true })
      throw new Refused(
        `That is not a connector Alpha can load: ${err instanceof Error ? err.message : String(err)}`,
      )
    }
    for (const c of loaded) service.add(c)
    const titles = loaded.map((c) => c.manifest.title).join(' and ')
    world.line({
      actor: person,
      kind: 'connector_added',
      words: `Added the connector ${titles}.`,
      data: { name, connectors: loaded.map((c) => c.manifest.name) },
      user: user.id,
    })
    live()
    return { name, title: titles }
  }
  app.post('/api/connectors', async (req) => {
    const { folder } = z.object({ folder: z.string().trim().min(1) }).parse(req.body)
    if (!isDeveloper(world, user.id)) throw new Refused(FOLDERS)
    return addConnector(() => addFolder(folder, options.connectorsDir ?? ''))
  })
  app.post('/api/connectors/pack', async (req) => {
    const name = decodeURIComponent(
      String(req.headers['x-file-name'] ?? 'connector.alphaconnector'),
    )
    const dir = mkdtempSync(join(tmpdir(), 'alpha-connector-'))
    try {
      const file = join(dir, name.replace(/[^\w.-]/g, '_'))
      writeFileSync(file, req.body as Buffer)
      return await addConnector(() =>
        unpack(file, options.connectorsDir ?? '', { developer: isDeveloper(world, user.id) }),
      )
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
  app.post('/api/connectors/available', async (req) => {
    const { name } = z.object({ name: z.string() }).parse(req.body)
    const found = (options.connectorsDir ? available(options.connectorsDir) : []).find(
      (p) => p.name === name,
    )
    if (!found) throw new Refused('That pack is not among the ones that came with Alpha.')
    return addConnector(() =>
      unpack(found.file, options.connectorsDir ?? '', { developer: isDeveloper(world, user.id) }),
    )
  })
  app.delete('/api/connectors/:name', async (req) => {
    const { name } = z.object({ name: z.string() }).parse(req.params)
    const service = engine.connectors
    if (!service || !options.connectorsDir)
      throw new Refused('Connectors cannot be removed in this core.')
    if (!existsSync(join(options.connectorsDir, name)))
      throw new Refused(
        'Only a connector that was added can be removed; the ones Alpha ships stay.',
      )
    const c = service.drop(name)
    removeFolder(options.connectorsDir, name)
    world.line({
      actor: person,
      kind: 'connector_removed',
      words: `Removed the connector ${c.manifest.title}.`,
      data: { name },
      user: user.id,
    })
    live()
    return { ok: true }
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
    // a secret the person signs in with never reaches a journal line (step 2, part 3)
    if (b.secret) world.keepOut(b.secret)
    const c = await engine.connect(user, b.connector, b.account, b.secret ?? null)
    return { id: c.id, state: c.state }
  })

  app.delete('/api/connections/:id', async (req) => {
    const { id } = z.object({ id: z.string() }).parse(req.params)
    await engine.disconnect(user, id)
    return { ok: true }
  })

  // A connection read as the person (LinkedIn): its site opens in its own window of Google Chrome,
  // where they sign in themselves; when they quit it, the connection is read.
  app.post('/api/connections/:id/sign-in', async (req) => {
    const { id } = z.object({ id: z.string() }).parse(req.params)
    const conn = world.connections.get(id)
    if (!conn) throw new Refused('That connection is not there.')
    const c = connectorOf(conn.connector)
    const url = c.manifest.signIn
    if (c.manifest.auth !== 'browser' || !url)
      throw new Refused(`${c.manifest.title} is not signed in to in a browser.`)
    const hands = engine.hands
    if (!hands) throw new Refused('Alpha has no browser here.')
    if (!chromePath()) throw new Refused('Signing in to a site needs Google Chrome on this Mac.')
    void (async () => {
      await hands.browser().signIn(url)
      await engine.sync(user, id).catch(() => undefined)
      live()
    })().catch(() => undefined)
    return { opened: true }
  })

  app.post('/api/connections/:id/sync', async (req) => {
    const { id } = z.object({ id: z.string() }).parse(req.params)
    await engine.sync(user, id)
    return { ok: true }
  })
}
