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
