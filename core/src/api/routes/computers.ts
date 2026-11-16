// A person's computers (the Bridge): Connections › Your computers lists them with what each lends,
// makes a one-time pairing link with the download for the Bridge, and removes one. The Bridge
// pairs with its link and connects at the door (server.ts); both are reached without a session,
// the link's code and then the computer's own key being the proof. A computer acts only as its
// person (docs/rules.md, B1).
import { createReadStream, existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { z } from 'zod'
import { bridges } from '../../bridge/hub.ts'
import { unlend } from '../../connectors/computers.ts'
import { trustedKey, verifyManifest } from '../../signing.ts'
import { Refused } from '../../world/kinds.ts'
import type { ComputersView } from '../connector-types.ts'
import type { Ctx } from '../ctx.ts'

// What the Bridge's pairing is reached at without a session.
export const PAIR = '/api/bridge/pair'

// The Bridge's downloads, by the computer they are for.
const PLATFORMS = [
  { platform: 'darwin-arm64', title: 'Mac with an Apple chip' },
  { platform: 'win-x64', title: 'Windows' },
] as const

// The newest Bridge for a platform in this Alpha's bridge folder, when Kenil signed it: what Alpha
// hands out is what he signed.
function bridgeFor(dir: string | undefined, platform: string): string | null {
  if (!dir || !existsSync(dir)) return null
  const zips = readdirSync(dir)
    .filter((f) => f.startsWith('alpha-bridge-') && f.endsWith(`-${platform}.zip`))
    .map((f) => join(dir, f))
    .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)
  const key = trustedKey()
  for (const zip of zips) {
    const sig = `${zip}.sig`
    if (!key || !existsSync(sig)) continue
    if (verifyManifest(readFileSync(zip), readFileSync(sig, 'utf8').trim(), key)) return zip
  }
  return null
}

export function registerComputers(ctx: Ctx): void {
  const { app, world, user, options, asPerson, live } = ctx
  const address = (req: { protocol: string; headers: { host?: string | undefined } }) =>
    options.publicAddress ?? `${req.protocol}://${req.headers.host}`
  const downloads = () =>
    PLATFORMS.filter((p) => bridgeFor(options.bridgeDir, p.platform)).map((p) => ({
      platform: p.platform,
      title: p.title,
      url: `/api/bridge/download/${p.platform}`,
    }))

  app.get(
    '/api/computers',
    async (): Promise<ComputersView> => ({
      computers: world.computers.of(user.id).map((c) => ({
        id: c.id,
        name: c.name,
        platform: c.platform,
        online: bridges.online(c.id),
        pairedAt: c.pairedAt,
        lastSeenAt: c.lastSeenAt,
        lends: world.connections.on(c.id).map((k) => ({
          connection: k.id,
          connector: k.connector,
          account: k.account,
          state: k.state,
          health: k.health,
        })),
      })),
      downloads: downloads(),
    }),
  )

  // A link for the person's next computer, shown once and good for fifteen minutes; only where one
  // person signs in, until every row has an owner (rows are the firm's today, so a second person
  // could read what the first one's computer lent)
  app.post('/api/computers/link', async (req) => {
    if (world.users().length > 1)
      throw new Refused(
        'A computer pairs only with an Alpha one person signs in to, until each row has an owner.',
      )
    const { code, until } = world.computers.link(user.id)
    return {
      link: `${address(req)}/?pair=${encodeURIComponent(code)}`,
      until,
      downloads: downloads(),
    }
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
    const zip = bridgeFor(options.bridgeDir, platform)
    if (!zip) throw new Refused('The Bridge for that computer is not on this Alpha yet.')
    reply.header('content-type', 'application/zip')
    reply.header('content-disposition', `attachment; filename="alpha-bridge-${platform}.zip"`)
    return reply.send(createReadStream(zip))
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
      })
      .parse(req.body)
    const pc = world.computers.pair(b.code, {
      publicKey: b.publicKey,
      name: b.name,
      platform: b.platform,
    })
    live()
    return { computer: pc.id, name: pc.name, alpha: address(req) }
  })
}
