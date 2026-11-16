// A person's computer through the Bridge, end to end on this machine: the core's server and its
// door, a Bridge paired with a link and connected over a real websocket, and the Bridge's own
// connector process reading a scratch folder. Its key is held in memory: never a real Alpha, a
// computer's own key store or the Keychain.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Bridge, pair } from '@alpha/bridge'
import type { Config } from '@alpha/bridge/config'
import { inMemory, newKey } from '@alpha/bridge/keys'
import { MemorySecrets } from '@alpha/connector-sdk'
import type { FastifyInstance } from 'fastify'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { buildServer } from '../api/server.ts'
import { lend, unlend } from '../connectors/computers.ts'
import { loadSet, STANDARD_DIR } from '../connectors/discover.ts'
import { ConnectorService } from '../connectors/service.ts'
import { Engine } from '../engine/engine.ts'
import type { User } from '../world/world.ts'
import { World } from '../world/world.ts'
import { bridges } from './hub.ts'

const CHILD = join(import.meta.dirname, '..', 'connectors', 'child.ts')
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
  const known = (await loadSet(STANDARD_DIR)).connectors.filter((c) => c.manifest.name === 'folder')
  // a server's core: a folder runs only on a person's computer
  service = new ConnectorService(world, { secrets: new MemorySecrets(), known, server: true })
  engine = new Engine(world, { connectors: service })
  bridges.use(world, {
    notify: () => undefined,
    lend: (pc, name, account) => lend(service, world, pc, name, account),
    unlend: (pc, name, account) => {
      const k = world.connections.find(name, account)
      if (k) unlend(world, pc, k, `${pc.name} no longer lends it.`)
    },
  })
  const port = await freePort()
  app = buildServer({ engine, user: owner, token: 'test-token', ports: [port] })
  await app.listen({ host: '127.0.0.1', port })
  alpha = `http://127.0.0.1:${port}`
})

afterEach(async () => {
  bridge?.stop()
  bridge = null
  // the door hears the Bridge go before the world closes
  await until(() => world.computers.of(owner.id).every((c) => !bridges.online(c.id)))
  await app.close()
  engine.close()
  world.close()
  rmSync(home, { recursive: true, force: true })
})

// A Bridge on this machine, its folder lent, its connector process run as the core runs its own.
async function lendFolder(): Promise<{ dir: string; config: Config }> {
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
  bridge = new Bridge({
    config: () => config,
    keys,
    start: async () => ({ command: process.execPath, args: [CHILD, FOLDER], shell: false }),
  })
  bridge.run()
  return { dir, config }
}

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

  it('waits for a computer that is away, and catches up when it is back', async () => {
    const { dir } = await lendFolder()
    await until(() => world.files.documents().length === 1)
    bridge?.stop()
    await until(() => !bridges.online(world.computers.of(owner.id)[0]?.id ?? ''))
    const conn = world.connections.find('folder', dir)
    writeFileSync(join(dir, 'notes.txt'), 'call the broker\n')
    await service.sync(conn?.id ?? '')
    expect(world.connections.get(conn?.id ?? '')?.health).toBe('Waiting for Test Mac')
    expect(world.files.documents()).toHaveLength(1)
    bridge?.run()
    await until(() => bridges.online(conn?.computer ?? ''))
    await service.sync(conn?.id ?? '')
    expect(world.files.documents().map((d) => d.title)).toEqual(['pl.csv', 'notes.txt'])
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
