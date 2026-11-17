// A person's computer through the Bridge, end to end on this machine: the core's server and its
// door, a Bridge paired with a link and connected over a real websocket, and the Bridge's own
// connector process reading a scratch folder. Its key is held in memory: never a real Alpha, a
// computer's own key store or the Keychain.
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PassThrough } from 'node:stream'
import { Bridge, pair } from '@alpha/bridge'
import type { Config } from '@alpha/bridge/config'
import { inMemory, newKey } from '@alpha/bridge/keys'
import { serve } from '@alpha/bridge/serve'
import { MemorySecrets } from '@alpha/connector-sdk'
import type { FastifyInstance } from 'fastify'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { buildServer } from '../api/server.ts'
import { handsFor } from '../connectors/computers.ts'
import { loadSet, STANDARD_DIR } from '../connectors/discover.ts'
import { ConnectorService } from '../connectors/service.ts'
import { Engine } from '../engine/engine.ts'
import type { User } from '../world/world.ts'
import { World } from '../world/world.ts'
import { bridges } from './hub.ts'

const CHILD = join(import.meta.dirname, '..', 'connectors', 'child.ts')
const MAC = join(import.meta.dirname, '..', '..', '..', 'connectors', 'mac', 'src', 'index.ts')
const FOLDER = join(
  import.meta.dirname,
  '..',
  '..',
  '..',
  'connectors',
  'files',
  'src',
  'folder.ts',
)

let home: string
let world: World
let owner: User
let service: ConnectorService
let engine: Engine
let app: FastifyInstance
let alpha: string
let bridge: Bridge | null = null
const computers: string[] = [] // the computers paired in a test

const freePort = () =>
  new Promise<number>((ok) => {
    const s = createServer().listen(0, '127.0.0.1', () => {
      const a = s.address()
      s.close(() => ok(typeof a === 'object' && a ? a.port : 0))
    })
  })

const until = async (check: () => boolean, ms = 20_000) => {
  const by = Date.now() + ms
  while (!check()) {
    if (Date.now() > by) throw new Error('It did not happen in time.')
    await new Promise((r) => setTimeout(r, 50))
  }
}

beforeEach(async () => {
  home = mkdtempSync(join(tmpdir(), 'alpha-bridge-'))
  world = await World.open(join(home, 'tenants', 't_test'))
  owner = world.owner('Kenil')
  const known = (await loadSet(STANDARD_DIR)).connectors.filter((c) =>
    ['folder', 'calendar', 'contacts'].includes(c.manifest.name),
  )
  // a server's core: a folder runs only on a person's computer
  service = new ConnectorService(world, { secrets: new MemorySecrets(), known, server: true })
  engine = new Engine(world, { connectors: service })
  bridges.use(
    world,
    handsFor(service, world, () => undefined),
  )
  const port = await freePort()
  app = buildServer({ engine, user: owner, token: 'test-token', ports: [port] })
  await app.listen({ host: '127.0.0.1', port })
  alpha = `http://127.0.0.1:${port}`
})

afterEach(async () => {
  bridge?.stop()
  bridge = null
  // the door hears the Bridge go before the world closes, a removed computer's too
  await until(() => computers.every((id) => !bridges.online(id)))
  computers.length = 0
  await app.close()
  engine.close()
  world.close()
  rmSync(home, { recursive: true, force: true })
})

// A Bridge on this machine, its folder lent, its connector process run as the core runs its own.
async function lendFolder(picked: string[] = []): Promise<{ dir: string; config: Config }> {
  const made = await app.inject({
    method: 'POST',
    url: '/api/computers/link',
    headers: { host: new URL(alpha).host, 'x-alpha-token': 'test-token' },
  })
  const keys = inMemory()
  const paired = await pair(made.json().link as string, keys, 'Test Mac')
  const dir = join(home, 'Exports')
  mkdirSync(dir)
  writeFileSync(join(dir, 'pl.csv'), 'Account,June\nRevenue,1200\n')
  const config: Config = { ...paired, lends: [{ connector: 'folder', account: dir }] }
  computers.push(config.computer)
  bridge = new Bridge({
    config: () => config,
    keys,
    start: async () => ({ command: process.execPath, args: [CHILD, FOLDER], shell: false }),
    pick: (connector) => picked.push(connector),
  })
  bridge.run()
  return { dir, config }
}

const asWindow = () => ({ host: new URL(alpha).host, 'x-alpha-token': 'test-token' })

describe('the Bridge', { timeout: 30_000 }, () => {
  it('pairs once with a link, lends its folder, and a file put there lands in Alpha', async () => {
    const { dir, config } = await lendFolder()
    expect(world.computers.of(owner.id).map((c) => c.name)).toEqual(['Test Mac'])
    await until(() => world.files.documents().length === 1)
    expect(world.files.documents()[0]?.title).toBe('pl.csv')
    const conn = world.connections.find('folder', dir)
    expect(conn?.computer).toBe(config.computer)
    expect(conn?.state).toBe('connected')
    writeFileSync(join(dir, 'notes.txt'), 'call the broker\n')
    await service.sync(conn?.id ?? '')
    expect(world.files.documents().map((d) => d.title)).toEqual(['pl.csv', 'notes.txt'])
  })

  it('waits for a computer that is away, and catches up as soon as it is back', async () => {
    const { dir } = await lendFolder()
    await until(() => world.files.documents().length === 1)
    bridge?.stop()
    await until(() => !bridges.online(world.computers.of(owner.id)[0]?.id ?? ''))
    const conn = world.connections.find('folder', dir)
    writeFileSync(join(dir, 'notes.txt'), 'call the broker\n')
    await service.sync(conn?.id ?? '')
    expect(world.connections.get(conn?.id ?? '')?.health).toBe('Waiting for Test Mac')
    expect(world.files.documents()).toHaveLength(1)
    // read the moment it is back, with nobody asking: its waiting words go with it
    bridge?.run()
    await until(() => world.files.documents().length === 2)
    expect(world.files.documents().map((d) => d.title)).toEqual(['pl.csv', 'notes.txt'])
    expect(world.connections.get(conn?.id ?? '')?.health).toBeNull()
  })

  it('turns a removed computer away at once', async () => {
    const { config } = await lendFolder()
    await until(() => bridges.online(config.computer))
    const out = await app.inject({
      method: 'DELETE',
      url: `/api/computers/${config.computer}`,
      headers: { host: new URL(alpha).host, 'x-alpha-token': 'test-token' },
    })
    expect(out.statusCode).toBe(200)
    await until(() => !bridges.online(config.computer))
    expect(world.connections.on(config.computer).map((k) => k.state)).toEqual(['paused'])
  })
})

describe('the Bridge as the app runs it', { timeout: 30_000 }, () => {
  it('pauses there: Alpha waits, saying so, and catches up when it resumes', async () => {
    const { dir, config } = await lendFolder()
    await until(() => world.files.documents().length === 1)
    bridge?.pauseFor(null)
    await until(() => !!bridges.pausedOf(config.computer))
    writeFileSync(join(dir, 'notes.txt'), 'call the broker\n')
    const conn = world.connections.find('folder', dir)
    await service.sync(conn?.id ?? '')
    expect(world.connections.get(conn?.id ?? '')?.health).toBe('Paused on Test Mac')
    expect(world.files.documents()).toHaveLength(1)
    bridge?.resume()
    await until(() => !bridges.pausedOf(config.computer))
    await service.sync(conn?.id ?? '')
    expect(world.files.documents().map((d) => d.title)).toEqual(['pl.csv', 'notes.txt'])
  })

  it('opens its picker when Alpha asks, and lends nothing until its person picks', async () => {
    const picked: string[] = []
    const { config } = await lendFolder(picked)
    await until(() => bridges.online(config.computer))
    const out = await app.inject({
      method: 'POST',
      url: `/api/computers/${config.computer}/pick`,
      headers: asWindow(),
    })
    expect(out.statusCode).toBe(200)
    await until(() => picked.length === 1)
    expect(picked).toEqual(['folder'])
    expect(world.connections.on(config.computer)).toHaveLength(1)
    bridge?.stop()
    await until(() => !bridges.online(config.computer))
    const away = await app.inject({
      method: 'POST',
      url: `/api/computers/${config.computer}/pick`,
      headers: asWindow(),
    })
    expect(away.json().problem).toMatch(/not connected now/)
  })

  it('pairs again: the old pairing goes, and what it lent follows the new one', async () => {
    const { dir, config } = await lendFolder()
    await until(() => world.connections.find('folder', dir)?.state === 'connected')
    bridge?.stop()
    await until(() => !bridges.online(config.computer))
    const made = await app.inject({
      method: 'POST',
      url: '/api/computers/link',
      headers: asWindow(),
    })
    const keys = inMemory()
    const again = await pair(made.json().link as string, keys, 'Test Mac', config.computer)
    computers.push(again.computer)
    const next: Config = { ...again, lends: config.lends }
    bridge = new Bridge({
      config: () => next,
      keys,
      start: async () => ({ command: process.execPath, args: [CHILD, FOLDER], shell: false }),
    })
    bridge.run()
    await until(() => bridges.online(again.computer))
    expect(world.computers.get(config.computer)?.removedAt).toBeTruthy()
    expect(world.connections.find('folder', dir)?.computer).toBe(again.computer)
    expect(world.computers.of(owner.id).map((c) => c.id)).toEqual([again.computer])
  })

  it('signs out there: Alpha removes the computer and stops what it lent', async () => {
    const { config } = await lendFolder()
    await until(() => world.connections.on(config.computer)[0]?.state === 'connected')
    await bridge?.signOut()
    await until(() => !!world.computers.get(config.computer)?.removedAt)
    expect(world.connections.on(config.computer).map((k) => k.state)).toEqual(['paused'])
  })
})

describe('a Mac’s Calendar and Contacts', { timeout: 30_000 }, () => {
  it('lends its Calendar through Alpha’s helper there, and its events land', async () => {
    const made = await app.inject({
      method: 'POST',
      url: '/api/computers/link',
      headers: asWindow(),
    })
    const keys = inMemory()
    const paired = await pair(made.json().link as string, keys, 'Test Mac')
    computers.push(paired.computer)
    const asked: string[][] = []
    const config: Config = { ...paired, lends: [{ connector: 'calendar', account: 'Test Mac' }] }
    bridge = new Bridge({
      config: () => config,
      keys,
      start: async () => ({ command: process.execPath, args: [CHILD, MAC], shell: false }),
      // Alpha's helper, as the Mac answers it: never the real Calendar in a test
      helper: async (args) => {
        asked.push(args)
        return {
          events: [
            {
              id: 'e1',
              title: 'Harbor call',
              start: '2026-11-17T15:00:00Z',
              end: '2026-11-17T15:30:00Z',
              allDay: false,
              location: '',
              calendar: 'Work',
              attendees: [{ name: 'Priya', email: 'priya@harbor.example' }],
              organizer: { name: 'Kenil', email: 'kenil@example.com', me: true },
            },
          ],
        }
      },
    })
    bridge.run()
    const events = () => world.shape.table('Events')
    await until(() => !!events() && world.records.count(events()?.id ?? '') === 1)
    expect(asked[0]?.[0]).toBe('calendar')
    expect(world.connections.find('calendar', 'Test Mac')?.computer).toBe(paired.computer)
  })
})

describe('the app’s lines', { timeout: 30_000 }, () => {
  it('pairs, lends, pauses and signs out as the app tells it, saying each', async () => {
    const said: Record<string, unknown>[] = []
    const input = new PassThrough()
    const keys = inMemory()
    const here = join(home, 'bridge-home')
    mkdirSync(here)
    await serve(
      here,
      keys,
      async () => ({ command: process.execPath, args: [CHILD, FOLDER], shell: false }),
      {
        input,
        write: (line) => said.push(JSON.parse(line)),
        closed: () => undefined,
      },
    )
    const tell = (m: Record<string, unknown>) => input.write(`${JSON.stringify(m)}\n`)
    const last = (t: string) => said.filter((m) => m.t === t).at(-1) ?? {}
    expect(last('state').paired).toBe(false)
    tell({ t: 'lend', path: home })
    await until(() => !!last('problem').words)
    const made = await app.inject({
      method: 'POST',
      url: '/api/computers/link',
      headers: asWindow(),
    })
    tell({ t: 'pair', link: made.json().link })
    await until(() => last('state').online === true)
    const pc = world.computers.of(owner.id)[0]?.id ?? ''
    computers.push(pc)
    // a folder by its real path, as the Bridge lends it
    mkdirSync(join(home, 'Exports'))
    const dir = realpathSync(join(home, 'Exports'))
    tell({ t: 'lend', path: dir })
    await until(() => (last('state').lends as string[] | undefined)?.length === 1)
    await until(() => world.connections.find('folder', dir)?.state === 'connected')
    tell({ t: 'pause', minutes: 60 })
    await until(() => !!(last('state').paused as { until?: string } | null)?.until)
    await until(() => !!bridges.pausedOf(pc))
    tell({ t: 'signout' })
    await until(() => last('state').paired === false)
    expect(keys.get(new URL(alpha).host)).toBeNull()
    expect(world.computers.get(pc)?.removedAt).toBeTruthy()
    expect(said.filter((m) => m.t === 'did').map((m) => m.words)).toContain(
      'Signed out: this computer is no longer paired.',
    )
    input.end()
  })
})

describe('pairing', () => {
  it('is only for an Alpha one person signs in to, for now', async () => {
    world.accounts.add('Priya', 'priya@example.com', {
      actor: { kind: 'person', id: owner.id },
      user: owner.id,
    })
    const made = await app.inject({
      method: 'POST',
      url: '/api/computers/link',
      headers: { host: new URL(alpha).host, 'x-alpha-token': 'test-token' },
    })
    expect(made.statusCode).toBe(409)
    expect(made.json().problem).toMatch(/one person signs in/)
  })

  const key = newKey()
  const said = { publicKey: key.publicPem, name: 'Test Mac', platform: 'darwin' }

  it('takes a link once, and never an old one', () => {
    const { code } = world.computers.link(owner.id)
    expect(world.computers.pair(code, said).user).toBe(owner.id)
    expect(() => world.computers.pair(code, said)).toThrow(/used already/)
    const old = world.computers.link(owner.id)
    world.db.prepare('UPDATE computer_links SET until = ?').run('2000-01-01T00:00:00.000Z')
    expect(() => world.computers.pair(old.code, said)).toThrow(/too old/)
  })

  it('proves a computer only by its own key, and never a removed one', async () => {
    const { createPrivateKey, sign } = await import('node:crypto')
    const pc = world.computers.pair(world.computers.link(owner.id).code, said)
    const signed = (pem: string) =>
      sign(null, Buffer.from('challenge'), createPrivateKey(pem)).toString('base64')
    expect(world.computers.proves(pc.id, 'challenge', signed(key.privatePem))?.id).toBe(pc.id)
    expect(world.computers.proves(pc.id, 'challenge', signed(newKey().privatePem))).toBeNull()
    world.computers.remove(pc.id, { actor: { kind: 'person', id: owner.id }, user: owner.id })
    expect(world.computers.proves(pc.id, 'challenge', signed(key.privatePem))).toBeNull()
  })
})
