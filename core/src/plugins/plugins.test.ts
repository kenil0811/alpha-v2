// The plugin seam: a made-up plugin (test-plugin/) loaded from a folder, given its
// host, its own module kept as Alpha's own are, its routes answered under /api/plugins/<name>/,
// its block at the start of a conversation; one that does not load said and left out; with none,
// nothing changes. Never the model: its one question is answered here.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { newKey } from '@alpha/bridge/keys'
import { type Connector, MemorySecrets } from '@alpha/connector-sdk'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { buildServer } from '../api/server.ts'
import { ConnectorService } from '../connectors/service.ts'
import { startLayer } from '../engine/context.ts'
import { Engine } from '../engine/engine.ts'
import { monthOf } from '../world/day.ts'
import { World } from '../world/world.ts'
import { loadPlugins, Plugins } from './plugins.ts'

const token = 'secret-token'
const ok = { host: '127.0.0.1:4700', 'x-alpha-token': token }
let home: string
let world: World

beforeEach(async () => {
  home = mkdtempSync(join(tmpdir(), 'alpha-plugins-'))
  world = await World.open(join(home, 'tenants', 't_test'))
  mkdirSync(join(home, 'plugins'))
})
afterEach(() => {
  world.close()
  rmSync(home, { recursive: true, force: true })
})

// A made-up reader with one read, on this core or on a person's computer.
const reader = (name: string, runs: 'either' | 'computer') =>
  ({
    manifest: {
      name,
      title: name,
      auth: 'path',
      account: { label: 'Here' },
      pace: { perMinute: 60 },
      runs,
    },
    guide: 'A made-up reader.',
    module: 'Read',
    tables: [],
    tools: {},
    sync: async () => ({ rows: 1, sawNew: true }),
  }) as unknown as Connector

async function started(connectors: ConnectorService | null = null) {
  const asked: string[] = []
  const plugins = new Plugins({
    world,
    user: world.owner('Kenil'),
    home,
    region: () => 'SG',
    ask: async (_system, prompt) => {
      asked.push(prompt)
      return {
        answer: { yes: true },
        uses: [
          {
            model: 'claude-test',
            input: 100,
            output: 20,
            cacheRead: 0,
            cacheWrite: 0,
            usd: 0.01,
            how: 'reported' as const,
          },
        ],
      }
    },
    connectors,
  })
  // the made-up plugin from where it is, beside this test (it imports the plugin SDK)
  const found = await loadPlugins(import.meta.dirname)
  expect(found.failed).toEqual([])
  expect(await plugins.register(found.plugins)).toEqual([])
  await plugins.keepKits({ actor: { kind: 'system' }, user: world.owner('Kenil').id })
  return { plugins, asked }
}

describe('a plugin', () => {
  it('is loaded from its folder, its own module kept as Alpha’s own are', async () => {
    const { plugins } = await started()
    expect(plugins.loaded.map((l) => l.plugin.name)).toEqual(['test'])
    const m = world.shape.ownModule('Kept notes')
    expect(world.shape.tables(m?.id).map((t) => t.name)).toEqual(['Notes'])
    expect(plugins.routes.map((r) => `${r.method} ${r.path}`)).toEqual([
      'GET /api/plugins/test/hello',
      'POST /api/plugins/test/note',
      'POST /api/plugins/test/keep/:id',
      'GET /api/plugins/test/mail',
      'GET /api/plugins/test/files',
      'POST /api/plugins/test/read/:connector',
      'POST /api/plugins/test/connect',
      'POST /api/plugins/test/ask',
      'POST /api/plugins/test/start',
    ])
  })

  it('answers its routes as the person: proposes, keeps, reads and asks only through its host', async () => {
    const { plugins, asked } = await started()
    const engine = new Engine(world)
    const a = buildServer({
      engine,
      user: world.owner('Kenil'),
      token,
      ports: [4700],
      plugins: plugins.routes,
    })
    try {
      expect((await a.inject({ url: '/api/plugins/test/hello', headers: ok })).json()).toEqual({
        hello: 'Kenil',
      })
      // its routes are the core's: no token, no answer
      expect((await a.inject({ url: '/api/plugins/test/hello' })).statusCode).toBe(403)
      const { id } = (
        await a.inject({
          method: 'POST',
          url: '/api/plugins/test/note',
          headers: ok,
          payload: { line: 'Likes car washes' },
        })
      ).json() as { id: string }
      const note = world.records.get(id)
      expect(note?.record.provenance.line?.kind).toBe('assumed')
      expect(world.lines({ kinds: ['plugin'] }).at(-1)?.words).toBe('Proposed 1 note.')
      const kept = await a.inject({
        method: 'POST',
        url: `/api/plugins/test/keep/${id}`,
        headers: ok,
      })
      expect(kept.json()).toEqual({ notes: [{ Line: 'Likes car washes', State: 'Kept' }] })
      expect(world.records.get(id)?.record.provenance.state?.kind).toBe('stated')
      // the files a connector kept, by its name: a lent folder's, not a person's own
      world.files.take(new TextEncoder().encode('a,b'), 'quotes.csv', 'text/csv', {
        actor: { kind: 'connector', id: 'folder' },
      })
      world.files.take(new TextEncoder().encode('mine'), 'mine.txt', 'text/plain', {
        actor: { kind: 'person', id: world.owner('Kenil').id },
      })
      expect((await a.inject({ url: '/api/plugins/test/files', headers: ok })).json()).toEqual({
        names: ['quotes.csv'],
      })
      // a table a connector keeps, by its key; none here yet
      expect((await a.inject({ url: '/api/plugins/test/mail', headers: ok })).json()).toEqual({
        rows: 0,
      })
      // connecting needs the core's connectors: said, never thrown
      const connect = await a.inject({
        method: 'POST',
        url: '/api/plugins/test/connect',
        headers: ok,
      })
      expect([connect.statusCode, connect.json().problem]).toEqual([
        409,
        'Connectors are not set up in this core.',
      ])
      // its one question, and what it cost kept with Alpha's usage under its own module
      expect(
        (await a.inject({ method: 'POST', url: '/api/plugins/test/ask', headers: ok })).json(),
      ).toEqual({ answer: { yes: true } })
      expect(asked).toEqual(['Say yes.'])
      expect(world.spend.month(monthOf()).map((s) => [s.kind, s.module_id])).toEqual([
        ['ask', world.shape.ownModule('Kept notes')?.id],
      ])
      // what it keeps starts every conversation
      expect(
        startLayer(world, world.owner('Kenil').id, home, null, plugins.startBlocks()),
      ).toContain('## What the test plugin keeps\n- Likes car washes')
    } finally {
      await a.close()
      engine.close()
    }
  })

  it('reads a connector now on asking, and says why not where its computer is away', async () => {
    const service = new ConnectorService(world, {
      secrets: new MemorySecrets(),
      known: [reader('here', 'either'), reader('desk', 'computer')],
      server: true,
    })
    const owner = world.owner('Kenil')
    const ctx = { actor: { kind: 'person' as const, id: owner.id }, user: owner.id }
    const here = world.connections.add('here', 'This core', null, 'here', ctx)
    const desk = world.connections.add('desk', 'Kenil’s Mac', null, 'desk', ctx)
    const pc = world.computers.pair(world.computers.link(owner.id).code, {
      publicKey: newKey().publicPem,
      name: 'Kenil’s Mac',
      platform: 'darwin',
    })
    world.connections.runOn(desk.id, pc.id)
    const { plugins } = await started(service)
    const engine = new Engine(world)
    const a = buildServer({ engine, user: owner, token, ports: [4700], plugins: plugins.routes })
    try {
      const read = (c: string) =>
        a.inject({ method: 'POST', url: `/api/plugins/test/read/${c}`, headers: ok })
      expect((await read('here')).json()).toEqual({ not: null })
      expect(world.connections.get(here.id)?.lastSyncAt).not.toBeNull()
      // its computer is not connected now: not read, and said
      expect((await read('desk')).json().not).toBe(
        'desk for Kenil’s Mac was not read now: Waiting for Kenil’s Mac. Is it on, with Alpha Bridge running?',
      )
      expect(world.connections.get(desk.id)?.lastSyncAt).toBeNull()
    } finally {
      await a.close()
      engine.close()
    }
  })

  it('that does not load is said and left out; with none, nothing is added', async () => {
    mkdirSync(join(home, 'plugins', 'broken', 'src'), { recursive: true })
    writeFileSync(
      join(home, 'plugins', 'broken', 'package.json'),
      JSON.stringify({ name: 'broken', type: 'module', exports: { '.': './src/index.ts' } }),
    )
    writeFileSync(
      join(home, 'plugins', 'broken', 'src', 'index.ts'),
      'export const plugin = { name: "Broken!" }\n',
    )
    const found = await loadPlugins(join(home, 'plugins'))
    expect(found.plugins).toEqual([])
    expect(found.failed[0]?.why).toMatch(/name: letters.*title: what the person reads.*register:/)
    expect(await loadPlugins(join(home, 'nowhere'))).toEqual({ plugins: [], failed: [] })
    const none = new Plugins({
      world,
      user: world.owner('Kenil'),
      home,
      region: () => null,
      ask: async () => ({ answer: null }),
      connectors: null,
    })
    expect(none.startBlocks()).toEqual([])
    expect(none.routes).toEqual([])
  })
})
