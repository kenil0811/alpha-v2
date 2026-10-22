// The kit API is one schema (kit-sdk): the host object, the guide and the reference come from
// it, and the core implements exactly its calls.
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { BrowserEngine } from '@alpha/connector-sdk'
import { AgentFront, CALL_NAMES, guide, Manifest, reference, shape } from '@alpha/kit-sdk'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { z } from 'zod'
import { World } from '../world/world.ts'
import { install } from './kits.ts'
import { AgentRunner } from './runs.ts'

let home: string
let world: World
const ctx = { actor: { kind: 'person' as const, id: 'u_1' }, user: 'u_1' }
const engine = {} as unknown as BrowserEngine

beforeEach(async () => {
  home = mkdtempSync(join(tmpdir(), 'alpha-api-'))
  world = await World.open(join(home, 'tenants', 't_test'))
})
afterEach(() => {
  world.close()
  rmSync(home, { recursive: true, force: true })
})

describe('the kit API', () => {
  it('is implemented by the core exactly: every call in the schema, and no other', async () => {
    const m = await install(world, join(import.meta.dirname, 'test-kit'), ctx)
    const runner = new AgentRunner(world, () => engine)
    const api = (
      runner as unknown as {
        api: (m: unknown, label: string, run: string, who: unknown, agent: null) => object
      }
    ).api(m, 'Test', 'run_1', { user: null, turn: null }, null)
    expect(Object.keys(api).sort()).toEqual([...CALL_NAMES].sort())
    expect(shape().map((c) => c.name)).toEqual(CALL_NAMES)
  })

  it('keeps the reference page and the guide generated from the same schema', () => {
    const page = readFileSync(
      join(import.meta.dirname, '..', '..', '..', 'docs', 'kit-api.md'),
      'utf8',
    )
    expect(page).toBe(reference())
    for (const name of CALL_NAMES) expect(guide()).toContain(`alpha.${name}(`)
    const docs = join(import.meta.dirname, '..', '..', '..', 'docs', 'kit-schemas')
    expect(JSON.parse(readFileSync(join(docs, 'module.yaml.json'), 'utf8'))).toEqual(
      z.toJSONSchema(Manifest, { io: 'input' }),
    )
    expect(JSON.parse(readFileSync(join(docs, 'agent.json'), 'utf8'))).toEqual(
      z.toJSONSchema(AgentFront, { io: 'input' }),
    )
  })

  it('refuses a call whose input is not as the schema says, in plain words', async () => {
    const m = await install(world, join(import.meta.dirname, 'test-kit'), ctx)
    writeFileSync(
      join(m.dir, 'skills', 'wrong.js'),
      'export default async (alpha) => { try { await alpha.rows.list() } catch (e) { return { words: e.message } } }',
    )
    const runner = new AgentRunner(world, () => engine, { owner: 'u_1' })
    const run = await runner.runScript(m, 'skills/wrong.js', {}, 'Wrong', null)
    expect(run.state).toBe('ok')
    expect((run.result as { words: string }).words).toMatch(/alpha\.rows\.list was given table:/)
  }, 60_000)
})
