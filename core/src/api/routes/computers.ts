// A person's computers (the Bridge): Connections › Your computers lists them with what each lends,
// makes a one-time pairing link with the download for the Bridge, and removes one. The Bridge
// pairs with its link and connects at the door (server.ts); both are reached without a session,
// the link's code and then the computer's own key being the proof. A computer acts only as its
// person (docs/rules.md, B1).
import { createReadStream, existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { extname, join } from 'node:path'
import type { FastifyReply } from 'fastify'
import { z } from 'zod'
import { bridges } from '../../bridge/hub.ts'
import { unlend } from '../../connectors/computers.ts'
import { PlainPlatform } from '../../platform/index.ts'
import { trustedKey, verifyManifest } from '../../signing.ts'
import type { Connection } from '../../world/connections.ts'
import { Refused } from '../../world/kinds.ts'
import { connectionViews } from '../connection-view.ts'
import type { ComputerPageView, ComputersView, ComputerView } from '../connector-types.ts'
import type { Ctx } from '../ctx.ts'

// What the Bridge reaches without a session: its pairing, with the link's code; its updates and
// its own files, which carry Kenil's signature and Tauri's (the app checks the latter itself).
export const PAIR = '/api/bridge/pair'
export const UPDATE = '/api/bridge/update/:platform/:current'
export const APP_FILE = '/api/bridge/app/:file'

// The Bridge's downloads, by the computer they are for.
const PLATFORMS = [
  { platform: 'darwin-arm64', title: 'Mac with an Apple chip' },
  { platform: 'win-x64', title: 'Windows' },
] as const

// A Bridge file in an Alpha's bridge folder: its version, the computer it is for, and what it is
// (an installer, an update the app takes in, or step 1's zip).
const NAME =
  /^alpha-bridge-(\d+\.\d+\.\d+)-(darwin-arm64|win-x64)(\.dmg|-setup\.exe|\.app\.tar\.gz|\.zip)$/
interface BridgeFile {
  file: string
  name: string
  version: string
  platform: string
  kind: 'installer' | 'update' | 'zip'
}
const KINDS: Record<string, BridgeFile['kind']> = {
  '.dmg': 'installer',
  '-setup.exe': 'installer',
  '.app.tar.gz': 'update',
  '.zip': 'zip',
}
const newer = (a: string, b: string) => {
  const [x, y] = [a, b].map((v) => v.split('.').map(Number))
  for (let i = 0; i < 3; i++)
    if ((x?.[i] ?? 0) !== (y?.[i] ?? 0)) return (x?.[i] ?? 0) > (y?.[i] ?? 0)
  return false
}

// What Alpha hands out is what Kenil signed: each file's signature checked once, by its time.
const held = new Map<string, { at: number; ok: boolean }>()
function signedFiles(dir: string | undefined, key = trustedKey()): BridgeFile[] {
  if (!dir || !existsSync(dir)) return []
  if (!key) return []
  return readdirSync(dir).flatMap((name) => {
    const m = NAME.exec(name)
    if (!m) return []
    const file = join(dir, name)
    const sig = `${file}.sig`
    if (!existsSync(sig)) return []
    const at = statSync(file).mtimeMs + statSync(sig).mtimeMs
    let seen = held.get(file)
    if (seen?.at !== at) {
      seen = { at, ok: verifyManifest(readFileSync(file), readFileSync(sig, 'utf8').trim(), key) }
      held.set(file, seen)
    }
    if (!seen.ok) return []
    const [, version = '', platform = '', ext = ''] = m
    return [{ file, name, version, platform, kind: KINDS[ext] ?? 'zip' }]
  })
}

// The newest of one platform's files of the first kind it has: an installer before step 1's zip.
function newest(files: BridgeFile[], platform: string, kinds: BridgeFile['kind'][]) {
  for (const kind of kinds) {
    const top = files
      .filter((f) => f.platform === platform && f.kind === kind)
      .reduce<BridgeFile | null>((a, f) => (!a || newer(f.version, a.version) ? f : a), null)
    if (top) return top
  }
  return null
}

const TYPES: Record<string, string> = {
  '.dmg': 'application/x-apple-diskimage',
  '.exe': 'application/vnd.microsoft.portable-executable',
  '.gz': 'application/gzip',
  '.zip': 'application/zip',
}
function sendFile(reply: FastifyReply, file: string, name: string) {
  reply.header('content-type', TYPES[extname(file)] ?? 'application/octet-stream')
  reply.header('content-disposition', `attachment; filename="${name}"`)
  reply.header('content-length', String(statSync(file).size))
  return reply.send(createReadStream(file))
}

export function registerComputers(ctx: Ctx): void {
  const { app, world, engine, user, options, asPerson, live } = ctx
  const address = (req: { protocol: string; headers: { host?: string | undefined } }) =>
    options.publicAddress ?? `${req.protocol}://${req.headers.host}`
  const downloads = () => {
    const files = signedFiles(options.bridgeDir, options.bridgeKey ?? trustedKey())
    return PLATFORMS.flatMap((p) => {
      const f = newest(files, p.platform, ['installer', 'zip'])
      return f
        ? [
            {
              platform: p.platform,
              title: p.title,
              url: `/api/bridge/download/${p.platform}`,
              kind: f.kind === 'installer' ? ('installer' as const) : ('zip' as const),
            },
          ]
        : []
    })
  }

  // What Alpha's own computer reads, on the Mac app: folders added by path, its Calendar and
  // Contacts. None on a server, where those run only on a person's computer.
  const hereLends = (): Connection[] =>
    world.connections.list().filter((k) => {
      const c = engine.connectors?.find(k.connector)
      return (
        !k.computer &&
        !!c &&
        (c.manifest.auth === 'path' || c.manifest.auth === 'system') &&
        !engine.connectors?.onComputer(c)
      )
    })
  const placesHere = () =>
    (engine.connectors?.known() ?? []).some(
      (c) => c.manifest.auth === 'path' && !engine.connectors?.onComputer(c),
    )
  const lendsOf = (ks: Connection[]): ComputerView['lends'] =>
    ks.map((k) => ({
      connection: k.id,
      connector: k.connector,
      title: engine.connectors?.find(k.connector)?.manifest.title ?? k.connector,
      account: k.account,
      state: k.state,
      health: k.health,
    }))
  const HERE = 'here'
  // the computer Alpha itself runs on, by what the platform says it is
  const mac = (options.platform ?? new PlainPlatform()).name === 'mac'
  const here = (): ComputerView => ({
    id: HERE,
    name: mac ? 'This Mac' : 'This computer',
    platform: mac ? 'darwin' : 'other',
    online: true,
    paused: null,
    pairedAt: null,
    lastSeenAt: null,
    version: null,
    here: true,
    browser: false,
    sites: [],
    lends: lendsOf(hereLends()),
  })
  const viewOf = (id: string): ComputerView | null => {
    if (id === HERE) return placesHere() ? here() : null
    const c = world.computers.get(id)
    if (!c || c.user !== user.id || c.removedAt) return null
    return {
      id: c.id,
      name: c.name,
      platform: c.platform,
      online: bridges.online(c.id),
      paused: bridges.pausedOf(c.id),
      pairedAt: c.pairedAt,
      lastSeenAt: c.lastSeenAt,
      version: bridges.versionOf(c.id),
      here: false,
      browser: bridges.browserOn(c.id),
      sites: (engine.hands?.browser().as(user.id).sites() ?? [])
        .filter((s) => s.computer === c.id)
        .map((s) => ({ site: s.site, at: s.at })),
      lends: lendsOf(world.connections.on(c.id)),
    }
  }

  app.get(
    '/api/computers',
    async (): Promise<ComputersView> => ({
      computers: [
        ...(placesHere() ? [here()] : []),
        ...world.computers.of(user.id).flatMap((c) => viewOf(c.id) ?? []),
      ],
      downloads: downloads(),
    }),
  )

  // A computer's own page: what it lends, each as Connections shows it, and its latest reads.
  app.get('/api/computers/:id', async (req): Promise<ComputerPageView> => {
    const { id } = z.object({ id: z.string() }).parse(req.params)
    const computer = viewOf(id)
    if (!computer) throw new Refused('That computer is not yours.')
    const ks = id === HERE ? hereLends() : world.connections.on(id)
    const view = connectionViews(ctx)
    const mine = new Set(ks.map((k) => k.id))
    const did = world
      .lines({ kinds: ['connection_read'], limit: 500 })
      .filter((l) => mine.has(String(l.data.connection)))
      .slice(0, 12)
      .map((l) => ({ id: l.id, at: l.at, words: l.words, failed: l.data.state === 'failed' }))
    return { computer, lends: ks.map(view), did }
  })

  // A link for the person's next computer, shown once and good for fifteen minutes. Any Alpha may
  // pair one for now (Kenil, 17 Nov): rows are still the firm's, so what a computer lends lands where
  // everyone signed in can read it, until every row has an owner.
  app.post('/api/computers/link', async (req) => {
    const { code, until } = world.computers.link(user.id)
    const link = `${address(req)}/?pair=${encodeURIComponent(code)}`
    // the same link for the app: the browser asks once whether to open Alpha Bridge
    const open = `alpha-bridge://pair?link=${encodeURIComponent(link)}`
    return { link, open, until, downloads: downloads() }
  })

  // Lend a folder, from Alpha's window: the computer's own picker opens there, and only what its
  // person picks is lent (docs/rules.md, B2).
  app.post('/api/computers/:id/pick', async (req) => {
    const { id } = z.object({ id: z.string() }).parse(req.params)
    const pc = world.computers.get(id)
    if (!pc || pc.user !== user.id || pc.removedAt) throw new Refused('That computer is not yours.')
    if (!bridges.pick(id, 'folder'))
      throw new Refused(`${pc.name} is not connected now, so it cannot open its folder picker.`)
    return { ok: true }
  })

  // A reader on the computer (browsing, apps, AI work) turned on or off from Alpha's window, by the
  // computer's own person: the Bridge does it and says so there (docs/rules.md, B2).
  app.post('/api/computers/:id/reader', async (req) => {
    const { id } = z.object({ id: z.string() }).parse(req.params)
    const b = z
      .object({ connector: z.enum(['browsing', 'apps', 'ai-work']), on: z.boolean() })
      .parse(req.body)
    const pc = world.computers.get(id)
    if (!pc || pc.user !== user.id || pc.removedAt) throw new Refused('That computer is not yours.')
    if (!bridges.reader(id, b.connector, b.on))
      throw new Refused(`${pc.name} is not connected now: open Alpha Bridge on it, then try again.`)
    return { ok: true }
  })

  // Removed by its person: turned away now, and what it lent stops (kept for the record).
  app.delete('/api/computers/:id', async (req) => {
    const { id } = z.object({ id: z.string() }).parse(req.params)
    const pc = world.computers.get(id)
    if (!pc || pc.user !== user.id) throw new Refused('That computer is not yours.')
    world.computers.remove(id, asPerson)
    bridges.drop(id)
    for (const k of world.connections.on(id))
      unlend(world, pc, k, `${pc.name} was removed, so this is not read any more.`)
    live()
    return { ok: true }
  })

  app.get('/api/bridge/download/:platform', async (req, reply) => {
    const { platform } = z.object({ platform: z.string() }).parse(req.params)
    const f = newest(signedFiles(options.bridgeDir, options.bridgeKey ?? trustedKey()), platform, [
      'installer',
      'zip',
    ])
    if (!f) throw new Refused('The Bridge for that computer is not on this Alpha yet.')
    return sendFile(reply, f.file, f.name.replace(/-\d+\.\d+\.\d+-/, '-'))
  })

  // The app asks for its newest version: none (204), or where it is and Tauri's signature on it.
  // On a Mac the update is the app itself, packed; on Windows the setup program.
  app.get(UPDATE, async (req, reply) => {
    const { platform, current } = z
      .object({ platform: z.string(), current: z.string().max(20) })
      .parse(req.params)
    const files = signedFiles(options.bridgeDir, options.bridgeKey ?? trustedKey())
    const f = newest(files, platform, platform.startsWith('win') ? ['installer'] : ['update'])
    const sig = f ? `${f.file}.updater.sig` : ''
    if (!f || !existsSync(sig) || !newer(f.version, current)) return reply.code(204).send()
    return {
      version: f.version,
      pub_date: new Date(statSync(f.file).mtimeMs).toISOString(),
      url: `${address(req)}/api/bridge/app/${f.name}`,
      signature: readFileSync(sig, 'utf8').trim(),
    }
  })

  app.get(APP_FILE, async (req, reply) => {
    const { file } = z.object({ file: z.string() }).parse(req.params)
    const f = signedFiles(options.bridgeDir, options.bridgeKey ?? trustedKey()).find(
      (x) => x.name === file && x.kind !== 'zip',
    )
    if (!f) return reply.code(404).send({ problem: 'There is no such Bridge here.' })
    return sendFile(reply, f.file, f.name)
  })

  // The Bridge's first word, with the link's code: its key's public half, kept against the person
  // who made the link.
  app.post('/api/bridge/pair', async (req) => {
    const b = z
      .object({
        code: z.string().min(16).max(200),
        publicKey: z.string().max(2000),
        name: z.string().max(200),
        platform: z.string().max(40),
        replaces: z.string().max(40).optional(), // this computer's own pairing before, if any
      })
      .parse(req.body)
    const pc = world.computers.pair(b.code, {
      publicKey: b.publicKey,
      name: b.name,
      platform: b.platform,
    })
    // paired again: the old pairing of this computer, its person's own, goes, and what it lent
    // follows the new one
    const old = b.replaces ? world.computers.get(b.replaces) : undefined
    if (old && old.id !== pc.id && old.user === pc.user) {
      for (const k of world.connections.on(old.id)) world.connections.runOn(k.id, pc.id)
      if (!old.removedAt)
        world.computers.remove(old.id, { actor: { kind: 'person', id: pc.user }, user: pc.user })
      bridges.drop(old.id)
    }
    live()
    return { computer: pc.id, name: pc.name, alpha: address(req) }
  })
}
