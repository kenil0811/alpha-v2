// The offline runner over the test kit's own cases, and a case that fails for the right reason.
import { cpSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
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
    expect(report).toEqual({ passed: ['count', 'read'], failed: [] })
  }, 90_000)

  it('fails a case whose rows do not land, saying what the table holds', async () => {
    const dir = join(home, 'kit')
    cpSync(KIT, dir, { recursive: true })
    writeFileSync(
      join(dir, 'tests', 'read.yaml'),
      'script: skills/read/run.js\npages:\n  https://supplies.example/list: { url: https://supplies.example/list, pages: 1, items: [{ _id: S1, name: Oat Mill }] }\nexpect:\n  rows:\n    Suppliers:\n      - { Name: Sugar Co }\n',
    )
    const report = await kitTest(dir, { only: 'read' })
    expect(report.passed).toEqual([])
    expect(report.failed[0]?.why).toMatch(/No row in Suppliers has .*Sugar Co.*holds .*Oat Mill/)
  }, 90_000)
})
