// Connectors in the core, on recorded answers and a scratch folder: never a real account.
import { createHash } from 'node:crypto'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { gmail } from '@alpha/connector-gmail'
import { type Connector, MemorySecrets } from '@alpha/connector-sdk'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { World } from '../world/world.ts'
import { loadSet, STANDARD_DIR } from './discover.ts'
import { ConnectorService } from './service.ts'

let home: string
let world: World
let secrets: MemorySecrets
let fixtures: string
let known: Connector[]

function record(connector: string, name: string, args: unknown, answer: unknown) {
  const hash = createHash('sha256')
    .update(JSON.stringify(args ?? null))
    .digest('hex')
    .slice(0, 10)
  mkdirSync(join(fixtures, connector), { recursive: true })
  writeFileSync(join(fixtures, connector, `${name}-${hash}.json`), JSON.stringify(answer))
}

beforeEach(async () => {
  known = (await loadSet(STANDARD_DIR)).connectors
  home = mkdtempSync(join(tmpdir(), 'alpha-connectors-'))
  fixtures = join(home, 'fixtures')
  world = await World.open(join(home, 'tenants', 't_test'))
  secrets = new MemorySecrets()
})

afterEach(() => {
  world.close()
  rmSync(home, { recursive: true, force: true })
})

const header = (id: string, subject: string) => ({
  id,
  thread: 't1',
  from: 'Priya <priya@harbor.example>',
  fromAddress: 'priya@harbor.example',
  to: 'Kenil <kenil@example.com>',
  cc: '',
  subject,
  date: '2026-10-18T09:00:00.000Z',
  labels: 'Inbox',
  direction: 'received',
  toAddresses: 'kenil@example.com',
  ccAddresses: '',
  attachments: 'Harbor NDA.pdf',
  unread: true,
  starred: false,
})

describe('a Gmail connection on recorded answers', () => {
  it('keeps the app password in the store, lands mail by message id, and changes it in place', async () => {
    const svc = new ConnectorService(world, { secrets, fixtures, known })
    record('gmail', 'check', {}, '[Gmail]/All Mail')
    record(
      'gmail',
      'sync',
      { cursor: null },
      {
        validity: '7',
        modseq: '100',
        last: 2,
        headers: [header('<a@x>', 'Deal'), header('<b@x>', 'Hello')],
        marks: [],
        total: 2,
      },
    )
    const conn = await svc.connect('gmail', 'kenil@example.com', 'app-pass', 'u_1')
    await svc.sync(conn.id)
    expect(conn.secretRef).toBe('gmail:kenil@example.com')
    expect(await secrets.get('gmail:kenil@example.com')).toBe('app-pass')
    expect(JSON.stringify(world.db.prepare('SELECT * FROM connections').all())).not.toContain(
      'app-pass',
    )
    const mail = world.shape.table('Mail')
    expect(mail?.module.name).toBe('Mail')
    expect(mail?.hidden).toBe(true)
    const rows = world.records.list(mail?.id as string)
    expect(rows.map((r) => r.values.subject)).toEqual(['Deal', 'Hello'])
    expect(rows[0]?.values).toMatchObject({
      direction: 'received',
      to_addresses: 'kenil@example.com',
      attachments: 'Harbor NDA.pdf',
      unread: 'yes',
      starred: 'no',
    })
    expect(rows[0]?.provenance.subject?.source).toMatchObject({
      connector: 'gmail',
      account: 'kenil@example.com',
      item: '<a@x>',
    })
    expect(world.connections.get(conn.id)?.cursor).toBe('v2:7:2:100')

    // Next time: one message changed, one already kept was read and starred, and a mark on an
    // older message not kept is left alone.
    record(
      'gmail',
      'sync',
      { cursor: 'v2:7:2:100' },
      {
        validity: '7',
        modseq: '120',
        last: 3,
        headers: [header('<a@x>', 'Deal, revised')],
        marks: [
          { id: '<b@x>', unread: false, starred: true },
          { id: '<old@x>', unread: false, starred: false },
        ],
        total: 2,
      },
    )
    await svc.sync(conn.id)
    const again = world.records.list(mail?.id as string)
    expect(again).toHaveLength(2)
    expect(again[0]?.values.subject).toBe('Deal, revised')
    expect(again[0]?.version).toBe(2)
    expect(again[1]?.values).toMatchObject({ subject: 'Hello', unread: 'no', starred: 'yes' })
    expect(world.lines({ kinds: ['landed'] }).map((l) => l.words)).toEqual([
      '2 new in Mail from kenil@example.com.',
      '1 changed in Mail from kenil@example.com.',
      '1 changed in Mail from kenil@example.com.',
    ])
  })

  it('says when the account needs the person to sign in again', async () => {
    const svc = new ConnectorService(world, { secrets, fixtures, known })
    record('gmail', 'check', {}, '[Gmail]/All Mail')
    const conn = await svc.connect('gmail', 'kenil@example.com', 'app-pass', 'u_1')
    await secrets.delete('gmail:kenil@example.com')
    // no recorded sync: the replay refuses, as a dead service would
    await svc.sync(conn.id)
    expect(world.connections.get(conn.id)?.state).toBe('broken')
    expect(world.connections.get(conn.id)?.health).toMatch(/No recorded answer/)
  })

  it('declares a send outward with the whole message to show, and a draft a write', () => {
    const svc = new ConnectorService(world, { secrets, known })
    const m = { to: 'priya@harbor.example', subject: 'The CIM', body: 'Could you send it over?' }
    expect(svc.effect('mcp__gmail__send', m)).toBe('outward')
    expect(svc.effect('mcp__gmail__draft', m)).toBe('write')
    expect(svc.effect('mcp__gmail__search', { query: 'from:priya' })).toBe('read')
    expect(svc.effect('mcp__alpha__write', {})).toBeUndefined()
    expect(svc.words('mcp__gmail__send', m)).toBe('Send an email to priya@harbor.example')
    expect(svc.keyOf('mcp__gmail__send')).toBe('gmail_send')
    expect(svc.preview('mcp__gmail__send', m)).toEqual({
      words: 'Send an email to priya@harbor.example: “The CIM”',
      detail: 'To: priya@harbor.example\nSubject: The CIM\n\nCould you send it over?',
      yes: 'Send it',
    })
    expect(svc.toolNames()).toContain('mcp__gmail__send')
    expect(Object.keys(svc.servers()).sort()).toEqual(['calendar', 'contacts', 'gmail'])
    expect(svc.connector('calendar').manifest.auth).toBe('system')
    expect(svc.connector('calendar').manifest.system?.pane).toBe('Calendars')
  })

  it('answers for the set it was given, and refuses a name the model’s own servers use', () => {
    const only = new ConnectorService(world, { secrets, known: [gmail] })
    expect(only.known().map((c) => c.manifest.name)).toEqual(['gmail'])
    expect(() => only.connector('calendar')).toThrow(/no connector called calendar/)
    expect(only.toolNames()).toEqual([
      'mcp__gmail__draft',
      'mcp__gmail__read',
      'mcp__gmail__search',
      'mcp__gmail__send',
    ])
    const alpha = { ...gmail, manifest: { ...gmail.manifest, name: 'alpha' } }
    expect(() => new ConnectorService(world, { secrets, known: [alpha] })).toThrow(
      /cannot be called/,
    )
    expect(() => new ConnectorService(world, { secrets, known: [gmail, gmail] })).toThrow(
      /loaded already/,
    )
  })

  it('keeps a connection whose connector is not loaded, waiting, and reads it again once added', async () => {
    const svc = new ConnectorService(world, { secrets, fixtures, known: [gmail] })
    record('gmail', 'check', {}, '[Gmail]/All Mail')
    const conn = await svc.connect('gmail', 'kenil@example.com', 'app-pass', 'u_1')
    const without = new ConnectorService(world, { secrets, fixtures })
    expect(without.find('gmail')).toBeUndefined()
    await expect(without.syncDue()).resolves.toBeUndefined()
    expect(without.reading()).toEqual([])
    expect(without.describe()).toMatch(/gmail: kenil@example.com \(its connector is not loaded/)
    without.add(gmail)
    expect(without.connector('gmail').manifest.title).toBe('Gmail')
    expect(() => without.drop('gmail')).toThrow(/Gmail is connected: disconnect it first/)
    await without.disconnect(conn.id, 'u_1')
    expect(without.drop('gmail').manifest.name).toBe('gmail')
  })
})

describe('a watched folder', () => {
  it('keeps what is new or changed in it, once, and reads it with its places', async () => {
    const dir = join(home, 'Exports')
    mkdirSync(dir)
    writeFileSync(join(dir, 'pl.csv'), 'Account,June\nRevenue,1200\n')
    writeFileSync(join(dir, '.DS_Store'), 'x')
    const svc = new ConnectorService(world, { secrets, known })
    const conn = await svc.connect('folder', dir, null, 'u_1')
    await svc.sync(conn.id)
    expect(world.files.documents().map((d) => [d.title, d.kind, d.chunks])).toEqual([
      ['pl.csv', 'sheet', 4],
    ])
    await svc.sync(conn.id)
    expect(world.files.documents()).toHaveLength(1)
    writeFileSync(join(dir, 'notes.txt'), 'call the broker\n')
    await svc.sync(conn.id)
    expect(world.files.documents().map((d) => d.title)).toEqual(['pl.csv', 'notes.txt'])
    expect(world.search('Revenue').find((h) => h.what === 'document')?.where).toContain(
      '"cell":"A2"',
    )
  })

  it('says plainly when the folder is not there', async () => {
    const svc = new ConnectorService(world, { secrets, known })
    await expect(svc.connect('folder', join(home, 'nowhere'), null, 'u_1')).rejects.toThrow(
      /There is no folder/,
    )
  })
})
