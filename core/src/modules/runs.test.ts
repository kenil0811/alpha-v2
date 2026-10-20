// Runs of a made-up kit's agents, with a stand-in for the browser engine: never a real site.
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { BrowserEngine } from '@alpha/connector-sdk'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { World } from '../world/world.ts'
import { agents, setAgentState, syncAgents } from './agents.ts'
import { install } from './kits.ts'
import { AgentRunner } from './runs.ts'

let home: string
let world: World
const ctx = { actor: { kind: 'person' as const, id: 'u_1' }, user: 'u_1' }
const opened: string[] = []
const engine = {
  open: async () => ({}),
  extract: async (url: string) => {
    opened.push(url)
    return {
      url,
      pages: 1,
      items: [
        { _id: 'S1', name: 'Oat Mill', _url: `${url}/S1` },
        { _id: 'S2', name: 'Sugar Co', _url: `${url}/S2` },
      ],
    }
  },
} as unknown as BrowserEngine

beforeEach(async () => {
  home = mkdtempSync(join(tmpdir(), 'alpha-runs-'))
  world = await World.open(join(home, 'tenants', 't_test'))
  opened.length = 0
})

afterEach(() => {
  world.close()
  rmSync(home, { recursive: true, force: true })
})

describe('a run', () => {
  it('runs an agent’s script in its sandbox and reports its outcome', async () => {
    const m = await install(world, join(import.meta.dirname, 'test-kit'), ctx)
    const runner = new AgentRunner(world, () => engine)
    const [counter] = agents(world, m.id)
    const out = await runner.runAgent(counter as never)
    expect(out.state).toBe('ok')
    expect(out.result).toEqual({ orders: 0 })
    expect(runner.runs().map((r) => [r.state, r.words])).toEqual([['ok', 'Counter finished.']])
    expect(world.lines({ kinds: ['run_started', 'run_ended'] }).map((l) => l.words)).toEqual([
      'Counter started.',
      'Counter finished.',
    ])
  }, 60_000)

  it('reads only sites on its module’s list; a new one waits on the person’s yes, then stays allowed', async () => {
    const m = await install(world, join(import.meta.dirname, 'test-kit'), ctx)
    const runner = new AgentRunner(world, () => engine, { owner: 'u_1' })
    const first = await runner.runScript(
      m,
      'skills/read/run.js',
      { url: 'https://supplies.example/list' },
      'Reader',
      null,
    )
    expect(first.state).toBe('failed')
    expect(first.words).toMatch(/supplies.example is not on Bakery's list/)
    expect(opened).toEqual([])
    const [card] = world.cards.waiting()
    expect(card?.words).toBe('Let Bakery read supplies.example?')
    world.cards.answer(card?.id as string, 'Yes', { kind: 'person', id: 'u_1' })
    const second = await runner.runScript(
      m,
      'skills/read/run.js',
      { url: 'https://supplies.example/list' },
      'Reader',
      null,
    )
    expect(second.words).toBe('Reader: 2 seen, 2 new')
    expect(readFileSync(join(m.dir, 'module.yaml'), 'utf8')).toContain('supplies.example')
    const rows = world.records.list(world.shape.table('Suppliers')?.id as string)
    const oat = rows.find((r) => r.values.name === 'Oat Mill')
    expect(oat?.provenance.name?.source).toMatchObject({
      connector: 'agent:Reader',
      item: 'S1',
      url: 'https://supplies.example/list/S1',
    })
    const third = await runner.runScript(
      m,
      'skills/read/run.js',
      { url: 'https://supplies.example/list' },
      'Reader',
      null,
    )
    expect(third.words).toBe('Reader: 2 seen, 0 new')
    // what the reader told the person reaches their stream, once
    expect(world.lines({ user: 'u_1', kinds: ['told'] }).map((l) => l.words)).toEqual([
      'Reader: 2 new suppliers.',
    ])
  }, 60_000)
})

describe('a site that wants a sign-in', () => {
  it('fails the run and puts a Sign in card in front of the person, once per agent', async () => {
    const m = await install(world, join(import.meta.dirname, 'test-kit'), ctx)
    const wants = {
      open: async () => ({}),
      extract: async () => {
        throw Object.assign(
          new Error('example.com wants you to sign in before it shows this page.'),
          {
            kind: 'sign_in',
          },
        )
      },
    } as unknown as BrowserEngine
    const owner = world.owner('Kenil')
    const agent = agents(world, m.id)[0]?.id as string
    const runner = new AgentRunner(world, () => wants, { owner: owner.id })
    for (let i = 0; i < 2; i++) {
      const out = await runner.runScript(
        m,
        'skills/read/run.js',
        { url: 'https://example.com/members' },
        'Reader',
        agent,
      )
      expect(out.state).toBe('failed')
    }
    const cards = world.cards.waiting(owner.id)
    expect(cards.map((c) => [c.gate, c.words, c.options])).toEqual([
      ['sign_in', 'example.com wants you to sign in', ['Sign in', 'Not now']],
    ])
    expect(cards[0]?.call).toEqual({
      tool: 'site_sign_in',
      input: { host: 'example.com', url: 'https://example.com/members', agent },
    })
  })
})

describe('a script’s rows', () => {
  it('reads rows with their values by field name, and lands a url only as a web link', async () => {
    const m = await install(world, join(import.meta.dirname, 'test-kit'), ctx)
    const runner = new AgentRunner(world, () => engine)
    writeFileSync(
      join(m.dir, 'skills/names.js'),
      "export default async (alpha) => (await alpha.rows.list('Suppliers')).map((r) => [r.key, r.values.Name])",
    )
    const names = await runner.runScript(m, 'skills/names.js', {}, 'Names', null)
    expect(names.result).toEqual([
      ['setup:mill', 'Mill & Co'],
      ['setup:dairy', 'Dairy Farm'],
    ])
    writeFileSync(
      join(m.dir, 'skills/fake.js'),
      "export default async (alpha) => alpha.rows.land('Suppliers', [{ key: 'x', values: { Name: 'X' }, url: 'alpha://Suppliers/x' }])",
    )
    const fake = await runner.runScript(m, 'skills/fake.js', {}, 'Fake', null)
    expect(fake.words).toMatch(/alpha:\/\/Suppliers\/x is not one/)
  }, 60_000)
})

describe('a script’s figures', () => {
  it('never write over a value the person said', async () => {
    const m = await install(world, join(import.meta.dirname, 'test-kit'), ctx)
    const runner = new AgentRunner(world, () => engine)
    const suppliers = world.shape.table('Suppliers')?.id as string
    const mill = world.records.list(suppliers)[0]?.id as string
    world.records.change(
      suppliers,
      [
        {
          id: mill,
          values: { Email: 'me@mill.example' },
          provenance: { kind: 'stated', source: { message: 1 } },
        },
      ],
      ctx,
    )
    writeFileSync(
      join(m.dir, 'skills/figure.js'),
      `export default async (alpha) => { const [r] = await alpha.rows.list('Suppliers'); await alpha.rows.compute('Suppliers', r.id, { Email: 'computed@mill.example', Name: 'Mill (computed)' }, { Email: 'x', Name: 'y' }) }`,
    )
    await runner.runScript(m, 'skills/figure.js', {}, 'Figure', null)
    const after = world.records.list(suppliers)[0]
    expect([after?.values.name, after?.values.email]).toEqual([
      'Mill (computed)',
      'me@mill.example',
    ])
    // what the script works out is kept beside the person's own, for Reset
    expect(after?.provenance.email?.beside).toMatchObject({
      value: 'computed@mill.example',
      formula: 'x',
    })
  }, 60_000)

  it('read a filed document’s cells, and land values that cite their cell', async () => {
    const m = await install(world, join(import.meta.dirname, 'test-kit'), ctx)
    const runner = new AgentRunner(world, () => engine)
    const { file } = world.files.take(new TextEncoder().encode('b'), 'prices.xlsx', 'x', ctx)
    world.files.addDocument(
      file.hash,
      'prices.xlsx',
      'sheet',
      [
        { position: { sheet: 'Sheet1', cell: 'A2', row: 2 }, words: 'Rye Mill' },
        { position: { sheet: 'Sheet1', cell: 'B2', row: 2 }, words: '1,250.50' },
      ],
      ctx,
    )
    writeFileSync(
      join(m.dir, 'skills/prices.js'),
      `export default async (alpha) => {
        const [doc] = await alpha.documents.list()
        const cells = await alpha.documents.read(doc.file)
        const name = cells.find((c) => c.cell === 'A2')
        await alpha.rows.land('Suppliers', [{ key: 'rye', values: { Name: name.words }, places: { Name: { file: doc.file, sheet: name.sheet, cell: name.cell } } }])
        return cells.map((c) => c.cell + '=' + c.words)
      }`,
    )
    const out = await runner.runScript(m, 'skills/prices.js', {}, 'Prices', null)
    expect(out.result).toEqual(['A2=Rye Mill', 'B2=1,250.50'])
    const rye = world.records
      .list(world.shape.table('Suppliers')?.id as string)
      .find((r) => r.values.name === 'Rye Mill')
    expect(rye?.provenance.name?.source).toMatchObject({
      file: file.hash,
      sheet: 'Sheet1',
      cell: 'A2',
    })
  }, 60_000)
})

describe('triggers', () => {
  it('run an agent on a change in any of its tables, handing its script its input', async () => {
    const m = await install(world, join(import.meta.dirname, 'test-kit'), ctx)
    const runner = new AgentRunner(world, () => engine)
    writeFileSync(join(m.dir, 'skills/echo.js'), 'export default async (alpha) => alpha.input')
    writeFileSync(
      join(m.dir, 'agents/watcher.md'),
      '---\nname: Watcher\ntrigger: { changes: [Orders, Suppliers] }\nruns: { script: skills/echo.js, input: { say: hi } }\n---\nWatches.\n',
    )
    syncAgents(world, m, 'on')
    await runner.runDue() // the kit's own rows count as a change, once
    expect(runner.runs().map((r) => r.words)).toEqual(['Watcher finished.'])
    await runner.runDue()
    expect(runner.runs()).toHaveLength(1)
    world.records.land(
      world.shape.table('Orders')?.id as string,
      [{ key: 'o1', values: { Item: 'Flour', Quantity: 3 } }],
      { connector: 'test' },
      ctx,
    )
    await runner.runDue()
    const out = runner.runs()
    expect(out).toHaveLength(2)
    const data = world.db.prepare('SELECT data FROM runs WHERE id = ?').get(out[0]?.id ?? '') as {
      data: string
    }
    expect(data.data).toContain('"say":"hi"')
  }, 60_000)

  it('run an agent when a document is filed', async () => {
    const m = await install(world, join(import.meta.dirname, 'test-kit'), ctx)
    const runner = new AgentRunner(world, () => engine)
    writeFileSync(join(m.dir, 'skills/echo.js'), 'export default async () => null')
    writeFileSync(
      join(m.dir, 'agents/filer.md'),
      '---\nname: Filer\ntrigger: { filed: true }\nruns: { script: skills/echo.js }\n---\nReads what is filed.\n',
    )
    syncAgents(world, m, 'on')
    await runner.runDue()
    expect(runner.runs()).toHaveLength(0)
    const { file } = world.files.take(new TextEncoder().encode('a'), 'june.xlsx', 'x', ctx)
    world.files.addDocument(
      file.hash,
      'june.xlsx',
      'sheet',
      [{ position: { cell: 'A1' }, words: 'x' }],
      ctx,
    )
    await runner.runDue()
    expect(runner.runs().map((r) => r.words)).toEqual(['Filer finished.'])
  }, 60_000)

  it('run an agent that is on when its time comes, and never one that is paused', async () => {
    const m = await install(world, join(import.meta.dirname, 'test-kit'), ctx)
    const runner = new AgentRunner(world, () => engine)
    const at8 = new Date()
    at8.setHours(8, 0, 0, 0)
    await runner.runDue(at8.getTime())
    expect(runner.runs()).toHaveLength(0)
    const [counter] = agents(world, m.id)
    setAgentState(world, counter?.id as string, 'on', 'u_1')
    await runner.runDue(at8.getTime())
    expect(runner.runs()).toHaveLength(1)
    await runner.runDue(at8.getTime() + 60_000)
    expect(runner.runs()).toHaveLength(1)
  }, 60_000)
})

describe('an agent woken by a filing', () => {
  it('is handed the documents filed or put on a row, with their rows, and can place one', async () => {
    const kit = join(home, 'filing-kit')
    mkdirSync(join(kit, 'agents'), { recursive: true })
    mkdirSync(join(kit, 'skills', 'file'), { recursive: true })
    writeFileSync(
      join(kit, 'module.yaml'),
      'name: Desk\nversion: 0.1.0\ntables:\n  - name: Jobs\n    documents: [Brief, Invoice]\n    fields:\n      - { name: Name, kind: text }\n',
    )
    writeFileSync(
      join(kit, 'agents', 'filer.md'),
      '---\nname: Filer\ntrigger: { filed: true }\nruns: { script: skills/file/run.js }\ntouches: [Jobs]\n---\nFiles briefs.\n',
    )
    writeFileSync(
      join(kit, 'skills', 'file', 'run.js'),
      `export default async function (alpha) {
  const filed = alpha.input.filed ?? []
  const [job] = await alpha.rows.list('Jobs')
  for (const f of filed) if (!f.rows.length) await alpha.documents.place(f.file, 'Jobs', job.id, 'Brief')
  return { filed: filed.map((f) => [f.name, f.rows.map((r) => r.kind)]), listed: (await alpha.documents.list()).map((d) => d.rows.length) }
}
`,
    )
    const m = await install(world, kit, ctx)
    const [filer] = agents(world, m.id)
    setAgentState(world, filer?.id as string, 'on', 'u_1')
    const jobs = world.shape.table('Jobs')?.id as string
    world.records.add(
      jobs,
      [{ values: { Name: 'Shop fit' }, provenance: { kind: 'assumed', basis: 'a test' } }],
      {
        ...ctx,
        said: null,
      },
    )
    const runner = new AgentRunner(world, () => engine)
    await runner.runDue()
    const bytes = new TextEncoder().encode('name,size\nshelf,2\n')
    const { file } = world.files.take(bytes, 'brief.csv', 'text/csv', ctx)
    world.files.addDocument(
      file.hash,
      'brief.csv',
      'sheet',
      [{ position: { sheet: 'S', cell: 'A1' }, words: 'name' }],
      ctx,
    )
    await runner.runDue()
    const [last] = runner.runs()
    const result = JSON.parse(
      String(
        (
          world.db.prepare('SELECT data FROM runs WHERE id = ?').get(last?.id as string) as {
            data: string
          }
        ).data,
      ),
    ).result
    expect(result).toEqual({ filed: [['brief.csv', []]], listed: [1] })
    expect(world.rowsOfFile(file.hash).map((r) => r.kind)).toEqual(['Brief'])
    // its own placing does not wake it again
    await runner.runDue()
    expect(runner.runs()).toHaveLength(1)
  }, 60_000)
})
