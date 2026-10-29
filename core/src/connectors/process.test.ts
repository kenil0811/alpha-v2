// A connector runs in its own process (step 2, part 1, slice 1, Kenil's yes 29 Oct): the core holds
// a stand-in built from what the process says of it, and every call goes over the pipe, the
// connector's host answered by the core.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { MemorySecrets } from '@alpha/connector-sdk'
import { afterEach, beforeEach, expect, it } from 'vitest'
import { World } from '../world/world.ts'
import { loadSet } from './discover.ts'
import { isRemote, named } from './process.ts'
import { ConnectorService } from './service.ts'

let home: string
let world: World
beforeEach(async () => {
  home = mkdtempSync(join(tmpdir(), 'alpha-cproc-'))
  world = await World.open(join(home, 'tenants', 't_test'))
})
afterEach(() => {
  world.close()
  rmSync(home, { recursive: true, force: true })
})

// A connector that says which process it is in, and lands one row through its host.
function pidConnector(dir: string) {
  mkdirSync(dir, { recursive: true })
  writeFileSync(
    join(dir, 'package.json'),
    JSON.stringify({ name: 'pid-check', type: 'module', exports: './index.js' }),
  )
  writeFileSync(
    join(dir, 'index.js'),
    `export const connector = {
  manifest: { name: 'pidcheck', title: 'Pid check', auth: 'path', account: { label: 'Folder' }, pace: { perMinute: 600 } },
  guide: '# Pid check\\n\\nSays where it runs.',
  module: 'Pid check',
  tables: [{ name: 'Pids', fields: [{ name: 'Pid', kind: 'number' }] }],
  tools: {},
  check: async (c) => { c.host.journal('pid ' + process.pid, { pid: process.pid }) },
  sync: async (c) => {
    c.host.land('Pids', [{ key: String(process.pid), values: { Pid: process.pid } }])
    return { rows: 1, sawNew: true }
  },
}
`,
  )
}

it('runs a connector in its own process, its host answered by the core over the pipe', async () => {
  const root = join(home, 'connectors')
  pidConnector(join(root, 'pid-check'))
  const loaded = await loadSet(root)
  expect(loaded.failed).toEqual([])
  const svc = new ConnectorService(world, {
    secrets: new MemorySecrets(),
    known: loaded.connectors,
  })
  const user = world.owner('Kenil')
  const conn = await svc.connect('pidcheck', '/tmp', null, user.id)
  await svc.sync(conn.id)
  const said = world.lines({ kinds: ['connector_call'] }).find((l) => l.words.startsWith('pid '))
  const pid = Number(said?.data.pid)
  expect(pid).toBeGreaterThan(0)
  expect(pid).not.toBe(process.pid)
  const pids = world.shape.table('Pids')
  expect(pids && world.records.list(pids.id).map((r) => r.values.pid)).toEqual([pid])
  svc.close()
}, 30_000)

// Step 2, part 1, slice 2: the browser a connector asks for opens only the hosts it may reach, and
// a host the person approved joins them.
it('opens in the browser only the hosts a connector may reach, and those the person approved', async () => {
  const root = join(home, 'connectors')
  const dir = join(root, 'browsing')
  mkdirSync(dir, { recursive: true })
  writeFileSync(
    join(dir, 'package.json'),
    JSON.stringify({ name: 'browsing', type: 'module', exports: './index.js' }),
  )
  writeFileSync(
    join(dir, 'index.js'),
    `export const connector = {
  manifest: { name: 'browsing', title: 'Browsing', auth: 'path', account: { label: 'Folder' }, pace: { perMinute: 600 }, reaches: ['www.example.com'], chosenSites: true },
  guide: '# Browsing', module: 'Browsing', tables: [], tools: {},
  sync: async (c) => {
    await c.host.browser().signedIn('https://www.example.com/in')
    await c.host.browser().signedIn('https://tracker.example.net/x')
    return { rows: 0, sawNew: false }
  },
}
`,
  )
  const opened: string[] = []
  const svc = new ConnectorService(world, {
    secrets: new MemorySecrets(),
    known: (await loadSet(root)).connectors,
    browser: () => ({ signedIn: async (url: string) => opened.push(url) > 0 }) as never,
  })
  const user = world.owner('Kenil')
  const conn = await svc.connect('browsing', '/tmp', null, user.id)
  await svc.sync(conn.id)
  expect(opened).toEqual(['https://www.example.com/in'])
  expect(world.lines({ kinds: ['reach_refused'] }).map((l) => l.words)).toEqual([
    'Browsing tried to reach tracker.example.net: refused.',
  ])
  const c = svc.find('browsing')
  world.connections.approve(conn.id, 'tracker.example.net', {
    actor: { kind: 'person', id: user.id },
    user: user.id,
  })
  expect(c && isRemote(c) && c.remote.process.hosts()).toEqual([
    'www.example.com',
    'tracker.example.net',
  ])
  svc.close()
}, 30_000)

it('names a host by itself, by its port, or under a wildcard', () => {
  const list = ['imap.gmail.com:993', 'www.example.com', '*.example.org']
  expect(named(list, 'imap.gmail.com', '993')).toBe(true)
  expect(named(list, 'imap.gmail.com', '143')).toBe(false)
  expect(named(list, 'www.example.com', '443')).toBe(true)
  expect(named(list, 'example.com', '443')).toBe(false)
  expect(named(list, 'a.example.org', '443')).toBe(true)
})
