// The never-use list (docs/rules.md, N1): what is on it never lands, from any connection, and each
// connection says how many its last read left out. Tried on the rule world with made-up connectors:
// one read in the core, and the connector process a person's computer runs too, spoken to over its
// pipe as the Bridge speaks to it, so what leaves the process can be seen.
import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { createInterface } from 'node:readline'
import { type Connector, MemorySecrets } from '@alpha/connector-sdk'
import { ConnectorService } from '../connectors/service.ts'
import { EVERYONE } from '../world/never.ts'
import { rule } from './rule.ts'
import type { RuleWorld } from './world.ts'

const CHILD = join(import.meta.dirname, '..', 'connectors', 'child.ts')

// What a read brings: one mail on the shipped list, one holding the firm's word, one holding the
// person's own word, and an ordinary one; and two files, one named on the list.
const MAIL = [
  { key: 'm1', values: { Subject: 'Your Lakeview Bank statement is ready' } },
  { key: 'm2', values: { Subject: 'Notes on the Harbor merger' } },
  { key: 'm3', values: { Subject: 'Tickets for the gala' } },
  { key: 'm4', values: { Subject: 'Quote for the kitchen at 14 Elm St' } },
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
    await c.host.keepFile?.('Payslip October.pdf', new TextEncoder().encode('x'), 'application/pdf')
    await c.host.keepFile?.('Quote 14 Elm St.txt', new TextEncoder().encode('y'), 'text/plain')
    return { rows: MAIL.length, sawNew: true }
  },
} as unknown as Connector

const ctx = (w: RuleWorld) => ({
  actor: { kind: 'person' as const, id: w.user.id },
  user: w.user.id,
})

// The firm's word and the owner's own, and a read of the owner's connection and of the firm's.
async function read(w: RuleWorld, madeBy: 'person' | 'firm') {
  w.world.never.add(EVERYONE, 'merger', ctx(w))
  w.world.never.add(w.user.id, 'gala', ctx(w))
  const service = new ConnectorService(w.world, { secrets: new MemorySecrets(), known: [READER] })
  // the owner's own, or one Alpha set up for the firm
  const conn =
    madeBy === 'person'
      ? await service.connect('reader', '/x/mine', null, w.user.id)
      : w.world.connections.add('reader', '/x/firm', null, 'Reader', { actor: { kind: 'system' } })
  await service.sync(conn.id)
  const t = w.world.shape.tables().find((x) => x.name === 'Mail')
  const subjects = t
    ? w.world.records.list(t.id).map((r) => String(Object.values(r.values)[0]))
    : []
  return { subjects, conn: w.world.connections.get(conn.id) }
}

// The connector's own process, as the core and the Bridge start it: one read asked over its pipe
// with a never-use list, and what the process sent back to land.
async function overThePipe(w: RuleWorld): Promise<{ landed: string[]; told: number }> {
  const dir = join(w.world.paths.dir, 'reader')
  mkdirSync(dir, { recursive: true })
  writeFileSync(
    join(dir, 'index.js'),
    `export const connector = {
  manifest: { name: 'reader', title: 'Reader', auth: 'path', account: { label: 'Folder' }, pace: { perMinute: 600 } },
  guide: 'A made-up reader.',
  module: 'Reader',
  tables: [{ name: 'Mail', fields: [{ name: 'Subject', kind: 'text' }] }],
  tools: {},
  sync: async (c) => {
    await c.host.land('Mail', ${JSON.stringify(MAIL)})
    return { rows: 4, sawNew: true }
  },
}
`,
  )
  const child = spawn(process.execPath, [CHILD, join(dir, 'index.js')], { stdio: 'pipe' })
  const send = (m: unknown) => child.stdin.write(`${JSON.stringify(m)}\n`)
  const landed: string[] = []
  let told = 0
  await new Promise<void>((done, fail) => {
    setTimeout(() => fail(new Error('The process did not answer.')), 10_000)
    createInterface({ input: child.stdout }).on('line', (line) => {
      const m = JSON.parse(line)
      if (m.t === 'ready')
        send({
          t: 'req',
          id: 1,
          op: 'sync',
          name: 'reader',
          account: '/x',
          cursor: null,
          options: {
            judgements: { retries: 0, busyWaitMs: 0, fewerRowsRatio: 0.5, quietDays: 30 },
            never: w.world.never.listFor(w.user.id),
          },
        })
      if (m.t === 'host' && m.method === 'land') {
        for (const i of m.params.items) landed.push(i.values.Subject)
        send({ t: 'hostReply', hid: m.hid, result: { added: 0, changed: 0, same: 0 } })
      }
      if (m.t === 'tell' && m.method === 'leftOut') told += m.params.count
      if (m.t === 'res') done()
    })
  })
  child.kill()
  return { landed, told }
}

rule('N1', 'the never-use list applies as things are read', {
  cases: {
    'a read in the core leaves out what is on the list, and the connection says how many': async (
      w,
    ) => {
      const { subjects, conn } = await read(w, 'person')
      return (
        subjects.join('|') === 'Quote for the kitchen at 14 Elm St' && conn?.leftOut === 4 // 3 mails and the payslip
      )
    },
    'a file named on the list is never kept': async (w) => {
      await read(w, 'person')
      const names = w.world.files.list().map((f) => f.name)
      return names.includes('Quote 14 Elm St.txt') && !names.some((n) => /payslip/i.test(n))
    },
    'the firm’s words hold on every connection, a person’s only on their own': async (w) => {
      const { subjects } = await read(w, 'firm')
      return (
        subjects.includes('Tickets for the gala') &&
        !subjects.includes('Notes on the Harbor merger')
      )
    },
    'a kind the owner turned off for everyone is kept again': async (w) => {
      w.world.never.setKind('banking', false, ctx(w))
      const { subjects } = await read(w, 'person')
      return subjects.includes('Your Lakeview Bank statement is ready')
    },
    'on a person’s computer it is left out before it leaves the connector’s process': async (w) => {
      w.world.never.add(EVERYONE, 'merger', ctx(w))
      w.world.never.add(w.user.id, 'gala', ctx(w))
      const { landed, told } = await overThePipe(w)
      return landed.join('|') === 'Quote for the kitchen at 14 Elm St' && told === 3
    },
  },
})
