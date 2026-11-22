// A page that belongs to a table's records names that table, and a kit's check refuses one that
// names a table its module does not have.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { checkKit } from '@alpha/kit-sdk'
import { afterEach, beforeEach, expect, it } from 'vitest'
import { PAGE } from '../engine/tools/common.ts'

let kit: string
beforeEach(() => {
  kit = mkdtempSync(join(tmpdir(), 'alpha-record-page-'))
  mkdirSync(join(kit, 'pages'))
  writeFileSync(
    join(kit, 'module.yaml'),
    `name: Book
version: 0.1.0
api: 3
business_case: { for: The owner, keeps: Deals, decides: Which to buy }
tables:
  - name: Deals
    fields:
      - { name: Name, kind: text }
`,
  )
})
afterEach(() => rmSync(kit, { recursive: true, force: true }))

const page = (name: string, table: string) =>
  writeFileSync(
    join(kit, 'pages', `${name}.html`),
    `<title>${name}</title><meta name="alpha-record" content="${table}"><script>alpha.page(async () => [])</script>`,
  )

it('lets a page belong to its own table’s records, and refuses one naming a table it lacks', () => {
  page('deal', 'deals')
  expect(checkKit(kit)).toEqual([])
  page('client', 'Clients')
  expect(checkKit(kit)).toEqual([
    'pages/client.html belongs to the records of Clients, which the kit has no table called.',
  ])
})

it('tells the model that draws a page how one belongs to a table’s records', () => {
  expect(PAGE).toMatch(/<meta name="alpha-record" content="<table>">/)
  expect(PAGE).toMatch(/alpha\.record/)
})
