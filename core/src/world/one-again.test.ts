// A list relation back to one (core plan step 4, Accounting): a kit that says one, over an installed
// copy holding a list no one made, brings it back to one when no row holds two; a list someone made
// stays theirs, and a row holding two keeps the list, said in words.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, expect, it } from 'vitest'
import { install, update } from '../modules/kits/index.ts'
import type { Table } from './shape/index.ts'
import { World } from './world.ts'

const person = { actor: { kind: 'person' as const, id: 'u_1' }, user: 'u_1' }
const looked = { kind: 'looked_up' as const, source: { url: 'https://example.com' } }
let home: string
let world: World

beforeEach(async () => {
  home = mkdtempSync(join(tmpdir(), 'alpha-one-again-'))
  world = await World.open(join(home, 'tenants', 't_test'))
})
afterEach(() => {
  world.close()
  rmSync(home, { recursive: true, force: true })
})

// A Book kit whose Jobs name their client; Client held as a list the way the move to real tables
// left some (no journal line saying anyone made it one).
async function book(version: string, partOf = false) {
  const kit = join(home, 'kit')
  mkdirSync(kit, { recursive: true })
  writeFileSync(
    join(kit, 'module.yaml'),
    `name: Book
version: ${version}
api: 1
business_case: { for: The owner, keeps: Jobs, decides: Whom to bill }
tables:
  - name: Clients
    fields:
      - { name: Name, kind: text }
      - { name: Since, kind: date }
  - name: Jobs
    fields:
      - { name: Job, kind: text }
      - { name: Client, kind: relation, relates_to: Clients${partOf ? ', part_of: true' : ''} }
`,
  )
  return kit
}

function asAList(jobs: Table) {
  const f = jobs.fields.find((x) => x.name === 'Client')
  world.db.exec(`CREATE TABLE "jobs__client" (record_id TEXT NOT NULL, other_id TEXT NOT NULL,
    position INTEGER NOT NULL, PRIMARY KEY (record_id, other_id)) STRICT`)
  world.db.exec(
    `INSERT INTO "jobs__client" SELECT id, client, 0 FROM jobs WHERE client IS NOT NULL`,
  )
  world.db.exec(`DROP INDEX IF EXISTS ${JSON.stringify(`idx_${jobs.id}_${f?.id}`)}`)
  world.db.exec('ALTER TABLE jobs DROP COLUMN client')
  world.db
    .prepare(`UPDATE fields SET options = json_set(options, '$.many', json('true')) WHERE id = ?`)
    .run(f?.id as string)
}

it('comes back to one through a kit update, each row its one client, and parts follow', async () => {
  const m = await install(world, await book('0.1.0'), person)
  const clients = world.shape.table('Clients') as Table
  const [acme] = world.records.add(
    clients.id,
    [{ values: { Name: 'Acme' }, provenance: looked }],
    person,
  ) as [string]
  const jobs = world.shape.table('Jobs') as Table
  world.records.add(
    jobs.id,
    [
      { values: { Job: 'Roof', Client: acme }, provenance: looked },
      { values: { Job: 'Gutter', Client: acme }, provenance: looked },
    ],
    person,
  )
  asAList(jobs)
  expect(world.shape.table(jobs.id)?.fields.find((f) => f.name === 'Client')?.many).toBe(true)
  await update(world, m.id, await book('0.2.0', true), person)
  const after = world.shape.table(jobs.id) as Table
  const client = after.fields.find((f) => f.name === 'Client')
  expect(client?.many).toBeFalsy()
  expect(client?.partOf).toBe(true)
  expect(world.records.list(jobs.id).map((r) => r.values.client)).toEqual([acme, acme])
  expect(world.lines({ kinds: ['shaped'] }).map((l) => l.words)).toContain(
    'Client in Jobs holds one row again.',
  )
})

it('keeps a list someone made, and a list a row holds two in, saying why', async () => {
  const m = await install(world, await book('0.1.0'), person)
  const clients = world.shape.table('Clients') as Table
  const [acme, bolt] = world.records.add(
    clients.id,
    [
      { values: { Name: 'Acme' }, provenance: looked },
      { values: { Name: 'Bolt' }, provenance: looked },
    ],
    person,
  ) as [string, string]
  const jobs = world.shape.table('Jobs') as Table
  asAList(jobs)
  world.records.add(
    jobs.id,
    [{ values: { Job: 'Shared', Client: [acme, bolt] }, provenance: looked }],
    person,
  )
  await update(world, m.id, await book('0.2.0'), person)
  expect(world.shape.table(jobs.id)?.fields.find((f) => f.name === 'Client')?.many).toBe(true)
  expect(world.lines({ kinds: ['noted'] }).at(-1)?.words).toBe(
    '1 row of Jobs names more than one in Client, so it keeps its list.',
  )
  // a list made by a shape change is the maker's: a later version saying one leaves it
  const t2 = world.shape.makeTable(
    m.id,
    'Visits',
    [
      { name: 'Day', kind: 'date' },
      { name: 'Client', kind: 'relation', relatesTo: 'Clients' },
    ],
    person,
  )
  world.shape.setMany(t2.id, 'Client', person)
  expect(() => world.shape.setOne(t2.id, 'Nope', person)).toThrow()
  expect(world.shape.table(t2.id)?.fields.find((f) => f.name === 'Client')?.many).toBe(true)
})
