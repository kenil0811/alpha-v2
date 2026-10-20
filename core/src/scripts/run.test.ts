// Scripts in their sandbox: what they may do through `alpha`, and what they may not do at all.
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { runScript } from './run.ts'

let dir: string

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'alpha-script-'))
})
afterAll(() => rmSync(dir, { recursive: true, force: true }))

function script(name: string, body: string): string {
  const p = join(dir, name)
  writeFileSync(p, body)
  return p
}

describe('a script', () => {
  it('asks the core through alpha and gives back its answer', async () => {
    const calls: unknown[] = []
    const out = await runScript({
      script: script(
        'count.js',
        "export default async (alpha) => { const rows = await alpha.rows.list('Orders'); await alpha.log('counted'); console.log('to stderr'); return { orders: rows.length, input: alpha.input } }",
      ),
      moduleDir: dir,
      input: { day: 'Monday' },
      api: {
        'rows.list': async (p) => {
          calls.push(['rows.list', p])
          return [{ id: 'r1' }, { id: 'r2' }]
        },
        log: async (p) => {
          calls.push(['log', p])
          return null
        },
      },
    })
    expect(out.error).toBeNull()
    expect(out.result).toEqual({ orders: 2, input: { day: 'Monday' } })
    expect(calls).toEqual([
      ['rows.list', { table: 'Orders' }],
      ['log', { words: 'counted' }],
    ])
    expect(out.stderr).toContain('to stderr')
  }, 60_000)

  it('cannot reach the network, write outside its module, or read the person’s files', async () => {
    const out = await runScript({
      script: script(
        'escape.js',
        `import fs from 'node:fs'
        export default async () => {
          const tried = {}
          try { await fetch('https://example.com'); tried.net = 'reached' } catch { tried.net = 'blocked' }
          try { fs.writeFileSync(${JSON.stringify(join(homedir(), '.alpha-escape-test'))}, 'x'); tried.write = 'written' } catch { tried.write = 'blocked' }
          try { fs.readdirSync(${JSON.stringify(join(homedir(), 'Documents'))}); tried.read = 'read' } catch { tried.read = 'blocked' }
          try { fs.writeFileSync('inside.txt', 'x'); tried.inside = 'written' } catch { tried.inside = 'blocked' }
          return tried
        }`,
      ),
      moduleDir: dir,
      api: {},
    })
    expect(out.result).toEqual({
      net: 'blocked',
      write: 'blocked',
      read: 'blocked',
      inside: 'written',
    })
  }, 60_000)

  it('says when a call it makes is not there, and when it fails', async () => {
    const out = await runScript({
      script: script(
        'bad.js',
        "export default async (alpha) => { await alpha.browser.open('https://example.com') }",
      ),
      moduleDir: dir,
      api: {},
    })
    expect(out.error).toMatch(/alpha has no browser.open/)
  }, 60_000)
})
