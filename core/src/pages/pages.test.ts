// Pages: listed from a module's folder, framed under Alpha's policy before any of the page's own
// words, answered read-only from the module's own tables, and printed by the core.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { Module, Table } from '../world/shape/index.ts'
import { World } from '../world/world.ts'
import { pageAnswer, pageDocument, pagesOf, printPage } from './pages.ts'

const BROWSERS = join(import.meta.dirname, '..', '..', '..', '.data', 'browsers')
const alpha = { actor: { kind: 'alpha' as const } }
const assumed = { kind: 'assumed' as const, basis: 'a test' }

let home: string
let world: World
let m: Module
let deals: Table

const FUNNEL = `<!doctype html><html><head><title>Funnel</title><meta name="alpha-front" content="yes"></head>
<body><script>
alpha.page(async () => {
  const deals = await alpha.rows('Deals')
  const moves = await alpha.history('Deals', 'Stage')
  const month = alpha.input('Month', { options: ['October', 'September'] })
  return [
    { heading: 'Funnel for ' + month },
    { stats: [{ label: 'Deals', value: deals.length }, { label: 'Stage moves', value: moves.reduce((n, r) => n + r.changes.length, 0) }] },
  ]
})
</script></body></html>`

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), 'alpha-pages-'))
  return World.open(join(home, 'tenants', 't_test')).then((w) => {
    world = w
    m = world.shape.makeModule('Listings', alpha)
    deals = world.shape.makeTable(
      m.id,
      'Deals',
      [
        { name: 'Name', kind: 'text' },
        { name: 'Stage', kind: 'choice', choices: ['New', 'CIM reviewed'] },
      ],
      alpha,
    )
    const [id] = world.records.add(
      deals.id,
      [{ values: { Name: 'Harbor CPA', Stage: 'New' }, provenance: assumed }],
      alpha,
    )
    world.records.change(
      deals.id,
      [{ id: id as string, values: { Stage: 'CIM reviewed' }, provenance: assumed }],
      alpha,
    )
    mkdirSync(join(m.dir, 'pages'), { recursive: true })
    writeFileSync(join(m.dir, 'pages', 'funnel.html'), FUNNEL)
    writeFileSync(join(m.dir, 'pages', 'about.html'), '<title>About</title><p>Notes</p>')
  })
})

afterEach(() => {
  world.close()
  rmSync(home, { recursive: true, force: true })
})

describe('pages', () => {
  it('lists a module’s pages by their titles, the front page first', () => {
    expect(pagesOf(m)).toEqual([
      { name: 'funnel', title: 'Funnel', front: true },
      { name: 'about', title: 'About', front: false },
    ])
  })

  it('frames a page under a policy that lets nothing out, before any of its own words', () => {
    const doc = pageDocument(m, 'funnel')
    const policy = doc.indexOf('Content-Security-Policy')
    expect(policy).toBeGreaterThan(0)
    expect(doc).toContain("default-src 'none'")
    expect(policy).toBeLessThan(doc.indexOf('alpha.page('))
    expect(doc.match(/<head>/g)).toHaveLength(1)
    expect(doc).toContain('window.alphaKit')
    expect(() => pageDocument(m, '../secret')).toThrow(/no page/)
  })

  it('answers with the module’s rows by field name and their history, and nothing else', () => {
    const rows = pageAnswer(world, m, 'rows', { table: 'deals' }) as {
      values: Record<string, unknown>
    }[]
    expect(rows[0]?.values).toMatchObject({ Name: 'Harbor CPA', Stage: 'CIM reviewed' })
    const moves = pageAnswer(world, m, 'history', { table: 'Deals', field: 'Stage' }) as {
      changes: { value: unknown }[]
    }[]
    expect(moves[0]?.changes.map((c) => c.value)).toEqual(['New', 'CIM reviewed'])
    expect(() => pageAnswer(world, m, 'rows', { table: 'People' })).toThrow(/no table/)
    expect(() => pageAnswer(world, m, 'change', { table: 'Deals' })).toThrow(/cannot ask/)
  })

  it('prints a page with its data to a PDF, and to a picture', async () => {
    const pdf = await printPage(world, m, 'funnel', {
      browsers: BROWSERS,
      inputs: { Month: 'September' },
      as: 'pdf',
    })
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-')
    expect(pdf.length).toBeGreaterThan(2000)
    const png = await printPage(world, m, 'funnel', { browsers: BROWSERS, as: 'png' })
    expect(png.subarray(1, 4).toString()).toBe('PNG')
  }, 120_000)
})
