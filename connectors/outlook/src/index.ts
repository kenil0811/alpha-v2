// Outlook: the person's Microsoft 365 mail through Microsoft Graph, signed in as them with their
// organisation's own sign-in app (step 2, part 5, Kenil's yes 30 Oct), so it reaches only their
// own mailbox. Slice 1 checks who they signed in as; reading their mail is slice 2.
import { readFileSync } from 'node:fs'
import { type Call, type Connector, Problem } from '@alpha/connector-sdk'

const GRAPH = 'https://graph.microsoft.com/v1.0'

// One Graph call as the person, with the short-lived token the core renews.
export async function graph<T>(c: Call, path: string): Promise<T> {
  const token = await c.host.secret()
  if (!token) throw new Problem('Sign in with Microsoft to finish connecting.', 'sign_in')
  const res = await fetch(`${GRAPH}${path}`, {
    headers: { authorization: `Bearer ${token}`, accept: 'application/json' },
    signal: AbortSignal.timeout(60_000),
  })
  if (res.ok) return (await res.json()) as T
  const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } }
  const said = body.error?.message ?? `${res.status} ${res.statusText}`
  if (res.status === 401)
    throw new Problem(`Microsoft no longer takes this sign-in: sign in again. (${said})`, 'sign_in')
  if (res.status === 429 || res.status === 503) {
    const after = Number(res.headers.get('retry-after'))
    throw new Problem(`Microsoft asked Alpha to wait: ${said}`, 'busy', {
      ...(after > 0 ? { retryAfterMs: after * 1000 } : {}),
    })
  }
  if (res.status === 403)
    throw new Problem(`Microsoft does not let Alpha do that for this account: ${said}`, 'blocked')
  throw new Problem(`Microsoft said no: ${said}`)
}

interface Me {
  displayName?: string
  mail?: string | null
  userPrincipalName?: string
}

export const outlook: Connector = {
  manifest: {
    name: 'outlook',
    title: 'Outlook',
    auth: 'oauth',
    oauth: { provider: 'microsoft', scopes: ['User.Read', 'Mail.Read'] },
    icon: 'mail',
    account: { label: 'Work address', placeholder: 'you@yourcompany.com' },
    pace: { perMinute: 60 },
    reaches: ['graph.microsoft.com'],
  },
  guide: readFileSync(new URL('../GUIDE.md', import.meta.url), 'utf8'),
  module: 'Mail',
  tables: [],
  tools: {},
  // who they signed in as: the account this connection is for, or sign in again as that one
  check: async (c) => {
    const me = await c.call('me', {}, () =>
      graph<Me>(c, '/me?$select=displayName,mail,userPrincipalName'),
    )
    const want = c.host.account.trim().toLowerCase()
    const is = [me.mail, me.userPrincipalName].flatMap((a) => (a ? [a.toLowerCase()] : []))
    if (!is.includes(want))
      throw new Problem(
        `You signed in to Microsoft as ${me.mail ?? me.userPrincipalName}, and this connection is for ${c.host.account}: sign in again as ${c.host.account}.`,
        'sign_in',
      )
  },
}

export const connector = outlook
