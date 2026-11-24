// Where Alpha's words send a person must be a place in the window. Intelligence went into Settings,
// and on 24 Nov Settings' parts took their names: Models (was LLM), Rules (Permissions and How to
// work), Members (People), Logs (Activity), Automations (Schedules), Backup and restore (Data);
// agents and modules left Settings. Nothing Alpha says, to the model or to people, sends anyone to
// a part by an old name.
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = join(import.meta.dirname, '..', '..')
const WHERE = [
  'core/src',
  'core/kits',
  'core/config',
  'core/agents',
  'connectors',
  'connectors-extra',
  'connector-sdk/src',
  'kit-sdk/src',
  'plugins',
  'plugin-sdk/src',
]
const TEXT = /\.(ts|tsx|yaml|yml|md|json|txt)$/
const OLD =
  /Intelligence ›|Settings › (?:LLM|Model\b|Permissions|People|Data\b|Activity|Schedules|How to work|Agents|Modules)/

function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name)
    if (e.isDirectory()) return e.name === 'node_modules' || e.name === 'dist' ? [] : files(p)
    return TEXT.test(e.name) && !e.name.endsWith('.test.ts') ? [p] : []
  })
}

describe('where Alpha sends people', () => {
  it('never to a part of Settings by an old name, nor to Intelligence', () => {
    const found = WHERE.flatMap((d) => files(join(ROOT, d))).flatMap((f) =>
      readFileSync(f, 'utf8')
        .split('\n')
        .flatMap((line, i) => (OLD.test(line) ? [`${relative(ROOT, f)}:${i + 1}`] : [])),
    )
    expect(found).toEqual([])
  })
})
