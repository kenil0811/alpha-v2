// A script's reach through the connectors its kit uses: a tool that only reads, an item's files
// on a row, each behind its walls and the gates; rows.land's rows; and a kit test that seeds a
// used kit's and a connector's tables.
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { BrowserEngine } from '@alpha/connector-sdk'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { World } from '../world/world.ts'
import { install } from './kits/index.ts'
import { kitTest } from './kittest.ts'
import { AgentRunner, type ConnectorTools } from './runs/index.ts'

const KIT = join(import.meta.dirname, 'test-kit')
let home: string
let world: World
const ctx = { actor: { kind: 'person' as const, id: 'u_1' }, user: 'u_1' }
const engine = {} as unknown as BrowserEngine

beforeEach(async () => {
  home = mkdtempSync(join(tmpdir(), 'alpha-connected-'))
  world = await World.open(join(home, 'tenants', 't_test'))
})
afterEach(() => {
  world.close()
  rmSync(home, { recursive: true, force: true })
})

// A made-up mail connector: read and search only read, draft writes, send goes outward.
const ran: string[] = []
const mail: ConnectorTools = {
  tool: (connector, tool) => {
    if (connector !== 'mail') return null
    const effect = ({ read: 'read', draft: 'write', send: 'outward' } as const)[tool as 'read']
    return effect ? { effect, words: `Mail ${tool}` } : null
  },
  carries: (connector) => connector === 'mail',
  run: async (_c, tool, input) => {
    ran.push(tool)
    return { text: `the text of ${String(input.message)}` }
  },
  files: async (_c, item) => [
    {
      name: `${item}.txt`,
      mime: 'text/plain',
      bytes: new TextEncoder().encode('Hi'),
      inline: false,
    },
    { name: 'logo.txt', mime: 'text/plain', bytes: new TextEncoder().encode('logo'), inline: true },
  ],
}

// The test kit, using the mail connector, its Orders taking invoices, run as a try of a script.
async function tried(script: string) {
  const dir = join(home, 'kit')
  cpSync(KIT, dir, { recursive: true })
  const yaml = readFileSync(join(dir, 'module.yaml'), 'utf8')
    .replace('api: 1\n', 'api: 1\nuses:\n  - { connector: mail, tables: [] }\n')
    .replace(
      '  - name: Orders\n    about: One order placed with a supplier.\n',
      '  - name: Orders\n    about: One order placed with a supplier.\n    documents: [Invoice]\n',
    )
  writeFileSync(join(dir, 'module.yaml'), yaml)
  mkdirSync(join(dir, 'skills', 'mail'), { recursive: true })
  writeFileSync(join(dir, 'skills', 'mail', 'run.js'), script)
  const m = await install(world, dir, ctx)
  const runner = new AgentRunner(world, () => engine, { owner: 'u_1' })
  runner.connectors = mail
  ran.length = 0
  return runner.runScript(m, 'skills/mail/run.js', {}, 'A try', null)
}

const order =
  "const { rows: [row] } = await alpha.rows.land('Orders', [{ key: 'o1', values: { Item: 'Flour' } }]);"

describe('alpha.connectors.read', () => {
  it('runs a tool that only reads, of a connector the kit uses, and says so in the run', async () => {
    const out = await tried(
      "export default async (alpha) => ({ words: (await alpha.connectors.read('mail', 'read', { message: 'm1' })).text })",
    )
    expect(out.words).toBe('A try: the text of m1')
    expect(ran).toEqual(['read'])
    expect(world.lines({ kinds: ['run_step'] }).some((l) => l.words === 'Mail read.')).toBe(true)
  }, 60_000)

  it('refuses a tool that writes or goes outward, before it runs', async () => {
    for (const tool of ['draft', 'send']) {
      const out = await tried(
        `export default async (alpha) => alpha.connectors.read('mail', '${tool}', { to: 'a@b.com' })`,
      )
      expect(out.state).toBe('failed')
      expect(out.words).toMatch(/A try may only read through mail: .* the person's to do/)
      expect(ran).toEqual([])
      world.close()
      world = await World.open(join(home, 'tenants', `t_${tool}`))
      rmSync(join(home, 'kit'), { recursive: true, force: true })
    }
  }, 90_000)

  it('refuses a connector the kit does not name in uses', async () => {
    const out = await tried(
      "export default async (alpha) => alpha.connectors.read('calendar', 'read', {})",
    )
    expect(out.words).toMatch(/may not reach calendar: .* names no such connector in uses/)
  }, 60_000)

  it('is refused by the person’s deny rule, as the model’s read would be', async () => {
    const dir = join(home, 'kit')
    const before = await tried('export default async () => ({ words: "installed" })')
    expect(before.state).toBe('ok')
    const m = world.shape.module('Bakery')
    world.rules.save(
      { side: 'deny', module: m?.id ?? null, agent: null, covers: { does: ['read'] }, said: null },
      ctx,
    )
    writeFileSync(
      join(m?.dir ?? dir, 'skills', 'mail', 'run.js'),
      "export default async (alpha) => alpha.connectors.read('mail', 'read', { message: 'm1' })",
    )
    const runner = new AgentRunner(world, () => engine, { owner: 'u_1' })
    runner.connectors = mail
    ran.length = 0
    const out = await runner.runScript(m as never, 'skills/mail/run.js', {}, 'A try', null)
    expect(out.words).toMatch(/Refused by the person's rule/)
    expect(ran).toEqual([])
  }, 60_000)
})

describe('alpha.connectors.file', () => {
  it('puts an item’s files, not its inline ones, on a row as a kind its table takes', async () => {
    const out = await tried(
      `export default async (alpha) => { ${order} const put = await alpha.connectors.file('mail', 'm1', 'Orders', row, 'Invoice'); return { words: put.map((f) => f.name + ' ' + f.kind).join(), file: put[0].file } }`,
    )
    expect(out.words).toBe('A try: m1.txt Invoice')
    const row = world.records.list(world.shape.table('Orders')?.id ?? '')[0]
    expect(world.rowsOfFile((out.result as { file: string }).file)).toEqual([
      expect.objectContaining({ record: row?.id, kind: 'Invoice' }),
    ])
  }, 60_000)

  it('refuses a kind the table does not take, and a table that takes none', async () => {
    const wrong = await tried(
      `export default async (alpha) => { ${order} return alpha.connectors.file('mail', 'm1', 'Orders', row, 'Receipt') }`,
    )
    expect(wrong.words).toMatch(/Orders's rows take Invoice; Receipt is not one of them/)
    world.close()
    world = await World.open(join(home, 'tenants', 't_two'))
    rmSync(join(home, 'kit'), { recursive: true, force: true })
    const none = await tried(
      "export default async (alpha) => { const { rows: [row] } = await alpha.rows.land('Suppliers', [{ key: 's', values: { Name: 'X' } }]); return alpha.connectors.file('mail', 'm1', 'Suppliers', row, 'Invoice') }",
    )
    expect(none.words).toMatch(/Suppliers takes no documents/)
  }, 90_000)

  it('refuses a table that is not the module’s own', async () => {
    const other = world.shape.makeModule('Elsewhere', { actor: { kind: 'alpha' } })
    const t = world.shape.makeTable(other.id, 'Secrets', [{ name: 'Name', kind: 'text' }], {
      actor: { kind: 'alpha' },
    })
    const [rec] = world.records.add(
      t.id,
      [{ values: { Name: 'x' }, provenance: { kind: 'estimated', basis: 'the test' } }],
      ctx,
    )
    const out = await tried(
      `export default async (alpha) => alpha.connectors.file('mail', 'm1', 'Secrets', '${rec}', 'Invoice')`,
    )
    expect(out.words).toMatch(/may write only Bakery's own tables, not Secrets/)
  }, 60_000)
})

describe('alpha kit test with uses', () => {
  it('seeds a used kit’s table, made from the kit beside it, and a connector’s', async () => {
    const used = join(home, 'kits', 'orchard')
    mkdirSync(used, { recursive: true })
    writeFileSync(
      join(used, 'module.yaml'),
      'name: Orchard\nversion: 0.2.0\napi: 1\ntables:\n  - name: Trees\n    fields:\n      - { name: Name, kind: text }\n      - { name: Planted, kind: date }\n',
    )
    const dir = join(home, 'kits', 'bakery')
    cpSync(KIT, dir, { recursive: true })
    rmSync(join(dir, 'tests'), { recursive: true })
    mkdirSync(join(dir, 'tests'))
    writeFileSync(
      join(dir, 'module.yaml'),
      readFileSync(join(dir, 'module.yaml'), 'utf8').replace(
        'api: 1\n',
        'api: 1\nuses:\n  - { kit: Orchard, min: 0.1.0, tables: [Trees] }\n  - { connector: gmail, tables: [Mail] }\n',
      ),
    )
    writeFileSync(
      join(dir, 'skills', 'seen.js'),
      "export default async (alpha) => { const t = await alpha.rows.list('Trees'); const m = await alpha.rows.list('Mail'); const r = await alpha.connectors.read('gmail', 'read', { message: m[0].values['Message ID'] }); return { words: [t[0].values.Name, t[0].values.Planted, m[0].values.Subject, r.text].join(' ') } }",
    )
    writeFileSync(
      join(dir, 'tests', 'seen.yaml'),
      "script: skills/seen.js\nrows:\n  Trees: [{ Name: Oak, Planted: '2020-04-01' }]\n  Mail: [{ Message ID: m1, Subject: Flour }]\ntools:\n  - { call: gmail.read, input: { message: m1 }, answer: { text: in stock } }\nexpect:\n  words: 'Oak 2020-04-01 Flour in stock$'\n",
    )
    expect(await kitTest(dir)).toEqual({ passed: ['seen'], failed: [] })
  }, 90_000)
})
