// OAuth, the authorization-code flow (design §8): the person's consent in their browser gives a
// code, the code gives tokens, and the tokens are the connection's secret (as JSON, in the secret
// store, never the world). An access token lapses and is refreshed; a refresh token may rotate on
// every refresh, so the newest is always kept.
import { type Call, Problem } from './connector.ts'

export interface OAuthApp {
  authorize: string
  token: string
  scope: string
}

export interface OAuthTokens {
  clientId: string
  clientSecret: string
  refreshToken: string
  accessToken?: string
  expiresAt?: number // ms since 1970
  extra?: Record<string, string> // what the redirect carried beside the code (an account's id)
}

// Where the person is sent to consent; state comes back on the redirect, to be checked.
export function authorizeUrl(
  app: OAuthApp,
  clientId: string,
  redirectUri: string,
  state: string,
): string {
  const u = new URL(app.authorize)
  u.search = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    scope: app.scope,
    redirect_uri: redirectUri,
    state,
  }).toString()
  return u.toString()
}

interface TokenAnswer {
  access_token: string
  refresh_token?: string
  expires_in: number
}

async function tokenCall(
  app: OAuthApp,
  client: { clientId: string; clientSecret: string },
  body: Record<string, string>,
): Promise<TokenAnswer> {
  const res = await fetch(app.token, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${client.clientId}:${client.clientSecret}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: new URLSearchParams(body).toString(),
  })
  if (res.status >= 500) throw new Error(`The sign-in service is temporarily down (${res.status}).`)
  if (!res.ok)
    throw new Problem('The sign-in was not accepted: connect this account again.', 'sign_in')
  return (await res.json()) as TokenAnswer
}

function tokensFrom(
  answer: TokenAnswer,
  was: Omit<OAuthTokens, 'accessToken' | 'expiresAt'>,
): OAuthTokens {
  return {
    ...was,
    refreshToken: answer.refresh_token ?? was.refreshToken,
    accessToken: answer.access_token,
    expiresAt: Date.now() + answer.expires_in * 1000,
  }
}

// The redirect's code, for the first tokens.
export async function exchangeCode(
  app: OAuthApp,
  client: { clientId: string; clientSecret: string },
  code: string,
  redirectUri: string,
  extra: Record<string, string> = {},
): Promise<OAuthTokens> {
  const answer = await tokenCall(app, client, {
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
  })
  return tokensFrom(answer, { ...client, refreshToken: '', extra })
}

// One refresh at a time per refresh token: two calls refreshing together would spend it twice.
const refreshing = new Map<string, Promise<OAuthTokens>>()

// A live access token for this connection, refreshed (and the newest tokens kept) when it lapses.
export async function accessToken(
  c: Call,
  app: OAuthApp,
): Promise<{ token: string; tokens: OAuthTokens }> {
  const raw = await c.host.secret()
  if (!raw) throw new Problem('This account needs connecting again.', 'sign_in')
  const tokens = JSON.parse(raw) as OAuthTokens
  if (tokens.accessToken && (tokens.expiresAt ?? 0) - 60_000 > Date.now())
    return { token: tokens.accessToken, tokens }
  const save = c.host.setSecret
  if (!save)
    throw new Problem(
      'Alpha cannot keep this account’s newest sign-in yet, so it cannot refresh it.',
      'sign_in',
    )
  let next = refreshing.get(tokens.refreshToken)
  if (!next) {
    next = (async () => {
      const answer = await tokenCall(app, tokens, {
        grant_type: 'refresh_token',
        refresh_token: tokens.refreshToken,
      })
      const fresh = tokensFrom(answer, tokens)
      await save(JSON.stringify(fresh))
      c.host.journal('Refreshed the sign-in', {
        rotated: fresh.refreshToken !== tokens.refreshToken,
      })
      return fresh
    })().finally(() => refreshing.delete(tokens.refreshToken))
    refreshing.set(tokens.refreshToken, next)
  }
  const fresh = await next
  return { token: fresh.accessToken ?? '', tokens: fresh }
}
