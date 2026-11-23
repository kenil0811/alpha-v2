// What Alpha read: each read's counts are counted in the host every connector goes through and
// kept on its journal line, and the report sums them per source, with the rows made, who allowed
// it, and only the person's own sources for a member. A made-up reader; never a real account.
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { type Connector, MemorySecrets } from '@alpha/connector-sdk'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ConnectorService } from '../connectors/service.ts'
import type { User } from '../world/world.ts'
import { World } from '../world/world.ts'
import type { BaseCtx } from './ctx.ts'
import { readReport, said } from './read-report.ts'

// four on the never-use list, one ordinary; two files, one named on the list
const MAIL = [
  { key: 'm1', values: { Subject: 'Your Lakeview Bank statement is ready' } },
  { key: 'm2', values: { Subject: 'Your lab results are in' } },
  { key: 'm3', values: { Subject: 'Your verification code is 482913' } },
  { key: 'm4', values: { Subject: 'Quote for the kitchen at 14 Elm St' } },
  { key: 'm5', values: { Subject: 'Your password reset' } },
]

const READER = {
  manifest: {
    name: 'reader',
    title: 'Reader',
    auth: 'path',
    account: { label: 'Folder' },
    pace: { perMinute: 600 },
  },
  guide: 'A made-up reader.',
  module: 'Reader',
  tables: [{ name: 'Mail', fields: [{ name: 'Subject', kind: 'text' }] }],
  tools: {},
  sync: async (c: Parameters<NonNullable<Connector['sync']>>[0]) => {
    await c.host.land('Mail', MAIL)
    // one this read only keeps up to date, and so passes over
    await c.host.land('Mail', [{ key: 'm9', values: { Subject: 'Lunch' } }], { existing: true })
    await c.host.keepFile?.('Payslip October.pdf', new TextEncoder().encode('x'), 'application/pdf')
    await c.host.keepFile?.('Quote 14 Elm St.txt', new TextEncoder().encode('y'), 'text/plain')
    return { rows: MAIL.length, sawNew: true }
  },
} as unknown as Connector

let home: string
let world: World
let owner: User
let service: ConnectorService

beforeEach(async () => {
  home = mkdtempSync(join(tmpdir(), 'alpha-read-report-'))
  world = await World.open(join(home, 'tenants', 't_test'))
  owner = world.owner('Kenil')
  service = new ConnectorService(world, { secrets: new MemorySecrets(), known: [READER] })
})

afterEach(() => {
  world.close()
  rmSync(home, { recursive: true, force: true })
})

const as = (user: User) =>
  readReport({ world, engine: { connectors: service }, user } as unknown as BaseCtx)

describe('What Alpha read', () => {
  it('sums what each read met, kept, left out and passed over, with the rows it made', async () => {
    const conn = await service.connect('reader', '/x/mine', null, owner.id)
    await service.sync(conn.id)
    const mail = world.shape.tables().find((t) => t.name === 'Mail')
    const [row] = world.records.list(mail?.id as string)
    // the line in Activity says the counts, and is the owner's
    const first = world.lines({ kinds: ['connection_read'], limit: 1 })[0]
    expect(first?.words).toBe(
      'Read /x/mine: 8 items, 2 new. Left out 5 on the never-use list. Passed over 1 it does not bring in (deleted before, or only kept up to date here).',
    )
    expect(first?.user).toBe(owner.id)
    expect(first?.data.allowedBy).toBe(`person:${owner.id}`)
    await service.sync(conn.id)

    const r = as(owner)
    expect(r.says).toBe("I've read 12 emails and 4 files")
    expect(r.reading).toBe(false)
    const [s] = r.sources
    expect(s).toMatchObject({ title: 'Reader', account: '/x/mine', reads: 2, off: null })
    expect(s?.allowed?.by).toBe('You')
    const m = s?.tables.find((t) => t.name === 'Mail')
    expect(m).toMatchObject({ read: 12, leftOut: 8, skipped: 2, kept: 2, added: 1, changed: 0 })
    expect(m?.rows).toEqual([row?.id])
    expect(m?.table).toBe(mail?.id)
    const f = s?.tables.find((t) => t.name === 'Files')
    expect(f).toMatchObject({ table: null, read: 4, leftOut: 2, kept: 2, added: 1 })
  })

  it('shows a member only their own sources, and the owner every one', async () => {
    const member = world.user(
      world.accounts.add('Priya', 'priya@example.com', { actor: { kind: 'person', id: owner.id } })
        .id,
    ) as User
    await service.sync((await service.connect('reader', '/x/owner', null, owner.id)).id)
    await service.sync((await service.connect('reader', '/x/priya', null, member.id)).id)
    expect(as(member).sources.map((s) => s.account)).toEqual(['/x/priya'])
    expect(as(owner).sources.map((s) => s.account)).toEqual(['/x/owner', '/x/priya'])
    expect(as(member).says).toBe("I've read 6 emails and 2 files")
  })

  it('says a source switched off, and nothing before any read', async () => {
    const conn = world.connections.add('reader', '/x/off', null, 'Reader', {
      actor: { kind: 'person', id: owner.id },
    })
    world.connections.setState(conn.id, 'paused', null, 'Paused.', {
      actor: { kind: 'person', id: owner.id },
    })
    const r = as(owner)
    expect(r.says).toBeNull()
    expect(r.sources[0]?.off).toMatch(/^Switched off/)
  })

  it('puts the counts in one sentence', () => {
    const t = (name: string, read: number) => ({
      table: null,
      name,
      read,
      kept: 0,
      added: 0,
      changed: 0,
      leftOut: 0,
      skipped: 0,
      rows: [],
    })
    const s = (tables: ReturnType<typeof t>[]) =>
      ({ tables }) as unknown as Parameters<typeof said>[0][number]
    expect(said([s([t('Mail', 1204), t('Events', 38)]), s([t('Pages', 212)])], true)).toBe(
      "I've read 1,204 emails, 38 events and 212 pages so far",
    )
    expect(said([s([t('Mail', 0)])], false)).toBeNull()
  })
})
