// Read now on a table: the connections that fill it, found by its lasting key,
// each with when it was read and why it can't be read now; one press reads every one that can.
// On recorded answers (two made-up Gmail accounts filling Mail), never a real account.
import { createHash } from 'node:crypto'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { MemorySecrets } from '@alpha/connector-sdk'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { loadSet, STANDARD_DIR } from '../connectors/discover.ts'
import { ConnectorService } from '../connectors/service.ts'
import { Engine } from '../engine/engine.ts'
import { World } from '../world/world.ts'
import { buildServer } from './server.ts'
import type { TableView } from './types.ts'

const token = 'secret-token'
const ok = { host: '127.0.0.1:4700', 'x-alpha-token': token }
let home: string
let world: World
let engine: Engine
let svc: ConnectorService

function record(name: string, args: unknown, answer: unknown) {
  const hash = createHash('sha256')
    .update(JSON.stringify(args ?? null))
    .digest('hex')
    .slice(0, 10)
  mkdirSync(join(home, 'fixtures', 'gmail'), { recursive: true })
  writeFileSync(join(home, 'fixtures', 'gmail', `${name}-${hash}.json`), JSON.stringify(answer))
}

const page = (id: string, subject: string, last = 1) => ({
  validity: '7',
  modseq: String(last * 100),
  last,
  total: last,
  marks: [],
  headers: [
    {
      id,
      thread: id,
      from: 'Priya <priya@harbor.example>',
      fromAddress: 'priya@harbor.example',
      to: 'me@example.com',
      cc: '',
      subject,
      date: '2026-10-18T09:00:00.000Z',
      labels: 'Inbox',
      direction: 'received',
      toAddresses: 'me@example.com',
      ccAddresses: '',
      attachments: '',
      unread: true,
      starred: false,
    },
  ],
})

beforeEach(async () => {
  home = mkdtempSync(join(tmpdir(), 'alpha-readnow-'))
  world = await World.open(join(home, 'tenants', 't_test'))
  const known = (await loadSet(STANDARD_DIR)).connectors
  svc = new ConnectorService(world, {
    secrets: new MemorySecrets(),
    fixtures: join(home, 'fixtures'),
    known,
  })
  engine = new Engine(world, { connectors: svc })
  record('check', {}, '[Gmail]/All Mail')
  record('sync', { cursor: null }, page('<a@x>', 'Deal'))
  record('sync', { cursor: 'v2:7:1:100' }, page('<b@x>', 'Hello', 2))
})

// connected, and its first read done
const connected = async (account: string) => {
  const k = await svc.connect('gmail', account, 'pass', 'u_1')
  await svc.sync(k.id)
  return k
}
const cursor = (id: string) => world.connections.get(id)?.cursor

afterEach(() => {
  engine.close()
  world.close()
  rmSync(home, { recursive: true, force: true })
})

const app = () => buildServer({ engine, user: world.owner('Kenil'), token, ports: [4700] })

describe('Read now on a table', () => {
  it('lists what fills it, by its key after a rename, and reads every one that can be read', async () => {
    const work = await connected('work@example.com')
    const home2 = await connected('home@example.com')
    const mail = world.shape.table('Mail') as { id: string }
    world.shape.rename({ table: mail.id }, 'Inbox', { actor: { kind: 'person', id: 'u_1' } })
    const a = app()
    const view = async () =>
      (await a.inject({ url: `/api/tables/${mail.id}`, headers: ok })).json() as TableView
    const by = (await view()).readBy
    expect(by.map((r) => [r.title, r.account, r.reason])).toEqual([
      ['Gmail', 'work@example.com', null],
      ['Gmail', 'home@example.com', null],
    ])
    expect(by.every((r) => r.lastReadAt)).toBe(true)
    // one press reads both: each goes on from where it was
    expect([cursor(work.id), cursor(home2.id)]).toEqual(['v2:7:1:100', 'v2:7:1:100'])
    const res = await a.inject({ method: 'POST', url: `/api/tables/${mail.id}/read`, headers: ok })
    expect(res.json()).toEqual({ read: ['Gmail', 'Gmail'] })
    expect([cursor(work.id), cursor(home2.id)]).toEqual(['v2:7:2:200', 'v2:7:2:200'])
    expect(world.records.list(mail.id).map((r) => r.values.subject)).toContain('Hello')
    await a.close()
  })

  it('greys one waiting on a sign-in with its reason, and reads the others', async () => {
    const work = await connected('work@example.com')
    const other = await connected('home@example.com')
    world.connections.setState(other.id, 'needs_sign_in', null, 'Gmail needs you.', {
      actor: { kind: 'connector', id: 'gmail' },
    })
    const mail = world.shape.table('Mail') as { id: string }
    const a = app()
    const by = (
      (await a.inject({ url: `/api/tables/${mail.id}`, headers: ok })).json() as TableView
    ).readBy
    expect(by.find((r) => r.connection === other.id)?.reason).toBe(
      'Gmail needs you to sign in again, in Intelligence › Connections.',
    )
    const res = await a.inject({ method: 'POST', url: `/api/tables/${mail.id}/read`, headers: ok })
    expect(res.json()).toEqual({ read: ['Gmail'] })
    expect([cursor(work.id), cursor(other.id)]).toEqual(['v2:7:2:200', 'v2:7:1:100'])
    expect(world.connections.get(other.id)?.state).toBe('needs_sign_in')
    await a.close()
  })

  it('says so on a table nothing reads into', async () => {
    const m = world.shape.makeModule('Garden', { actor: { kind: 'alpha' } })
    const beds = world.shape.makeTable(m.id, 'Beds', [{ name: 'Name', kind: 'text' }], {
      actor: { kind: 'alpha' },
    })
    const a = app()
    const view = (
      await a.inject({ url: `/api/tables/${beds.id}`, headers: ok })
    ).json() as TableView
    expect(view.readBy).toEqual([])
    const res = await a.inject({ method: 'POST', url: `/api/tables/${beds.id}/read`, headers: ok })
    expect(res.json().problem).toBe('Nothing reads into Beds: it is kept by hand.')
    await a.close()
  })
})
