// Onboarding from the footprint: nothing read before its tick; the browser reader opens only its
// allow-list and keeps sites, never pages or searches; the default deny list is the owner's
// approved rules and skips what it names; AI memory comes in unconfirmed; the draft keeps only
// what it was given; a confirmed fact drops the questions it answers; a source can be forgotten.
// A temp home and a fake model: no real browser, no network, no model.
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { buildServer } from '../api/server.ts'
import { config } from '../config.ts'
import { Engine } from '../engine/engine.ts'
import type { Ask } from '../files/reading.ts'
import { World } from '../world/world.ts'
import { ALLOWED, allowed, readBrowsers } from './browsers.ts'
import { DEFAULT_KITS, keepDefaults } from './defaults.ts'
import {
  answeredByFootprint,
  count,
  draft,
  type Env,
  forget,
  load,
  noticed,
  read,
  remember,
  setSite,
  tick,
} from './footprint.ts'
import { bank } from './interview.ts'
import { Reviews } from './reviews.ts'

let home: string // the Mac's home folder, made up
let world: World
let person: { actor: { kind: 'person'; id: string }; user: string }

const CHROME = 'Library/Application Support/Google/Chrome'
const chromeTime = (ms: number) => (ms + 11_644_473_600_000) * 1000

function mac() {
  const p = join(home, CHROME, 'Default')
  mkdirSync(join(p, 'Extensions', 'abcd', '1.0', '_locales', 'en'), { recursive: true })
  writeFileSync(
    join(home, CHROME, 'Local State'),
    JSON.stringify({ profile: { info_cache: { Default: { name: 'Work' } } } }),
  )
  writeFileSync(join(p, 'Preferences'), '{}')
  writeFileSync(
    join(p, 'Bookmarks'),
    JSON.stringify({
      roots: {
        bookmark_bar: {
          type: 'folder',
          name: 'Bookmarks bar',
          children: [
            {
              type: 'folder',
              name: 'Clients',
              children: [
                { type: 'url', name: 'Books', url: 'https://qbo.intuit.com/app/invoices' },
              ],
            },
            { type: 'url', name: 'Bank', url: 'https://www.chase.com/business' },
          ],
        },
      },
    }),
  )
  writeFileSync(
    join(p, 'Extensions', 'abcd', '1.0', 'manifest.json'),
    JSON.stringify({ name: '__MSG_appName__', default_locale: 'en' }),
  )
  writeFileSync(
    join(p, 'Extensions', 'abcd', '1.0', '_locales', 'en', 'messages.json'),
    JSON.stringify({ appName: { message: 'Grammarly' } }),
  )
  // what the reader must never open
  writeFileSync(join(p, 'Login Data'), 'hunter2-password')
  writeFileSync(join(p, 'Cookies'), 'session-cookie')
  writeFileSync(join(p, 'Web Data'), 'card-number')
  const h = new DatabaseSync(join(p, 'History'))
  h.exec(
    'CREATE TABLE urls (id INTEGER PRIMARY KEY, url TEXT, title TEXT, visit_count INTEGER, last_visit_time INTEGER); CREATE TABLE keyword_search_terms (term TEXT)',
  )
  const now = Date.now()
  const add = h.prepare(
    'INSERT INTO urls (url, title, visit_count, last_visit_time) VALUES (?, ?, ?, ?)',
  )
  add.run(
    'https://www.google.com/search?q=secretsearch',
    'secretsearch - Google',
    3,
    chromeTime(now - 86_400_000),
  )
  add.run(
    'https://app.hubspot.com/contacts/42/deal/secretdeal',
    'Secret deal',
    9,
    chromeTime(now - 86_400_000),
  )
  add.run('https://www.chase.com/acct/123', 'Balance', 4, chromeTime(now - 86_400_000))
  add.run('https://old.example.com/', 'Old', 1, chromeTime(now - 200 * 86_400_000))
  h.prepare('INSERT INTO keyword_search_terms (term) VALUES (?)').run('secretsearch')
  h.close()
  mkdirSync(join(home, 'Desktop', 'Invoices 2026'), { recursive: true })
  writeFileSync(join(home, 'Desktop', 'Invoices 2026', 'inv-001.pdf'), 'secret contents')
  writeFileSync(join(home, 'Desktop', '.hidden'), '')
  mkdirSync(join(home, 'Applications', 'QuickBooks.app'), { recursive: true })
}

const env = (): Env => ({
  home,
  apps: [join(home, 'Applications')],
  dock: () => ['QuickBooks'],
  recent: () => [join(home, 'Documents', 'Quote template.docx')],
  records: async () => ['MX 1 aspmx.l.google.com', 'TXT stripe-verification=abc'],
  page: async () =>
    '<title>Bright Dental</title><meta name="description" content="Family dentistry in Ames">',
})

beforeEach(async () => {
  home = mkdtempSync(join(tmpdir(), 'alpha-footprint-'))
  world = await World.open(join(home, 'tenants', 't_test'))
  const owner = world.owner('Kenil')
  person = { actor: { kind: 'person', id: owner.id }, user: owner.id }
  const kits = join(home, 'kits')
  mkdirSync(kits)
  symlinkSync(join(DEFAULT_KITS, 'alpha'), join(kits, 'alpha'))
  await keepDefaults(world, { actor: { kind: 'system' }, user: owner.id }, kits)
  mac()
})
afterEach(() => {
  world.close()
  rmSync(home, { recursive: true, force: true })
})

const lines = () => world.lines({ kinds: ['connection_read'], limit: 100 })

describe('the browser reader’s walls', () => {
  it('opens only its allow-list: never Login Data, Web Data, Cookies or a keychain', () => {
    for (const f of [
      'Login Data',
      'Web Data',
      'Cookies',
      'Login Data For Account',
      'login.keychain-db',
      'Top Sites',
      'Favicons',
    ])
      expect(() => allowed(join(home, CHROME, 'Default', f))).toThrow(/never opens/)
    // an extension's files only under Extensions/
    expect(() => allowed(join(home, CHROME, 'Default', 'manifest.json'))).toThrow()
    expect(allowed(join(home, CHROME, 'Default', 'History'))).toContain('History')
    expect([...ALLOWED]).not.toContain('Login Data')
  })

  it('keeps sites only: no page, title, query or search-box text', () => {
    const r = readBrowsers(home, { bookmarks: true, extensions: true, history: true }, 90)
    const all = JSON.stringify(r)
    expect(r.sites.map((s) => s.site)).toEqual(['app.hubspot.com', 'chase.com', 'google.com'])
    for (const secret of [
      'secretsearch',
      'secretdeal',
      'Secret deal',
      '/acct',
      'q=',
      'hunter2',
      'session-cookie',
      'card-number',
    ])
      expect(all).not.toContain(secret)
    // 90 days back, no further
    expect(all).not.toContain('old.example.com')
    expect(r.extensions.map((e) => e.name)).toEqual(['Grammarly'])
    expect(r.bookmarks.map((b) => [b.folder, b.name, b.site])).toContainEqual([
      'Bookmarks bar › Clients',
      'Books',
      'qbo.intuit.com',
    ])
  })

  it('reads nothing of what it was not asked for', () => {
    const r = readBrowsers(home, { extensions: true }, 90)
    expect(r.sites).toEqual([])
    expect(r.bookmarks).toEqual([])
  })

  it('never reaches the clipboard, Wi-Fi, location, photos, health, keystrokes or the screen', () => {
    const code = ['footprint.ts', 'browsers.ts']
      .map((f) => readFileSync(join(import.meta.dirname, f), 'utf8'))
      .join('\n')
      .split('\n')
      .filter((l) => !l.trim().startsWith('//'))
      .join('\n')
    for (const never of [
      'pbpaste',
      'NSPasteboard',
      'airport',
      'networksetup',
      'wdutil',
      'CoreLocation',
      'Photos',
      'screencapture',
      'CGEvent',
      'HealthKit',
      'keychain',
      'security find',
    ])
      expect(code).not.toContain(never)
    const ids = config.footprint().sources.map((s) => s.id)
    expect(ids).toEqual([
      'apps',
      'bookmarks',
      'extensions',
      'history',
      'folders',
      'recent',
      'contacts',
      'calendar',
      'mail',
      'website',
    ])
  })
})

describe('count, then read what was ticked', () => {
  it('counts without reading; nothing is kept or logged before a tick', async () => {
    const view = count(world, env())
    const by = Object.fromEntries(view.map((s) => [s.id, s.count]))
    expect(by).toMatchObject({
      apps: 1,
      bookmarks: 2,
      extensions: 1,
      history: 3,
      recent: 1,
      mail: null,
    })
    expect(view.find((s) => s.id === 'mail')?.needs).toBe('gmail')
    await read(world, env(), person)
    expect(load(world).data).toEqual({})
    expect(lines()).toEqual([])
  })

  it('the first tick saves the default deny list as the owner’s approved rules, once', () => {
    tick(world, 'apps', true, person)
    const rules = world.rules.list().filter((r) => r.side === 'deny')
    expect(rules.map((r) => r.said?.split(':')[0])).toEqual(
      expect.arrayContaining(['Money', 'Health']),
    )
    expect(rules.every((r) => r.kind === 'approved' && r.madeBy === `person:${person.user}`)).toBe(
      true,
    )
    expect(rules[0]?.words).toMatch(/^Alpha must never read /)
    // revoked in Governance, it is not put back by the next tick
    for (const r of rules) world.rules.revoke(r.id, person)
    tick(world, 'history', true, person)
    expect(world.rules.list().filter((r) => !r.revokedAt)).toEqual([])
  })

  it('reads only the ticked sources and skips what a deny rule names', async () => {
    tick(world, 'bookmarks', true, person)
    tick(world, 'history', true, person)
    tick(world, 'mail', true, person)
    await read(world, env(), person)
    const s = load(world)
    expect(Object.keys(s.data).sort()).toEqual(['bookmarks', 'history', 'mail'])
    expect(s.data.history).toEqual(['app.hubspot.com: 9 visits', 'google.com: 3 visits'])
    expect(s.ledger.history).toMatchObject({
      read: 2,
      skipped: 1,
      why: '1 under your rules (Money)',
    })
    expect(s.data.bookmarks?.join()).not.toContain('chase')
    // Gmail not connected: said, and skipped
    expect(s.ledger.mail).toMatchObject({
      read: 0,
      why: 'Gmail is not connected, so it was skipped.',
    })
    expect(lines().map((l) => l.data.name)).toEqual(
      expect.arrayContaining(['Sites visited', 'Browser bookmarks', 'Mail']),
    )
  })

  it('reads apps, folder names, recent files and the website’s public records', async () => {
    for (const id of ['apps', 'folders', 'recent', 'website']) tick(world, id, true, person)
    setSite(world, 'https://www.brightdental.example/')
    await read(world, env(), person)
    const d = load(world).data
    expect(d.apps?.[0]).toMatch(/^QuickBooks, since \d{4}-\d{2}-\d{2}, in the Dock$/)
    expect(d.folders).toEqual(['Desktop/Invoices 2026/', 'Desktop/Invoices 2026/inv-001.pdf'])
    expect(JSON.stringify(d)).not.toContain('secret contents')
    expect(d.recent).toEqual(['Quote template.docx'])
    expect(d.website).toEqual([
      "The site's title: Bright Dental",
      'The site says: Family dentistry in Ames',
      "The domain's records show Google Workspace",
      "The domain's records show Stripe",
    ])
  })
})

describe('memory, the draft and the gaps', () => {
  const rows = () => {
    const t = noticed(world)
    if (!t) throw new Error('no Noticed')
    const f = (n: string) => t.fields.find((x) => x.name === n)?.slug ?? ''
    return world.records.list(t.id).map((r) => ({
      id: r.id,
      about: r.values[f('About')],
      fact: r.values[f('Fact')],
      state: r.values[f('State')],
      why: r.values[f('Why')],
    }))
  }

  it('brings an AI’s memory in as unconfirmed facts on one card', () => {
    const out = remember(
      world,
      '**You**: Dr. Rao, owner of Bright Dental\n- Your tools: Dentrix for charts\nnot a fact line\n',
      person,
    )
    expect(out.facts).toBe(2)
    expect(rows()).toEqual([
      expect.objectContaining({
        about: 'You',
        state: 'Proposed',
        why: expect.stringContaining('unconfirmed'),
      }),
      expect.objectContaining({
        about: 'Your tools',
        fact: 'Dentrix for charts',
        state: 'Proposed',
      }),
    ])
    expect(world.cards.get(out.card ?? '')?.state).toBe('waiting')
  })

  it('drafts only on the topics and sources it was given, each fact with its source', async () => {
    tick(world, 'apps', true, person)
    await read(world, env(), person)
    let prompt = ''
    const ask: Ask = async (p) => {
      prompt = p
      return {
        tokens: 10,
        answer: {
          facts: [
            { about: 'Your tools', fact: 'QuickBooks keeps the books.', source: 'apps' },
            { about: 'Your bank', fact: 'Chase.', source: 'apps' }, // not a topic
            { about: 'You', fact: 'Reads mail all day.', source: 'mail' }, // not read
          ],
        },
      }
    }
    const out = await draft(world, ask, person)
    expect(prompt).toContain('QuickBooks, since')
    expect(out.facts).toBe(1)
    expect(rows()).toEqual([
      expect.objectContaining({
        about: 'Your tools',
        fact: 'QuickBooks keeps the books.',
        why: 'From your installed apps',
      }),
    ])
  })

  it('a confirmed fact drops the questions it answers; a dropped one does not', async () => {
    const before = bank(world, null).map((q) => q.key)
    expect(before).toContain('tools')
    const out = remember(world, 'Your tools: QuickBooks\nYour clients: Families in Ames', person)
    const [tools, clients] = rows()
    const reviews = new Reviews(world, person.user)
    reviews.choose(out.card ?? '', [tools?.id ?? ''], 'Confirmed', person)
    reviews.choose(out.card ?? '', [clients?.id ?? ''], 'Dropped', person)
    expect([...answeredByFootprint(world)]).toEqual(['tools'])
    const after = bank(world, null).map((q) => q.key)
    expect(after).not.toContain('tools')
    expect(after).toContain('customers')
  })

  it('forgets a source: its reads and unconfirmed facts go, a confirmed fact stays', async () => {
    tick(world, 'apps', true, person)
    await read(world, env(), person)
    const ask: Ask = async () => ({
      tokens: 1,
      answer: {
        facts: [
          { about: 'Your tools', fact: 'QuickBooks keeps the books.', source: 'apps' },
          { about: 'You', fact: 'You run a dental practice.', source: 'apps' },
        ],
      },
    })
    const out = await draft(world, ask, person)
    const keep = rows().find((r) => r.about === 'You')
    new Reviews(world, person.user).choose(out.card ?? '', [keep?.id ?? ''], 'Confirmed', person)
    forget(world, 'apps', person)
    const s = load(world)
    expect(s.data.apps).toBeUndefined()
    expect(s.ledger.apps).toBeUndefined()
    expect(s.ticks.apps).toBe(false)
    expect(rows().map((r) => r.about)).toEqual(['You'])
  })
})

describe('the routes', () => {
  it('count, tick, read and the ledger, through the api, on this test’s home', async () => {
    const engine = new Engine(world)
    const token = 't'
    const app = buildServer({
      engine,
      user: world.owner('Kenil'),
      token,
      ports: [4700],
      footprintEnv: env,
    })
    const call = async (method: 'GET' | 'POST', url: string, payload?: unknown) =>
      (
        await app.inject({
          method,
          url,
          headers: { host: '127.0.0.1:4700', 'x-alpha-token': token },
          ...(payload ? { payload } : {}),
        })
      ).json() as {
        sources: { id: string; count: number | null; read: unknown }[]
        denied: boolean
        done: boolean
      }
    expect((await call('GET', '/api/footprint')).sources.every((s) => s.count === null)).toBe(true)
    expect(
      (await call('POST', '/api/footprint/count')).sources.find((s) => s.id === 'apps')?.count,
    ).toBe(1)
    expect((await call('POST', '/api/footprint/tick', { source: 'apps', on: true })).denied).toBe(
      true,
    )
    const v = await call('POST', '/api/footprint/read')
    expect(v.sources.find((s) => s.id === 'apps')?.read).toMatchObject({ read: 1 })
    expect((await call('POST', '/api/footprint/done')).done).toBe(true)
    await app.close()
    engine.close()
  })
})
