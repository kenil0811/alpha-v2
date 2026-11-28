// The offline runner over the test kit's own cases, and a case that fails for the right reason.
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { kitTest } from './kittest.ts'

const KIT = join(import.meta.dirname, 'test-kit')
let home: string
beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), 'alpha-kittest-'))
})
afterEach(() => rmSync(home, { recursive: true, force: true }))

describe('alpha kit test', () => {
  it('runs the kit’s cases against a fixture world and recorded pages, without the model', async () => {
    const report = await kitTest(KIT)
    expect(report).toEqual({ passed: ['count', 'read-again', 'read'], failed: [] })
  }, 90_000)

  it('says which run of a case fell short when a later one does', async () => {
    const dir = join(home, 'kit')
    cpSync(KIT, dir, { recursive: true })
    const page = (items: string) =>
      `  https://supplies.example/list: { url: https://supplies.example/list, pages: 1, items: [${items}] }\n`
    writeFileSync(
      join(dir, 'tests', 'read-again.yaml'),
      `script: scripts/read/run.js\npages:\n${page('{ _id: S1, name: Oat Mill }')}then:\n  - pages:\n    ${page('{ _id: S1, name: Oat Mill }')}    expect:\n      words: '1 new'\n`,
    )
    const report = await kitTest(dir, { only: 'read-again' })
    expect(report.passed).toEqual([])
    expect(report.failed[0]?.why).toMatch(/^Run 2: The run said .*0 new/)
  }, 90_000)

  it('fails a case whose rows do not land, saying what the table holds', async () => {
    const dir = join(home, 'kit')
    cpSync(KIT, dir, { recursive: true })
    writeFileSync(
      join(dir, 'tests', 'read.yaml'),
      'script: scripts/read/run.js\npages:\n  https://supplies.example/list: { url: https://supplies.example/list, pages: 1, items: [{ _id: S1, name: Oat Mill }] }\nexpect:\n  rows:\n    Suppliers:\n      - { Name: Sugar Co }\n',
    )
    const report = await kitTest(dir, { only: 'read' })
    expect(report.passed).toEqual([])
    expect(report.failed[0]?.why).toMatch(/No row in Suppliers has .*Sugar Co.*holds .*Oat Mill/)
  }, 90_000)

  // A made-up kit that reads the test kit's Suppliers into a table of its own, one row a supplier.
  const cafe = (cases: Record<string, string>): string => {
    cpSync(KIT, join(home, 'bakery'), { recursive: true })
    const dir = join(home, 'cafe')
    mkdirSync(join(dir, 'scripts', 'copy'), { recursive: true })
    mkdirSync(join(dir, 'tests'), { recursive: true })
    writeFileSync(
      join(dir, 'module.yaml'),
      'name: Cafe\nversion: 0.1.0\napi: 3\nuses:\n  - { kit: Bakery, tables: [Suppliers] }\ntables:\n  - name: Menu\n    fields:\n      - { name: Name, kind: text }\n      - { name: Email, kind: email }\n',
    )
    writeFileSync(
      join(dir, 'scripts', 'copy', 'run.js'),
      "export default async (alpha) => {\n  const all = await alpha.rows.list('Suppliers')\n  const landed = await alpha.rows.land('Menu', all.map((s) => ({ key: s.id, values: s.values })))\n  return { words: `${landed.added} added, ${landed.changed} changed` }\n}\n",
    )
    for (const [name, text] of Object.entries(cases))
      writeFileSync(join(dir, 'tests', `${name}.yaml`), text)
    return dir
  }

  it('tests a kit with the kits it uses, from the folders beside it, and seeds their tables', async () => {
    const dir = cafe({
      copy: 'script: scripts/copy/run.js\nrows:\n  Suppliers:\n    - { Name: Oat Mill }\nexpect:\n  words: 3 added\n  rows:\n    Menu:\n      - { Name: Oat Mill }\n',
    })
    expect(await kitTest(dir)).toEqual({ passed: ['copy'], failed: [] })
  }, 90_000)

  it('does what the person did between two runs: a value typed over a row, a row removed', async () => {
    const dir = cafe({
      // a name typed on the kit's own row stays when its source's changes; a removed row stays removed
      typed: [
        'script: scripts/copy/run.js',
        'rows:',
        '  Suppliers:',
        '    - { Name: Oat Mill, Email: oats@example.com }',
        '    - { Name: Rye Mill }',
        // the Bakery's setup holds two suppliers of its own
        'expect: { words: 4 added }',
        'then:',
        '  - change:',
        '      Menu: [{ row: { Name: Oat Mill }, set: { Name: Oats } }]',
        '      Suppliers: [{ row: { Name: Oat Mill }, set: { Email: mill@example.com } }]',
        '    remove:',
        '      Menu: [{ Name: Rye Mill }]',
        '    expect:',
        "      words: '0 added'",
        '      rows:',
        '        Menu: [{ Name: Oats, Email: mill@example.com }]',
        // a removed row stays removed: the run brings no Rye Mill back
        "      result: { words: '0 added, 1 changed' }",
        '',
      ].join('\n'),
      missing:
        'script: scripts/copy/run.js\nthen:\n  - change:\n      Menu: [{ row: { Name: Nobody }, set: { Name: Somebody } }]\n',
    })
    const report = await kitTest(dir)
    expect(report.passed).toEqual(['typed'])
    expect(report.failed[0]?.why).toMatch(/^Run 2: No row in Menu has .*Nobody.* to change/)
  }, 90_000)

  // A made-up kit reading a client's books through a connector it names: its connections, and a
  // report through each, landed in its own table.
  const books = (uses: string, cases: Record<string, string>): string => {
    const dir = join(home, 'books')
    mkdirSync(join(dir, 'scripts', 'read'), { recursive: true })
    mkdirSync(join(dir, 'tests'), { recursive: true })
    writeFileSync(
      join(dir, 'module.yaml'),
      `name: Books\nversion: 0.1.0\napi: 3\n${uses}tables:\n  - name: Months\n    fields:\n      - { name: Client, kind: text }\n      - { name: Income, kind: number }\n`,
    )
    writeFileSync(
      join(dir, 'scripts', 'read', 'run.js'),
      "export default async (alpha) => {\n  const items = []\n  for (const k of await alpha.connections.list('ledger')) {\n    const r = await alpha.connections.read(k.id, 'report', { name: 'ProfitAndLoss' })\n    items.push({ key: k.account, values: { Client: k.account, Income: r.income } })\n  }\n  const landed = await alpha.rows.land('Months', items)\n  return { words: `${landed.added} added` }\n}\n",
    )
    for (const [name, text] of Object.entries(cases))
      writeFileSync(join(dir, 'tests', `${name}.yaml`), text)
    return dir
  }
  const harbor = [
    'connections:',
    '  - connector: ledger',
    '    account: Harbor CPA',
    '    reads:',
    '      - { read: report, input: { name: ProfitAndLoss }, answer: { income: 2050 } }',
  ].join('\n')

  it('reads through the connections of a connector the kit names, on recorded answers', async () => {
    const dir = books('uses:\n  - { connector: ledger }\n', {
      read: `script: scripts/read/run.js\n${harbor}\nexpect:\n  words: 1 added\n  rows:\n    Months:\n      - { Client: Harbor CPA, Income: 2050 }\nthen:\n  - reads:\n      Harbor CPA:\n        - { read: report, answer: { income: 2100 } }\n    expect:\n      rows:\n        Months:\n          - { Client: Harbor CPA, Income: 2100 }\n`,
    })
    expect(await kitTest(dir)).toEqual({ passed: ['read'], failed: [] })
  }, 90_000)

  it('refuses a read through a connector the kit does not name', async () => {
    const dir = books('', { read: `script: scripts/read/run.js\n${harbor}\n` })
    const report = await kitTest(dir)
    expect(report.failed[0]?.why).toMatch(/may not read through ledger: its kit does not name it/)
  }, 90_000)
})
