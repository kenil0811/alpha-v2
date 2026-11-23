// Signing in as the person, against a made-up sign-in service on this computer:
// never a real tenant. Its pages answer as Microsoft's do: the sign-in page sends the person back
// with a code, the token address trades it (checking PKCE), renews, and refuses as told.
import { createHash } from 'node:crypto'
import { mkdtempSync, rmSync } from 'node:fs'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  type Connector,
  intuit,
  MemorySecrets,
  microsoft,
  Problem,
  type Provider,
} from '@alpha/connector-sdk'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { World } from '../world/world.ts'
import { ConnectorService } from './service.ts'
import { SignIn } from './signin.ts'

let home: string
let world: World
let secrets: MemorySecrets
let server: Server
let base: string
let clock: number
// what the made-up service does next
const svc = {
  challenge: '',
  refreshes: 0,
  refusal: null as null | { error: string; error_codes: number[]; error_description: string },
  issued: [] as string[],
  who: 'priya@bridge.example.com',
  realm: '9341455130166501', // the company Intuit's page says was picked
}

beforeEach(async () => {
  home = mkdtempSync(join(tmpdir(), 'alpha-signin-'))
  world = await World.open(join(home, 'tenants', 't_test'))
  secrets = new MemorySecrets()
  clock = Date.parse('2026-10-30T15:00:00Z')
  svc.challenge = ''
  svc.refreshes = 0
  svc.refusal = null
  svc.issued = []
  server = createServer((req, res) => {
    const u = new URL(req.url ?? '/', 'http://x')
    if (u.pathname.endsWith('/authorize')) {
      svc.challenge = u.searchParams.get('code_challenge') ?? ''
      const back = new URL(u.searchParams.get('redirect_uri') ?? '')
      back.searchParams.set('code', 'the-code')
      back.searchParams.set('state', u.searchParams.get('state') ?? '')
      if (u.pathname.startsWith('/intuit/')) back.searchParams.set('realmId', svc.realm)
      res.writeHead(302, { location: back.toString() }).end()
      return
    }
    let body = ''
    req.on('data', (d) => {
      body += d
    })
    req.on('end', () => {
      const f = new URLSearchParams(body)
      const answer = (status: number, json: unknown) =>
        res.writeHead(status, { 'content-type': 'application/json' }).end(JSON.stringify(json))
      if (svc.refusal) return answer(400, svc.refusal)
      // Intuit's: the app proves itself with its secret, as basic credentials, and no PKCE
      if (u.pathname.startsWith('/intuit/')) {
        const good = `Basic ${Buffer.from(`${INTUIT_APP.app}:${INTUIT_SECRET}`).toString('base64')}`
        if (req.headers.authorization !== good || f.get('client_id') || f.get('code_verifier'))
          return answer(401, { error: 'invalid_client' })
        if (f.get('grant_type') === 'authorization_code' && f.get('code') !== 'the-code')
          return answer(400, { error: 'invalid_grant' })
        svc.refreshes += f.get('grant_type') === 'refresh_token' ? 1 : 0
        const n = svc.refreshes + 1
        svc.issued.push(`access-${n}`, `refresh-${n}`)
        return answer(200, {
          access_token: `access-${n}`,
          refresh_token: `refresh-${n}`,
          expires_in: 3600,
          x_refresh_token_expires_in: 8_640_000,
        })
      }
      if (f.get('grant_type') === 'authorization_code') {
        const sent = createHash('sha256')
          .update(f.get('code_verifier') ?? '')
          .digest('base64url')
        if (f.get('code') !== 'the-code' || sent !== svc.challenge)
          return answer(400, {
            error: 'invalid_grant',
            error_codes: [70000],
            error_description: 'AADSTS70000: bad code.',
          })
        svc.issued.push('access-1', 'refresh-1')
        return answer(200, {
          access_token: 'access-1',
          refresh_token: 'refresh-1',
          expires_in: 3600,
          id_token: `x.${Buffer.from(JSON.stringify({ preferred_username: svc.who })).toString('base64url')}.y`,
        })
      }
      svc.refreshes++
      const n = svc.refreshes + 1
      svc.issued.push(`access-${n}`, `refresh-${n}`)
      return answer(200, {
        access_token: `access-${n}`,
        refresh_token: `refresh-${n}`,
        expires_in: 3600,
      })
    })
  })
  await new Promise<void>((ok) => server.listen(0, '127.0.0.1', ok))
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})

afterEach(async () => {
  world.close()
  await new Promise((ok) => server.close(ok))
  rmSync(home, { recursive: true, force: true })
})

// Microsoft, at the made-up service's address
const madeUp = (): Provider => ({
  ...microsoft,
  authorize: (a) => `${base}/${a.directory}/authorize`,
  token: (a) => `${base}/${a.directory}/token`,
})

// Intuit, at the made-up service's address
const madeUpIntuit = (): Provider => ({
  ...intuit,
  authorize: () => `${base}/intuit/authorize`,
  token: () => `${base}/intuit/token`,
})
const INTUIT_APP = { app: 'ABcdEFgh1234567890ijklMNOP' }
const INTUIT_SECRET = 'S3cretS3cretS3cretS3cretS3cret12'

let checked: (string | null)[] = []
const mail: Connector = {
  manifest: {
    name: 'work-mail',
    title: 'Work mail',
    auth: 'oauth',
    oauth: { provider: 'microsoft', scopes: ['User.Read', 'Mail.Read'] },
    account: { label: 'Work address' },
    pace: { perMinute: 60 },
  },
  guide: 'Work mail.',
  module: 'Mail',
  tables: [],
  tools: {},
  check: async (c) => {
    checked.push(await c.host.secret())
  },
}

// a made-up QuickBooks: a client company's books, through the firm's own Intuit app
let places: (string | null | undefined)[] = []
const books: Connector = {
  manifest: {
    name: 'books',
    title: 'Books',
    auth: 'oauth',
    oauth: { provider: 'intuit', scopes: ['com.intuit.quickbooks.accounting'] },
    account: { label: 'Client' },
    pace: { perMinute: 60 },
  },
  guide: 'Books.',
  module: 'Books',
  tables: [],
  tools: {},
  check: async (c) => {
    checked.push(await c.host.secret())
    places.push(c.host.place)
  },
}

const APP = { app: '1a2b3c4d-1111-2222-3333-444455556666', directory: 'bridge.example.com' }
const kenil = () => ({ actor: { kind: 'person' as const, id: world.owner('Kenil').id } })

function setUp() {
  checked = []
  places = []
  const signIn = new SignIn(world, {
    secrets,
    back: () => 'http://localhost:4700/api/sign-in/back',
    providers: { microsoft: madeUp(), intuit: madeUpIntuit() },
    now: () => clock,
  })
  const service = new ConnectorService(world, { secrets, known: [mail, books], signIn })
  return { signIn, service }
}

// the person's browser: the sign-in page, then back to the address it names
async function signInAs(signIn: SignIn, url: string) {
  const res = await fetch(url, { redirect: 'manual' })
  const back = new URL(res.headers.get('location') ?? '')
  expect(`${back.origin}${back.pathname}`).toBe('http://localhost:4700/api/sign-in/back')
  return signIn.back(Object.fromEntries(back.searchParams))
}

describe('the organisation’s sign-in app', () => {
  it('signs a person in to Alpha by who the provider says they are, keeping no token', async () => {
    const { signIn } = setUp()
    await signIn.setApp('microsoft', APP, kenil())
    const url = new URL(signIn.startPerson('microsoft'))
    expect(url.searchParams.get('scope')).toBe('openid email profile')
    const state = url.searchParams.get('state') ?? ''
    expect(signIn.isPerson(state)).toBe(true)
    const res = await fetch(url.toString(), { redirect: 'manual' })
    const back = new URL(res.headers.get('location') ?? '')
    await expect(signIn.backPerson(Object.fromEntries(back.searchParams))).resolves.toBe(
      'priya@bridge.example.com',
    )
    expect(signIn.isPerson(state)).toBe(false) // spent
    expect(JSON.stringify(world.lines({}))).not.toContain('access-1')
  })

  it('is set once, checked for what its ids look like, and journaled', async () => {
    const { signIn } = setUp()
    await expect(
      signIn.setApp('microsoft', { app: 'not-an-id', directory: APP.directory }, kenil()),
    ).rejects.toThrow(/Application \(client\) ID/)
    await signIn.setApp('microsoft', APP, kenil())
    expect(signIn.app('microsoft')).toEqual(APP)
    expect(world.lines({ kinds: ['sign_in_app'] })[0]?.words).toMatch(/Microsoft's sign-in app/)
    expect(signIn.registered()).toBe('http://localhost/api/sign-in/back')
  })

  it('must be there before a connection signs in', async () => {
    const { service } = setUp()
    const conn = await service.connect('work-mail', 'test@bridge.example.com', null, 'u')
    expect(() => service.signIn?.start(conn, mail)).toThrow(/sign-in app is not set up/)
  })
})

describe('signing in as the person', () => {
  it('waits for the sign-in, then connects with a short-lived token the connector gets', async () => {
    const { signIn, service } = setUp()
    await signIn.setApp('microsoft', APP, kenil())
    const conn = await service.connect('work-mail', 'test@bridge.example.com', null, 'u')
    expect(conn.state).toBe('needs_sign_in')
    expect(checked).toEqual([]) // nothing to check with yet
    const url = new URL(signIn.start(conn, mail))
    expect(url.searchParams.get('client_id')).toBe(APP.app)
    expect(url.searchParams.get('login_hint')).toBe('test@bridge.example.com')
    expect(url.searchParams.get('code_challenge_method')).toBe('S256')
    expect(url.searchParams.get('scope')).toBe('User.Read Mail.Read offline_access')
    const out = await signInAs(signIn, url.toString())
    expect(out).toEqual({ connection: conn.id, problem: null })
    const after = await service.checkNow(conn.id)
    expect(after.state).toBe('connected')
    expect(checked).toEqual(['access-1'])
    // the long-lived one is kept in the secret store, and no line carries either
    expect(await secrets.get(conn.secretRef ?? '')).toBe('refresh-1')
    const all = JSON.stringify(world.lines({}))
    for (const t of svc.issued) expect(all).not.toContain(t)
    expect(() =>
      world.line({ actor: { kind: 'system' }, kind: 'said', words: 'the token is refresh-1' }),
    ).toThrow(/secret/)
  })

  it('renews the short-lived token before it runs out, and keeps the new long-lived one', async () => {
    const { signIn, service } = setUp()
    await signIn.setApp('microsoft', APP, kenil())
    const conn = await service.connect('work-mail', 'test@bridge.example.com', null, 'u')
    await signInAs(signIn, signIn.start(conn, mail))
    await service.checkNow(conn.id)
    clock += 30 * 60_000
    await service.checkNow(conn.id)
    expect(svc.refreshes).toBe(0)
    clock += 28 * 60_000 // within five minutes of its end
    const [a, b] = await Promise.all([service.checkNow(conn.id), service.checkNow(conn.id)])
    expect(a.state).toBe('connected')
    expect(b.state).toBe('connected')
    expect(svc.refreshes).toBe(1) // one renewal, however many ask
    expect(checked.at(-1)).toBe('access-2')
    expect(await secrets.get(conn.secretRef ?? '')).toBe('refresh-2')
  })

  it('asks the person to sign in again when the provider no longer takes the sign-in', async () => {
    const { signIn, service } = setUp()
    await signIn.setApp('microsoft', APP, kenil())
    const conn = await service.connect('work-mail', 'test@bridge.example.com', null, 'u')
    await signInAs(signIn, signIn.start(conn, mail))
    await service.checkNow(conn.id)
    svc.refusal = {
      error: 'invalid_grant',
      error_codes: [50173],
      error_description:
        'AADSTS50173: The provided grant has expired due to it being revoked. Trace ID: 1234',
    }
    signIn.forget(conn.id)
    const after = await service.checkNow(conn.id)
    expect(after.state).toBe('needs_sign_in')
    expect(after.health).toBe(
      'Microsoft asks you to sign in again: The provided grant has expired due to it being revoked.',
    )
  })

  it('waits for the customer when IT has to approve the app first', async () => {
    const { signIn, service } = setUp()
    await signIn.setApp('microsoft', APP, kenil())
    const conn = await service.connect('work-mail', 'test@bridge.example.com', null, 'u')
    svc.refusal = {
      error: 'invalid_grant',
      error_codes: [65001],
      error_description:
        'AADSTS65001: The user or administrator has not consented to use the application.',
    }
    const out = await signInAs(signIn, signIn.start(conn, mail))
    expect(out.problem).toBeInstanceOf(Problem)
    expect(out.problem?.kind).toBe('waiting')
    service.failed(conn.id, out.problem as Problem)
    const after = world.connections.get(conn.id)
    expect(after?.state).toBe('waiting')
    expect(after?.health).toMatch(/Your IT has to approve Alpha/)
  })

  it('says no in the person’s words when they decline on the provider’s page', async () => {
    const { signIn, service } = setUp()
    await signIn.setApp('microsoft', APP, kenil())
    const conn = await service.connect('work-mail', 'test@bridge.example.com', null, 'u')
    const url = new URL(signIn.start(conn, mail))
    const out = await signIn.back({
      state: url.searchParams.get('state') ?? '',
      error: 'access_denied',
      error_description: 'AADSTS65004: User declined to consent to access the app.',
    })
    expect(out.problem?.kind).toBe('sign_in')
    expect(out.problem?.message).toBe('You said no on Microsoft’s page, so Alpha is not signed in.')
  })

  it('refuses an answer it did not ask for, and one used twice', async () => {
    const { signIn, service } = setUp()
    await signIn.setApp('microsoft', APP, kenil())
    const conn = await service.connect('work-mail', 'test@bridge.example.com', null, 'u')
    await expect(signIn.back({ state: 'made-up', code: 'the-code' })).rejects.toThrow(
      /not one Alpha started/,
    )
    const url = new URL(signIn.start(conn, mail))
    const state = url.searchParams.get('state') ?? ''
    await fetch(url, { redirect: 'manual' })
    await signIn.back({ state, code: 'the-code' })
    await expect(signIn.back({ state, code: 'the-code' })).rejects.toThrow(/not one Alpha started/)
  })
})

describe('a connector that signs in as the person', () => {
  it('names a provider Alpha knows, and asks only for what its setup sheet has IT approve', () => {
    const { service } = setUp()
    const greedy = {
      ...mail,
      manifest: {
        ...mail.manifest,
        name: 'greedy',
        oauth: { provider: 'microsoft', scopes: ['Directory.ReadWrite.All'] },
      },
    }
    expect(() => service.add(greedy)).toThrow(/not one of the permissions/)
    const unknown = {
      ...mail,
      manifest: { ...mail.manifest, name: 'other', oauth: { provider: 'acme', scopes: ['x'] } },
    }
    expect(() => service.add(unknown)).toThrow(/names one of microsoft/)
  })
})

describe('signing in with an app that has a secret (Intuit)', () => {
  it('keeps the app’s secret in the secret store, never in the world, and keeps it when not typed again', async () => {
    const { signIn } = setUp()
    await expect(signIn.setApp('intuit', INTUIT_APP, kenil())).rejects.toThrow(
      /needs its Client Secret/,
    )
    await signIn.setApp('intuit', { ...INTUIT_APP, secret: INTUIT_SECRET }, kenil())
    expect(signIn.app('intuit')).toEqual({ app: INTUIT_APP.app, secret: true })
    expect(await secrets.get('sign-in-app-secret:intuit')).toBe(INTUIT_SECRET)
    await signIn.setApp('intuit', INTUIT_APP, kenil()) // a new Client ID, the secret kept
    expect(await secrets.get('sign-in-app-secret:intuit')).toBe(INTUIT_SECRET)
    const said = JSON.stringify([world.lines({}), world.db.prepare('SELECT * FROM meta').all()])
    expect(said).not.toContain(INTUIT_SECRET)
    expect(said).toContain('Client Secret kept')
    // Intuit matches the address exactly, its port with it
    expect(signIn.registered(madeUpIntuit())).toBe('http://localhost:4700/api/sign-in/back')
  })

  it('signs in with the secret and no PKCE, and keeps the company picked on the connection', async () => {
    const { signIn, service } = setUp()
    await signIn.setApp('intuit', { ...INTUIT_APP, secret: INTUIT_SECRET }, kenil())
    const conn = await service.connect('books', 'Harbor CPA', null, 'u')
    const url = new URL(signIn.start(conn, books))
    expect(url.searchParams.get('client_id')).toBe(INTUIT_APP.app)
    expect(url.searchParams.get('scope')).toBe('com.intuit.quickbooks.accounting')
    expect(url.searchParams.get('code_challenge')).toBeNull()
    expect(url.searchParams.get('login_hint')).toBeNull()
    const out = await signInAs(signIn, url.toString())
    expect(out.problem).toBeNull()
    expect(world.connections.get(conn.id)?.place).toBe(svc.realm)
    expect(await secrets.get(conn.secretRef as string)).toBe('refresh-1')
    const now = await service.checkNow(conn.id)
    expect(now.state).toBe('connected')
    expect(places).toEqual([svc.realm])
    expect(JSON.stringify(world.lines({}))).not.toContain('access-1')
  })

  it('refuses a second sign-in that picks another company, keeping the first', async () => {
    const { signIn, service } = setUp()
    await signIn.setApp('intuit', { ...INTUIT_APP, secret: INTUIT_SECRET }, kenil())
    const conn = await service.connect('books', 'Harbor CPA', null, 'u')
    await signInAs(signIn, signIn.start(conn, books))
    svc.realm = '1111222233334444'
    const again = await signInAs(signIn, signIn.start(conn, books))
    expect(again.problem?.message).toMatch(/another company than this connection's.*Harbor CPA/)
    expect(world.connections.get(conn.id)?.place).toBe('9341455130166501')
    expect(await secrets.get(conn.secretRef as string)).toBe('refresh-1')
    svc.realm = '9341455130166501'
  })

  it('says in words when Intuit does not take the app’s keys', async () => {
    const { signIn, service } = setUp()
    await signIn.setApp('intuit', { ...INTUIT_APP, secret: 'WrongWrongWrongWrongWrong12' }, kenil())
    const conn = await service.connect('books', 'Harbor CPA', null, 'u')
    const out = await signInAs(signIn, signIn.start(conn, books))
    expect(out.problem?.message).toMatch(/Intuit does not take these keys/)
    expect(world.connections.get(conn.id)?.place).toBeNull()
  })
})

// Alpha's own sign-in apps (core/config/signin.yaml, Vikas 23 Nov): a person only signs in
describe("Alpha's own sign-in app", () => {
  const ids = (microsoftId: string, googleId = '', googleSecret = '') => ({
    microsoft: { client_id: microsoftId },
    google: { client_id: googleId, client_secret: googleSecret },
  })
  const withIds = (alpha: ReturnType<typeof ids>) => {
    const signIn = new SignIn(world, {
      secrets,
      back: () => 'http://localhost:4700/api/sign-in/back',
      providers: { microsoft: madeUp(), intuit: madeUpIntuit() },
      now: () => clock,
      alpha: () => alpha,
    })
    return { signIn, service: new ConnectorService(world, { secrets, known: [mail], signIn }) }
  }

  it('the shipped config is empty, so the firm’s own app is in use as before', async () => {
    const { config } = await import('../config.ts')
    const { signIn } = withIds(config.signIn())
    expect(signIn.app('microsoft')).toBeNull()
    expect(signIn.alpha('microsoft')).toBe(false)
    expect(signIn.consent('microsoft')).toBeNull()
    expect(() => signIn.ready(mail)).toThrow(/not set up yet/)
  })

  it('signs in on the common authority with no setup, and names the admin approval link', async () => {
    const { signIn, service } = withIds(ids('2b3c4d5e-1111-2222-3333-444455556666'))
    expect(signIn.app('microsoft')).toEqual({
      app: '2b3c4d5e-1111-2222-3333-444455556666',
      directory: 'common',
    })
    expect(signIn.alpha('microsoft')).toBe(true)
    expect(signIn.consent('microsoft')).toBe(
      'https://login.microsoftonline.com/organizations/adminconsent?client_id=2b3c4d5e-1111-2222-3333-444455556666',
    )
    const conn = await service.connect('work-mail', svc.who, null, world.owner('Kenil').id)
    const url = signIn.start(conn, mail)
    expect(url).toContain(`${base}/common/authorize`)
    expect(new URL(url).searchParams.get('client_id')).toBe('2b3c4d5e-1111-2222-3333-444455556666')
    expect((await signInAs(signIn, url)).problem).toBeNull()
  })

  it('a business that blocks approving apps is told to send its admin the link', async () => {
    const { signIn, service } = withIds(ids('2b3c4d5e-1111-2222-3333-444455556666'))
    const conn = await service.connect('work-mail', svc.who, null, world.owner('Kenil').id)
    svc.refusal = {
      error: 'invalid_grant',
      error_codes: [65001],
      error_description: 'AADSTS65001: The user or administrator has not consented.',
    }
    const out = await signInAs(signIn, signIn.start(conn, mail))
    expect(out.problem?.message).toMatch(/admin approval link/)
    expect(out.problem?.kind).toBe('waiting')
  })

  it('the firm’s own app, once set, is used instead', async () => {
    const { signIn } = withIds(ids('2b3c4d5e-1111-2222-3333-444455556666'))
    await signIn.setApp('microsoft', APP, kenil())
    expect(signIn.app('microsoft')).toEqual(APP)
    expect(signIn.alpha('microsoft')).toBe(false)
    expect(signIn.consent('microsoft')).toBeNull()
  })

  it('Google’s needs its id and its secret', async () => {
    const { alphaApp } = await import('./signin.ts')
    expect(alphaApp(ids('', '123-abc.apps.googleusercontent.com'), 'google')).toBeNull()
    expect(alphaApp(ids('', '123-abc.apps.googleusercontent.com', 'GOCSPX-xyz'), 'google')).toEqual(
      { app: '123-abc.apps.googleusercontent.com', secret: true, secretValue: 'GOCSPX-xyz' },
    )
  })
})
