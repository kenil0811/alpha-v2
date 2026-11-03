// Connecting by OAuth: the start keeps the person's app and makes a state, the callback takes only
// that state, once, and keeps the tokens as the connection's secret. The token endpoint is stubbed:
// never a real sign-in service.
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { type Connector, MemorySecrets } from '@alpha/connector-sdk'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ConnectorService } from '../connectors/service.ts'
import { Engine } from '../engine/engine.ts'
import { World } from '../world/world.ts'
import { buildServer } from './server.ts'

const books: Connector = {
  manifest: {
    name: 'books',
    title: 'Books',
    auth: 'oauth',
    account: { label: 'Company ID' },
    oauth: {
      authorize: 'https://auth.example/connect',
      token: 'https://auth.example/token',
      scope: 'accounting',
      help: 'Make an app.',
    },
    pace: { perMinute: 60 },
  },
  guide: 'The books.',
  module: 'Books',
  tables: [],
  tools: {},
  check: async (c) => {
    if (!(await c.host.secret())) throw new Error('no sign-in')
  },
}

const CALLBACK = 'http://localhost:4700/api/connectors/oauth/callback'

describe('connecting by OAuth', () => {
  let home: string
  let world: World
  let engine: Engine
  let secrets: MemorySecrets
  let svc: ConnectorService
  const token = 'secret-token'
  const ok = { host: '127.0.0.1:4700', 'x-alpha-token': token }
  const back = { host: 'localhost:4700' } // the browser, back from the sign-in: no token

  beforeEach(async () => {
    home = mkdtempSync(join(tmpdir(), 'alpha-oauth-'))
    world = await World.open(join(home, 'tenants', 't_test'))
    secrets = new MemorySecrets()
    svc = new ConnectorService(world, { secrets, known: [books] })
    engine = new Engine(world, { connectors: svc })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
    engine.close()
    world.close()
    rmSync(home, { recursive: true, force: true })
  })

  const app = () => buildServer({ engine, user: world.owner('Kenil'), token, ports: [4700, 4701] })
  const start = async (a: ReturnType<typeof app>) => {
    const res = await a.inject({
      method: 'POST',
      url: '/api/connectors/oauth/start',
      headers: ok,
      payload: { connector: 'books', account: '123', clientId: 'cid', clientSecret: 'csec' },
    })
    expect(res.statusCode).toBe(200)
    const url = new URL(res.json<{ url: string }>().url)
    return { url, state: url.searchParams.get('state') ?? '' }
  }

  it('starts with a state and the core’s own callback, the app kept in the secret store', async () => {
    const a = app()
    const { url, state } = await start(a)
    expect(url.origin + url.pathname).toBe('https://auth.example/connect')
    expect(url.searchParams.get('client_id')).toBe('cid')
    expect(url.searchParams.get('redirect_uri')).toBe(CALLBACK)
    expect(url.searchParams.get('scope')).toBe('accounting')
    expect(state.length).toBeGreaterThan(20)
    expect(JSON.parse((await secrets.get(`oauth:${state}`)) ?? '')).toEqual({
      clientId: 'cid',
      clientSecret: 'csec',
    })
    const view = (await a.inject({ url: '/api/connectors', headers: ok })).json()
    expect(view.connectors[0].oauth).toEqual({ help: 'Make an app.', redirect: CALLBACK })
    await a.close()
  })

  it('refuses a callback with no state, a made-up one, a reused one, or one too old', async () => {
    const a = app()
    const fetch = vi.fn(async () =>
      Response.json({ access_token: 'at', refresh_token: 'rt', expires_in: 3600 }),
    )
    vi.stubGlobal('fetch', fetch)
    const cb = (q: string) =>
      a.inject({ url: `/api/connectors/oauth/callback?${q}`, headers: back })
    expect((await cb('code=x')).statusCode).toBe(403)
    expect((await cb('code=x&state=made-up')).statusCode).toBe(403)
    const { state } = await start(a)
    expect((await cb(`code=x&state=${state}&realmId=123`)).statusCode).toBe(200)
    expect((await cb(`code=x&state=${state}&realmId=123`)).statusCode).toBe(403)
    vi.useFakeTimers({ toFake: ['Date'] })
    const old = await start(a)
    vi.setSystemTime(Date.now() + 11 * 60_000)
    expect((await cb(`code=x&state=${old.state}`)).statusCode).toBe(403)
    expect(await secrets.get(`oauth:${old.state}`)).toBeNull()
    expect(fetch).toHaveBeenCalledTimes(1)
    // every other address still needs the token
    expect((await a.inject({ url: '/api/connectors', headers: back })).statusCode).toBe(403)
    await a.close()
  })

  it('keeps the tokens of a good callback as the connection’s secret', async () => {
    const a = app()
    const fetch = vi.fn(async (_url: string, _init: RequestInit) =>
      Response.json({ access_token: 'at', refresh_token: 'rt', expires_in: 3600 }),
    )
    vi.stubGlobal('fetch', fetch)
    const { state } = await start(a)
    const res = await a.inject({
      url: `/api/connectors/oauth/callback?code=the-code&state=${state}&realmId=123`,
      headers: back,
    })
    expect(res.statusCode).toBe(200)
    expect(res.body).toContain('Books is connected')
    const [url, init] = fetch.mock.calls[0] ?? []
    expect(url).toBe('https://auth.example/token')
    const body = new URLSearchParams(String(init?.body))
    expect(body.get('code')).toBe('the-code')
    expect(body.get('redirect_uri')).toBe(CALLBACK)
    const conn = world.connections.list()[0]
    expect(conn?.account).toBe('123')
    expect(conn?.state).toBe('connected')
    const kept = JSON.parse((await secrets.get(conn?.secretRef ?? '')) ?? '')
    expect(kept).toMatchObject({
      clientId: 'cid',
      clientSecret: 'csec',
      refreshToken: 'rt',
      accessToken: 'at',
      extra: { realmId: '123' },
    })
    expect(await secrets.get(`oauth:${state}`)).toBeNull()
    await a.close()
  })

  it('refuses an OAuth connect with no sign-in, and keeps a rotated secret in place', async () => {
    await expect(svc.connect('books', '9', null, 'u_1')).rejects.toThrow(/signing in/)
    const conn = await svc.connect('books', '9', '{"refreshToken":"old"}', 'u_1')
    await svc.host(books, conn).setSecret?.('{"refreshToken":"new"}')
    expect(await secrets.get(conn.secretRef ?? '')).toBe('{"refreshToken":"new"}')
  })
})
