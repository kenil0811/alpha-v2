// Signing in as the person: the organisation's sign-in apps, set once by its IT
// from the setup sheet, and the page the provider sends the person back to. That page is the one
// address under /api reached without Alpha's token, as the provider's page cannot carry it: the
// one-time state it brings back is what proves the sign-in is this core's own.
import { z } from 'zod'
import { Refused } from '../../world/kinds.ts'
import type { BaseCtx } from '../ctx.ts'
import type { SignInAppView } from '../types.ts'
import { COOKIE } from './session.ts'

export const BACK = '/api/sign-in/back'

// The providers the loaded connectors sign in with, each with its app once set.
export function signInApps(ctx: BaseCtx): SignInAppView[] {
  const signIn = ctx.engine.connectors?.signIn
  if (!signIn) return []
  const used = new Set(
    (ctx.engine.connectors?.known() ?? []).flatMap((c) =>
      c.manifest.auth === 'oauth' && c.manifest.oauth ? [c.manifest.oauth.provider] : [],
    ),
  )
  return signIn
    .providers()
    .filter((p) => used.has(p.name))
    .map((p) => ({
      provider: p.name,
      title: p.title,
      set: signIn.app(p.name),
      fields: {
        app: { label: p.fields.app.label, example: p.fields.app.example },
        directory: { label: p.fields.directory.label, example: p.fields.directory.example },
      },
      sheet: p.sheet(signIn.registered(), 'your organisation'),
      console: p.console,
    }))
}

const page = (title: string, words: string, ok: boolean) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<style>
:root{color-scheme:light dark;--ink:#1c1b19;--ink2:#5f5b55;--bg:#faf9f7;--line:#e5e2dc;--mark:${ok ? '#2f7d4f' : '#a8642a'}}
@media (prefers-color-scheme:dark){:root{--ink:#ecebe8;--ink2:#a3a09a;--bg:#1b1a19;--line:#33312e;--mark:${ok ? '#6cc08b' : '#e0a060'}}}
body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;display:grid;place-items:center;min-height:100vh}
main{max-width:28rem;margin:1rem;padding:1.5rem;border:1px solid var(--line);border-radius:10px}
h1{font-size:17px;font-weight:600;margin:0 0 .5rem;display:flex;gap:.5rem;align-items:center}
h1::before{content:"";width:8px;height:8px;border-radius:50%;background:var(--mark)}
p{margin:0;color:var(--ink2)}
</style></head><body><main><h1>${title}</h1><p>${words}</p></main></body></html>`

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)

export function registerSignIn(ctx: BaseCtx): void {
  const { app, engine, live, asPerson, options, world } = ctx

  app.post('/api/sign-in-apps/:provider', async (req) => {
    const { provider } = z.object({ provider: z.string() }).parse(req.params)
    const b = z.object({ app: z.string(), directory: z.string() }).parse(req.body)
    const signIn = engine.connectors?.signIn
    if (!signIn) throw new Refused('Signing in is not set up in this core.')
    const set = signIn.setApp(provider, b, asPerson)
    live()
    return { set }
  })

  // The provider's page sends the person here: its answer traded for tokens, the connection
  // checked, and the outcome said where they are looking (their browser), and in Alpha.
  app.get(BACK, async (req, reply) => {
    const q = z.record(z.string(), z.string()).parse(req.query)
    const service = engine.connectors
    const signIn = service?.signIn
    reply.type('text/html; charset=utf-8')
    if (!service || !signIn)
      return page('Not signed in', 'Signing in is not set up in this Alpha.', false)
    // someone signing in to Alpha itself, not connecting an account
    if (options.signIn && signIn.isPerson(q.state)) {
      try {
        const email = await signIn.backPerson(q)
        const token = world.accounts.signInByEmail(email, options.signIn.days)
        if (!token)
          return page(
            'Not signed in',
            `${esc(email)} has no account in this Alpha. Ask its owner to add you.`,
            false,
          )
        reply.header(
          'set-cookie',
          `${COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${
            options.signIn.days * 86_400
          }${req.protocol === 'https' ? '; Secure' : ''}`,
        )
        return reply.redirect('/')
      } catch (err) {
        return page('Not signed in', esc(err instanceof Error ? err.message : String(err)), false)
      }
    }
    let out: Awaited<ReturnType<typeof signIn.back>>
    try {
      out = await signIn.back(q)
    } catch (err) {
      return page('Not signed in', esc(err instanceof Error ? err.message : String(err)), false)
    }
    if (out.problem) {
      service.failed(out.connection, out.problem)
      live()
      return page('Not signed in yet', esc(out.problem.message), false)
    }
    const conn = await service.checkNow(out.connection)
    live()
    const title = service.find(conn.connector)?.manifest.title ?? conn.connector
    return conn.state === 'connected'
      ? page(
          'Signed in',
          `${esc(title)} is connected for ${esc(conn.account)}. You can close this tab and go back to Alpha.`,
          true,
        )
      : page('Not connected yet', esc(conn.health ?? 'Go back to Alpha and try again.'), false)
  })
}
