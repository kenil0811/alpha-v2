// Signing in as the person (step 2, part 5, Kenil's yes 30 Oct): the client's own sign-in app,
// set once for the organisation; the person signing in on the provider's own page in their own
// browser, sent back to the core's address on this computer with a one-time state and PKCE, so
// only this core can use the answer; the long-lived token kept in the secret store (the Keychain)
// and out of every journal line; a short-lived token renewed here and handed to the connector's
// process, which never sees the long-lived one. Alpha acts as the person, so it reaches only what
// they can (Kenil, 30 Oct). What the provider's errors mean is its own (signin.ts in the SDK).
import { createHash, randomBytes } from 'node:crypto'
import {
  type Connector,
  codesIn,
  PROVIDERS,
  Problem,
  type Provider,
  type ProviderError,
  type SecretStore,
  type SignInApp,
} from '@alpha/connector-sdk'
import type { Connection } from '../world/connections.ts'
import { one, run, tx } from '../world/db.ts'
import { type Actor, append, keepOut, letGo } from '../world/journal.ts'
import { Refused } from '../world/kinds.ts'
import type { World } from '../world/world.ts'

const b64url = (b: Buffer) => b.toString('base64url')
const KEY = (provider: string) => `sign_in_app:${provider}`
// a sign-in started and not finished is forgotten after this; a short-lived token is renewed this
// long before it runs out
const PENDING_MS = 15 * 60_000
// all a sign-in to Alpha itself asks of the provider
const WHO = 'openid email profile'
const EARLY_MS = 5 * 60_000

export interface SignInOptions {
  secrets: SecretStore
  back: () => string // where the provider sends the person: the core's own address, with its port
  providers?: Record<string, Provider>
  now?: () => number
}

interface Pending {
  connection: string
  verifier: string
  provider: string
  scopes: string
  until: number
}

interface Tokens {
  access_token?: string
  refresh_token?: string
  expires_in?: number
  id_token?: string
}

export class SignIn {
  private world: World
  private options: SignInOptions
  private pending = new Map<string, Pending>()
  private access = new Map<string, { token: string; until: number }>()
  private renewing = new Map<string, Promise<string>>()

  constructor(world: World, options: SignInOptions) {
    this.world = world
    this.options = options
  }

  private now(): number {
    return this.options.now?.() ?? Date.now()
  }

  providers(): Provider[] {
    return Object.values(this.options.providers ?? PROVIDERS)
  }

  provider(name: string): Provider {
    const p = (this.options.providers ?? PROVIDERS)[name]
    if (!p) throw new Refused(`Alpha does not sign in to ${name}.`)
    return p
  }

  private providerOf(c: Connector): Provider {
    if (c.manifest.auth !== 'oauth' || !c.manifest.oauth)
      throw new Refused(`${c.manifest.title} does not sign in as the person.`)
    return this.provider(c.manifest.oauth.provider)
  }

  // The address IT registers: the core's, without its port (a provider matches any port on this
  // computer's own address).
  registered(): string {
    const u = new URL(this.options.back())
    u.port = ''
    return u.toString()
  }

  // The organisation's sign-in app for a provider, once IT set it up.
  app(provider: string): SignInApp | null {
    const v = one<{ value: string }>(
      this.world.db,
      'SELECT value FROM meta WHERE key = ?',
      KEY(provider),
    )
    return v ? (JSON.parse(v.value) as SignInApp) : null
  }

  setApp(provider: string, given: SignInApp, ctx: { actor: Actor; user?: string }): SignInApp {
    const p = this.provider(provider)
    const app = { app: given.app.trim(), directory: given.directory.trim() }
    for (const k of ['app', 'directory'] as const) {
      const f = p.fields[k]
      if (!f.pattern.test(app[k]))
        throw new Refused(`That is not a ${f.label}: it looks like ${f.example}.`)
    }
    tx(this.world.db, () => {
      run(
        this.world.db,
        'INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value',
        KEY(provider),
        JSON.stringify(app),
      )
      append(this.world.db, {
        actor: ctx.actor,
        kind: 'sign_in_app',
        words: `Set ${p.title}'s sign-in app for this organisation (Application ID ${app.app}).`,
        data: { provider, app: app.app, directory: app.directory },
        user: ctx.user ?? null,
      })
    })
    // tokens from another app are no use now
    this.access.clear()
    return app
  }

  // A connection can start signing in: its connector signs in as the person, and its provider's
  // app is set up.
  ready(c: Connector): void {
    const p = this.providerOf(c)
    if (!this.app(p.name))
      throw new Refused(
        `${p.title}'s sign-in app is not set up yet: set it up in Intelligence › Connections › Sign-in apps, with your IT if you are not its admin.`,
      )
  }

  private scopes(c: Connector, p: Provider): string {
    return [...(c.manifest.oauth?.scopes ?? []), ...p.always].join(' ')
  }

  // The provider's own page for signing in to Alpha itself (the clean base, step 4b): it asks only
  // who they are, and gives no token Alpha keeps.
  startPerson(provider: string): string {
    const p = this.provider(provider)
    const app = this.app(p.name)
    if (!app) throw new Refused(`${p.title}'s sign-in app is not set up in this Alpha.`)
    for (const [k, v] of this.pending) if (v.until < this.now()) this.pending.delete(k)
    const verifier = b64url(randomBytes(32))
    const state = b64url(randomBytes(24))
    this.pending.set(state, {
      connection: '',
      verifier,
      provider: p.name,
      scopes: WHO,
      until: this.now() + PENDING_MS,
    })
    const u = new URL(p.authorize(app))
    for (const [k, v] of Object.entries({
      client_id: app.app,
      response_type: 'code',
      response_mode: 'query',
      redirect_uri: this.options.back(),
      scope: WHO,
      state,
      code_challenge: b64url(createHash('sha256').update(verifier).digest()),
      code_challenge_method: 'S256',
      ...p.ask,
    }))
      u.searchParams.set(k, v)
    return u.toString()
  }

  // Whether this answer is someone signing in to Alpha, not a connection's.
  isPerson(state: string | undefined): boolean {
    return !!state && this.pending.get(state)?.connection === ''
  }

  // The provider's answer for a person signing in to Alpha: their email, as it vouches for it.
  async backPerson(q: Record<string, string | undefined>): Promise<string> {
    const pend = q.state ? this.pending.get(q.state) : undefined
    if (q.state) this.pending.delete(q.state)
    if (!pend || pend.until < this.now())
      throw new Refused('This sign-in is too old: start it again from Alpha.')
    const p = this.provider(pend.provider)
    const app = this.app(p.name)
    if (!app || !q.code) throw new Refused(q.error_description ?? 'The sign-in did not finish.')
    const t = await this.trade(p, app, {
      grant_type: 'authorization_code',
      code: q.code,
      redirect_uri: this.options.back(),
      code_verifier: pend.verifier,
      scope: pend.scopes,
    })
    // straight from the provider's token address over TLS, so its signature needs no second check
    const claims = JSON.parse(
      Buffer.from((t.id_token ?? '').split('.')[1] ?? '', 'base64url').toString() || '{}',
    ) as { email?: string; preferred_username?: string }
    const email = claims.email ?? claims.preferred_username
    if (!email) throw new Refused('Microsoft did not say which account signed in.')
    return email
  }

  // The provider's own sign-in page for this connection: where the person signs in themselves.
  start(conn: Connection, c: Connector): string {
    this.ready(c)
    const p = this.providerOf(c)
    const app = this.app(p.name) as SignInApp
    for (const [k, v] of this.pending) if (v.until < this.now()) this.pending.delete(k)
    const verifier = b64url(randomBytes(32))
    const state = b64url(randomBytes(24))
    const scopes = this.scopes(c, p)
    this.pending.set(state, {
      connection: conn.id,
      verifier,
      provider: p.name,
      scopes,
      until: this.now() + PENDING_MS,
    })
    const u = new URL(p.authorize(app))
    for (const [k, v] of Object.entries({
      client_id: app.app,
      response_type: 'code',
      response_mode: 'query',
      redirect_uri: this.options.back(),
      scope: scopes,
      state,
      code_challenge: b64url(createHash('sha256').update(verifier).digest()),
      code_challenge_method: 'S256',
      login_hint: conn.account,
      ...p.ask,
    }))
      u.searchParams.set(k, v)
    return u.toString()
  }

  // The person back from the provider's page: its answer traded for tokens, kept. Which
  // connection it was for, or a Problem in words (said no, IT's approval missing).
  async back(
    q: Record<string, string | undefined>,
  ): Promise<{ connection: string; problem: Problem | null }> {
    const pend = q.state ? this.pending.get(q.state) : undefined
    if (q.state) this.pending.delete(q.state)
    if (!pend || pend.until < this.now())
      throw new Refused(
        'This sign-in is not one Alpha started, or it was started more than 15 minutes ago: start it again from Alpha.',
      )
    const p = this.provider(pend.provider)
    const app = this.app(p.name)
    if (!app) throw new Refused(`${p.title}'s sign-in app is no longer set up.`)
    const conn = this.world.connections.get(pend.connection)
    if (!conn) throw new Refused('The connection this sign-in was for is gone.')
    try {
      if (q.error || !q.code) {
        const description = q.error_description ?? ''
        throw this.problem(p, {
          error: q.error ?? 'no_code',
          description,
          codes: codesIn(description),
        })
      }
      const t = await this.trade(p, app, {
        grant_type: 'authorization_code',
        code: q.code,
        redirect_uri: this.options.back(),
        code_verifier: pend.verifier,
        scope: pend.scopes,
      })
      await this.keep(conn, t)
      return { connection: conn.id, problem: null }
    } catch (err) {
      if (err instanceof Problem) return { connection: conn.id, problem: err }
      throw err
    }
  }

  // A short-lived token for the connector's call: the one held while it lasts, else renewed with
  // the long-lived one (one renewal at a time per connection: each use replaces it).
  token(conn: Connection, c: Connector): Promise<string> {
    const held = this.access.get(conn.id)
    if (held && held.until - EARLY_MS > this.now()) return Promise.resolve(held.token)
    const running = this.renewing.get(conn.id)
    if (running) return running
    const p = this.renew(conn, c).finally(() => this.renewing.delete(conn.id))
    this.renewing.set(conn.id, p)
    return p
  }

  private async renew(conn: Connection, c: Connector): Promise<string> {
    const p = this.providerOf(c)
    const app = this.app(p.name)
    if (!app)
      throw new Problem(
        `${p.title}'s sign-in app is not set up: Intelligence › Connections › Sign-in apps.`,
      )
    const kept = conn.secretRef ? await this.options.secrets.get(conn.secretRef) : null
    if (!kept) throw new Problem(`Sign in with ${p.title} to finish connecting.`, 'sign_in')
    keepOut(kept)
    const t = await this.trade(p, app, {
      grant_type: 'refresh_token',
      refresh_token: kept,
      scope: this.scopes(c, p),
    })
    await this.keep(conn, t)
    return this.access.get(conn.id)?.token as string
  }

  // A held short-lived token dropped, so the next call renews it (Read now: a revoked sign-in
  // shows at once rather than when the token runs out).
  forget(connection: string): void {
    const held = this.access.get(connection)
    if (held) letGo(held.token)
    this.access.delete(connection)
  }

  private async keep(conn: Connection, t: Tokens): Promise<void> {
    if (!t.access_token) throw new Problem('The sign-in gave Alpha no token.')
    keepOut(t.access_token)
    if (t.refresh_token) {
      keepOut(t.refresh_token)
      if (!conn.secretRef) throw new Problem('This connection has no place to keep its sign-in.')
      await this.options.secrets.set(conn.secretRef, t.refresh_token)
    }
    this.forget(conn.id)
    this.access.set(conn.id, {
      token: t.access_token,
      until: this.now() + (t.expires_in ?? 3600) * 1000,
    })
  }

  private async trade(p: Provider, app: SignInApp, form: Record<string, string>): Promise<Tokens> {
    let res: Response
    try {
      res = await fetch(p.token(app), {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ client_id: app.app, ...form }).toString(),
        signal: AbortSignal.timeout(30_000),
      })
    } catch (err) {
      throw new Problem(
        `Alpha could not reach ${p.title}'s sign-in: ${err instanceof Error ? err.message : String(err)}`,
      )
    }
    const body = (await res.json().catch(() => ({}))) as Tokens & {
      error?: string
      error_description?: string
      error_codes?: number[]
    }
    if (!res.ok || body.error) {
      const description = body.error_description ?? `${res.status}`
      throw this.problem(p, {
        error: body.error ?? `http_${res.status}`,
        description,
        codes: body.error_codes ?? codesIn(description),
      })
    }
    return body
  }

  private problem(p: Provider, e: ProviderError): Problem {
    const x = p.explain(e)
    return new Problem(x.words, x.kind === 'app' ? 'other' : x.kind)
  }
}
