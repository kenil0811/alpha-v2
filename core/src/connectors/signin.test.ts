// Signing in as the person (step 2, part 5), against a made-up sign-in service on this computer:
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

const APP = { app: '1a2b3c4d-1111-2222-3333-444455556666', directory: 'bridge.example.com' }
const kenil = () => ({ actor: { kind: 'person' as const, id: world.owner('Kenil').id } })

function setUp() {
  checked = []
  const signIn = new SignIn(world, {
    secrets,
    back: () => 'http://localhost:4700/api/sign-in/back',
    providers: { microsoft: madeUp() },
    now: () => clock,
  })
  const service = new ConnectorService(world, { secrets, known: [mail], signIn })
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
  it('is set once, checked for what its ids look like, and journaled', () => {
    const { signIn } = setUp()
    expect(() =>
      signIn.setApp('microsoft', { app: 'not-an-id', directory: APP.directory }, kenil()),
    ).toThrow(/Application \(client\) ID/)
    signIn.setApp('microsoft', APP, kenil())
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
    signIn.setApp('microsoft', APP, kenil())
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
    signIn.setApp('microsoft', APP, kenil())
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
    signIn.setApp('microsoft', APP, kenil())
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
    signIn.setApp('microsoft', APP, kenil())
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
    signIn.setApp('microsoft', APP, kenil())
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
    signIn.setApp('microsoft', APP, kenil())
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
