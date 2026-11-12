// The sites a person signed in to, for Connections' Sites: each with when, Sign in again, and Sign
// out, which deletes that profile. Signing in before any work meets a sign-in opens the same Sign
// in card a script's run meets, for this person.
import { siteOf } from '@alpha/connector-sdk'
import { z } from 'zod'
import { Refused } from '../../world/kinds.ts'
import type { Ctx } from '../ctx.ts'
import type { SiteView } from '../types.ts'

export function registerSites(ctx: Ctx): void {
  const { app, world, engine, user, live } = ctx
  const mine = () => {
    const hands = engine.hands
    if (!hands) throw new Refused('Alpha has no browser here.')
    return hands.browser().as(user.id)
  }

  app.get('/api/sites', async (): Promise<SiteView[]> => (engine.hands ? mine().sites() : []))

  app.post('/api/sites/sign-in', async (req) => {
    const { url } = z.object({ url: z.string().min(1) }).parse(req.body)
    const at = /^https?:\/\//i.test(url) ? url : `https://${url}`
    if (!URL.canParse(at)) throw new Refused(`${url} is not a site's address.`)
    const host = new URL(at).host.toLowerCase()
    const site = siteOf(host)
    const card = world.cards.open({
      kind: 'permission',
      gate: 'sign_in',
      words: `Sign in to ${site}`,
      detail: `Sign in opens ${host} in Alpha's browser, where you type your login yourself; Alpha never sees it, and reads and works on ${site} as you from then on.`,
      restsOn: [`your asking to sign in to ${site}`],
      options: ['Sign in', 'Not now'],
      call: { tool: 'site_sign_in', input: { host, url: at, schedule: null } },
      actor: { kind: 'person', id: user.id },
      user: user.id,
    })
    live()
    return { card: card.id, site }
  })

  app.post('/api/sites/sign-out', async (req) => {
    const { site } = z.object({ site: z.string().min(1) }).parse(req.body)
    if (
      !mine()
        .sites()
        .some((s) => s.site === site)
    )
      throw new Refused(`You are not signed in to ${site}.`)
    await mine().signOut(site)
    world.line({
      actor: { kind: 'person', id: user.id },
      kind: 'shaped',
      words: `Signed out of ${site}: Alpha no longer reads or works on it as you.`,
      data: { site },
      user: user.id,
    })
    live()
    return { ok: true }
  })
}
