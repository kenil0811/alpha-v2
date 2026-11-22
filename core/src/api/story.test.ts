// Set up Alpha (the 22 Nov onboarding redesign): each person's story drawn from who they are and
// what this Alpha has, kept per person, Claude second and never skipped while no model is set, the
// owner's chapters theirs alone, and a plugin's chapter where it says.
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { MemorySecrets } from '@alpha/connector-sdk'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Engine } from '../engine/engine.ts'
import { ModelRoute } from '../engine/route.ts'
import type { PluginChapter } from '../plugins/plugins.ts'
import { workspaceFor, workspaceName, workspaceSite } from '../world/workspace.ts'
import type { User } from '../world/world.ts'
import { World } from '../world/world.ts'
import { buildServer, type ServerOptions } from './server.ts'
import { chaptersOf, storyView } from './story.ts'
import { appsAmong } from './story-connect.ts'
import type { ConnectScreen, StoryView } from './story-types.ts'

const AS = { host: '127.0.0.1:4700', 'x-alpha-token': 't', 'x-alpha-cli': '1' }
const TOKEN = `sk-ant-oat01-${'a'.repeat(40)}`

describe('Set up Alpha', () => {
  let home: string
  let world: World
  let route: ModelRoute
  let engine: Engine
  let owner: User

  beforeEach(async () => {
    home = mkdtempSync(join(tmpdir(), 'alpha-story-'))
    world = await World.open(join(home, 'tenants', 't_test'))
    route = new ModelRoute(world, new MemorySecrets(), home)
    await route.load()
    engine = new Engine(world, { route })
    owner = world.owner('Kenil Shah')
  })
  afterEach(() => {
    engine.close()
    world.close()
    rmSync(home, { recursive: true, force: true })
  })

  // a server Alpha where people sign in, as the person given
  const as = (user: User = owner, more: Partial<ServerOptions> = {}) =>
    buildServer({ engine, user, token: 't', ports: [4700], signIn: { days: 30 }, ...more })
  const story = async (app: ReturnType<typeof as>) =>
    (await app.inject({ url: '/api/story', headers: AS })).json() as StoryView
  const post = (app: ReturnType<typeof as>, url: string, payload: unknown = {}) =>
    app.inject({ method: 'POST', url, headers: AS, payload: payload as object })
  const keys = (s: StoryView) => s.chapters.map((c) => c.key)

  it('gives the owner of a fresh server its whole story, Claude second while no model is set', async () => {
    const s = await story(as())
    expect(keys(s)).toEqual(['welcome', 'claude', 'workspace', 'connect', 'people', 'done'])
    expect(s).toMatchObject({ at: 'welcome', done: false, fresh: true, row: 'Carry on setting up' })
  })

  it('never lets Claude be skipped while no model is set, and keeps a token only once Claude answered', async () => {
    const asked: string[] = []
    const app = as(owner, {
      claudeAnswers: async (t) => {
        asked.push(t)
        return t === TOKEN ? null : 'Invalid bearer token.'
      },
    })
    await post(app, '/api/story/welcome')
    const skip = await post(app, '/api/story/claude/skip')
    expect(skip.statusCode).toBe(409)
    expect(skip.json().problem).toMatch(/can’t be skipped/)
    // no going round it either
    expect((await post(app, '/api/story/workspace', { name: 'X' })).json().problem).toMatch(
      /Go through Claude first/,
    )
    const wrong = await post(app, '/api/story/claude', { token: `sk-ant-oat01-${'b'.repeat(40)}` })
    expect(wrong.json().problem).toMatch(/did not answer.*Invalid bearer token/)
    expect(route.hasToken).toBe(false)
    expect((await post(app, '/api/story/claude', { token: 'hello' })).json().problem).toMatch(
      /not a Claude token/,
    )
    const right = await post(app, '/api/story/claude', { token: TOKEN })
    expect(right.statusCode).toBe(200)
    expect(asked).toHaveLength(2) // the one not shaped as a token never reached Claude
    expect(route.hasToken).toBe(true)
    // Claude stays on the path it was gone through on
    const s = await story(app)
    expect(keys(s)).toContain('claude')
    expect(s.at).toBe('workspace')
    expect(s.row).toBe('Carry on setting up: 2 of 6 done')
  })

  it('has no Claude chapter once a model is set, and no Your people where no one signs in', async () => {
    await route.setToken(TOKEN, owner.id)
    expect(keys(await story(as()))).toEqual(['welcome', 'workspace', 'connect', 'people', 'done'])
    const mac = buildServer({ engine, user: owner, token: 't', ports: [4700] })
    const s = (await mac.inject({ url: '/api/story', headers: AS })).json() as StoryView
    expect(keys(s)).toEqual(['welcome', 'workspace', 'connect', 'done'])
  })

  it('keeps the workspace, who it is for and its site, guessing the site from the owner’s own mail', async () => {
    await route.setToken(TOKEN, owner.id)
    const ctx = { actor: { kind: 'person' as const, id: owner.id }, user: owner.id }
    world.connections.add('gmail', 'ana@gmail.com', null, 'Gmail', ctx)
    world.connections.add('gmail', 'ana@harborbooks.example', null, 'Gmail', ctx)
    const app = as()
    await post(app, '/api/story/welcome')
    const screen = (await app.inject({ url: '/api/story/workspace', headers: AS })).json()
    expect(screen).toMatchObject({ guess: 'harborbooks.example', name: null, site: null })
    await post(app, '/api/story/workspace', {
      name: 'Harbor Books',
      for: 'Our bookshop: me and two staff.',
      site: 'harborbooks.example',
    })
    expect(workspaceName(world.db)).toBe('Harbor Books')
    expect(workspaceFor(world.db)).toBe('Our bookshop: me and two staff.')
    expect(workspaceSite(world.db)).toBe('https://harborbooks.example/')
    expect((await story(app)).at).toBe('connect')
  })

  it('adds the owner’s people with one-time links, sending nothing, and a member’s story is their own', async () => {
    await route.setToken(TOKEN, owner.id)
    const app = as()
    for (const c of ['welcome', 'workspace', 'connect']) await post(app, `/api/story/${c}`)
    const added = await post(app, '/api/story/people', {
      add: [{ name: 'Priya', email: 'priya@harborbooks.example' }],
    })
    expect(added.json().links[0].link).toMatch(/\/\?link=/)
    const people = (await app.inject({ url: '/api/story/people', headers: AS })).json()
    expect(JSON.stringify(people)).toMatch(/Priya/)
    expect(JSON.stringify(people)).not.toMatch(/sent/i)
    await post(app, '/api/story/done')
    expect(await story(app)).toMatchObject({ done: true, row: null, at: null })

    const priya = world.users().find((u) => u.name === 'Priya') as User
    const hers = as(priya)
    const s = await story(hers)
    expect(keys(s)).toEqual(['welcome', 'here', 'connect', 'done'])
    expect(s).toMatchObject({ at: 'welcome', done: false, fresh: true })
    const here = JSON.stringify((await hers.inject({ url: '/api/story/here', headers: AS })).json())
    expect(here).toMatch(/everyone/)
    expect(here).not.toMatch(/private/i)
    // the owner's chapters are not hers to act on
    const ws = await post(hers, '/api/story/workspace', { name: 'Mine now' })
    expect(ws.json().problem).toMatch(/Only the owner/)
    // and the owner's story is as the owner left it
    expect((await story(app)).done).toBe(true)
  })

  it('shows the owner tiles that connect in place, and a member only what is theirs to connect', async () => {
    await route.setToken(TOKEN, owner.id)
    const screen = async (app: ReturnType<typeof as>) =>
      (await app.inject({ url: '/api/story/connect', headers: AS })).json() as ConnectScreen
    const mine = await screen(as())
    expect(mine.tiles.map((t) => t.key)).toEqual(['calendar', 'computer', 'apps', 'file'])
    // without interviews, no Alpha Bridge Apps reader (rules P1): Apps you use reads mail alone
    expect(mine.tiles.find((t) => t.key === 'apps')?.reader).toBeNull()
    // on a server, a computer pairs through Alpha Bridge; every tile says what it reads first
    expect(mine.tiles.find((t) => t.key === 'computer')).toMatchObject({
      server: true,
      title: 'Your computer',
    })
    expect(mine.tiles.every((t) => t.reads.length > 0)).toBe(true)
    const priya = world.accounts.add('Priya', 'priya@example.com', {
      actor: { kind: 'person', id: owner.id },
      user: owner.id,
    })
    const hers = await screen(as(world.user(priya.id) as User))
    expect(hers.title).toBe('Connect your own')
    expect(hers.tiles.map((t) => t.key)).toEqual(['calendar', 'computer'])
  })

  it('takes the row off Home on Decline, and opens from the start again on Reopen', async () => {
    const app = as()
    await post(app, '/api/story/welcome')
    expect((await post(app, '/api/story/decline')).json()).toMatchObject({
      declined: true,
      row: null,
      fresh: false,
    })
    expect((await post(app, '/api/story/reopen')).json()).toMatchObject({
      declined: false,
      fresh: true,
      at: 'welcome',
    })
  })
})

describe('a plugin’s chapters', () => {
  const chapter = (key: string, after: 'connect' | 'people', who: 'owner' | 'everyone') =>
    ({
      key,
      title: key,
      after,
      who,
      plugin: 'interviews',
      screen: async () => ({}),
      act: async () => ({ on: true }),
    }) as PluginChapter
  const plugins = [chapter('know', 'connect', 'everyone'), chapter('learned', 'people', 'owner')]
  const none = { chapters: {}, doneAt: null, declinedAt: null }

  it('sit after Connect or after Your people, for whom they say', () => {
    const owner = chaptersOf({ owner: true, modelSet: true, people: true, plugins, progress: none })
    expect(owner.map((c) => c.key)).toEqual([
      'welcome',
      'workspace',
      'connect',
      'know',
      'people',
      'learned',
      'done',
    ])
    const member = chaptersOf({
      owner: false,
      modelSet: true,
      people: true,
      plugins,
      progress: none,
    })
    expect(member.map((c) => c.key)).toEqual(['welcome', 'here', 'connect', 'know', 'done'])
  })

  it('count toward how far the person got, skipped ones too', () => {
    const list = chaptersOf({ owner: true, modelSet: true, people: true, plugins, progress: none })
    const v = storyView(list, {
      chapters: { welcome: 'done', workspace: 'skipped' },
      doneAt: null,
      declinedAt: null,
    })
    expect(v.at).toBe('connect')
    expect(v.chapters.find((c) => c.key === 'workspace')?.state).toBe('skipped')
    expect(v.row).toBe('Carry on setting up: 2 of 7 done')
  })
})

describe('Apps you use', () => {
  const known = {
    recent_days: 30,
    min_mails: 2,
    shown: 10,
    apps: [
      { name: 'QuickBooks', sites: ['quickbooks.intuit.com'], connector: 'quickbooks' },
      { name: 'Slack', sites: ['slack.com'] },
      { name: 'Zoom', sites: ['zoom.us'], desktop: ['zoom.us'] },
      { name: 'Xero', sites: ['xero.com'] },
      { name: 'Stripe', sites: ['dashboard.stripe.com'] },
    ],
  }
  const now = Date.parse('2026-11-22T12:00:00Z')
  const day = (d: number) => new Date(now - d * 86_400_000).toISOString()
  const here = { ships: (c: string) => c === 'quickbooks', connected: () => false }

  it('lists the computer’s apps used lately and the work apps in mail as one list, each once', () => {
    const desktop = [
      { name: 'Slack.app', last: day(1), times: 40 },
      { name: 'zoom.us', last: day(3), times: 55 },
      { name: 'Figma', last: day(5), times: 30 },
      { name: 'Old Thing', last: day(90), times: 999 }, // not used in the last 30 days
      { name: 'Never opened', last: null, times: null },
    ]
    const mail = new Map([
      ['notification.intuit.com', 3], // QuickBooks, by its site's domain
      ['slack.com', 6], // Slack, on the computer too
      ['post.xero.com', 1], // one mail: under the least
      ['stripe.com', 2],
      ['notslack.com', 9],
    ])
    const found = appsAmong({ desktop, mail }, known, now, here)
    expect(found.map((a) => [a.name, a.times, a.mails, a.connector])).toEqual([
      // what Alpha can connect or sign in to first, the most used first
      ['Zoom', 55, 0, null],
      ['Slack', 40, 6, null],
      ['QuickBooks', null, 3, 'quickbooks'],
      ['Stripe', null, 2, null],
      ['Figma', 30, 0, null],
    ])
  })

  it('never lists an app the person left out', () => {
    const desktop = [
      { name: 'Slack', last: day(1), times: 40 },
      { name: 'Figma', last: day(1), times: 30 },
    ]
    const found = appsAmong({ desktop, mail: new Map() }, known, now, {
      ...here,
      left: new Set(['figma']),
    })
    expect(found.map((a) => a.name)).toEqual(['Slack'])
  })

  it('shows so many at most', () => {
    const desktop = Array.from({ length: 20 }, (_, i) => ({
      name: `App ${i}`,
      last: day(1),
      times: i,
    }))
    expect(appsAmong({ desktop, mail: new Map() }, { ...known, shown: 4 }, now, here)).toHaveLength(
      4,
    )
  })
})
