// Signing in to Alpha: the page's own routes, reached without a session,
// and Settings › People for the owner. A session is an HttpOnly cookie; a link to set a password
// is shown to the owner once, to pass on. Only an Alpha told to (sign_in in alpha.yaml) asks.
import { z } from 'zod'
import { Refused } from '../../world/kinds.ts'
import type { Ctx } from '../ctx.ts'

export const COOKIE = 'alpha_session'
export const SESSION_PATHS = new Set([
  '/api/session',
  '/api/session/link',
  '/api/session/microsoft',
])

// a cookie's value from the request's header, by its name
export function cookieIn(header: string | undefined, name: string): string | undefined {
  for (const part of (header ?? '').split(';')) {
    const [k, ...v] = part.trim().split('=')
    if (k === name) return decodeURIComponent(v.join('='))
  }
  return undefined
}

export function registerSession(ctx: Ctx): void {
  const { app, world, engine, user, options, asPerson } = ctx
  const days = options.signIn?.days ?? 30
  const signsIn = engine.connectors?.signIn
  const microsoft = () => !!signsIn?.app('microsoft')

  const cookie = (req: { protocol: string }, value: string, maxAge: number) =>
    `${COOKIE}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${
      req.protocol === 'https' || options.publicAddress ? '; Secure' : ''
    }`
  const keep = (req: { protocol: string }, token: string) => cookie(req, token, days * 86_400)
  const owner = () => {
    if (user.role !== 'owner') throw new Refused('Only the owner can do that.')
  }
  const linkFor = (
    req: { protocol: string; headers: { host?: string | undefined } },
    token: string,
  ) =>
    `${options.publicAddress ?? `${req.protocol}://${req.headers.host}`}/?link=${encodeURIComponent(token)}`

  // what the window needs before it shows anything
  app.get('/api/session', async (req) => {
    if (!options.signIn) return { signIn: false, signedIn: true, microsoft: false }
    const me = world.accounts.userOf(cookieIn(req.headers.cookie, COOKIE))
    return { signIn: true, signedIn: !!me, microsoft: microsoft() }
  })

  app.post('/api/session', async (req, reply) => {
    if (!options.signIn) throw new Refused('This Alpha does not ask anyone to sign in.')
    const b = z
      .object({ email: z.string().max(320), password: z.string().max(1000) })
      .parse(req.body)
    const token = await world.accounts.signIn(b.email, b.password, days)
    reply.header('set-cookie', keep(req, token))
    return { ok: true }
  })

  app.post('/api/session/out', async (req, reply) => {
    world.accounts.signOut(cookieIn(req.headers.cookie, COOKIE))
    reply.header('set-cookie', cookie(req, '', 0))
    return { ok: true }
  })

  app.get('/api/session/link', async (req) => {
    const { token } = z.object({ token: z.string().max(200) }).parse(req.query)
    return { link: world.accounts.linkFor(token) }
  })

  app.post('/api/session/link', async (req, reply) => {
    if (!options.signIn) throw new Refused('This Alpha does not ask anyone to sign in.')
    const b = z
      .object({
        token: z.string().max(200),
        password: z.string().max(1000),
        email: z.string().max(320).optional(),
      })
      .parse(req.body)
    const token = await world.accounts.setPassword(b.token, b.password, b.email ?? null, days)
    reply.header('set-cookie', keep(req, token))
    return { ok: true }
  })

  // Sign in with Microsoft, where the firm set up its sign-in app: the provider's own page.
  app.get('/api/session/microsoft', async (_req, reply) => {
    if (!options.signIn || !signsIn) throw new Refused('Signing in is not set up in this Alpha.')
    return reply.redirect(signsIn.startPerson('microsoft'))
  })

  // Settings › People, the owner's.
  app.get('/api/accounts', async () => {
    owner()
    return world.accounts.list()
  })
  app.post('/api/accounts', async (req) => {
    owner()
    const b = z.object({ name: z.string().max(200), email: z.string().max(320) }).parse(req.body)
    const made = world.accounts.add(b.name, b.email, asPerson)
    return { id: made.id, link: linkFor(req, made.link) }
  })
  app.post('/api/accounts/:id/link', async (req) => {
    owner()
    const { id } = z.object({ id: z.string() }).parse(req.params)
    return { link: linkFor(req, world.accounts.newLink(id, asPerson)) }
  })
  app.post('/api/accounts/:id/remove', async (req) => {
    owner()
    const { id } = z.object({ id: z.string() }).parse(req.params)
    world.accounts.remove(id, asPerson)
    return { ok: true }
  })
}
