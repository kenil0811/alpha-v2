// Journeys on Alpha's own loop (step 3, part 1, Kenil's yes 30 Oct): the person's API key from the
// secret store, never a file; a request that asks the API to cache what repeats; what a journey's
// world spent, by model and in dollars. A scripted store and world: never the real model.
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { MemorySecrets } from '@alpha/connector-sdk'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { requestOf } from '../engine/claudeapi.ts'
import { KEY_REF } from '../engine/route.ts'
import { priced } from '../world/spend.ts'
import { World } from '../world/world.ts'
import { ownLoop, spentIn } from './own.ts'

let home: string
let world: World
beforeEach(async () => {
  home = mkdtempSync(join(tmpdir(), 'alpha-own-'))
  world = await World.open(join(home, 'tenants', 't_test'))
})
afterEach(() => {
  world.close()
  rmSync(home, { recursive: true, force: true })
})

describe('a journey on the own loop', () => {
  it('runs on the key kept in Settings › Model, and runs nothing without one', async () => {
    const user = world.owner('Kenil')
    const none = new MemorySecrets()
    await expect(ownLoop(world, user, none)).rejects.toThrow(/No API key is kept/)
    const kept = new MemorySecrets()
    await kept.set(KEY_REF, 'sk-ant-api03-made-up-for-a-test-0000000000')
    const p = await ownLoop(world, user, kept)
    expect(p.route).toBe('key')
    expect(p.can.subagents).toBe(false)
  })

  it('asks the API to cache what repeats from one round to the next', () => {
    const r = requestOf({
      system: 'You are Alpha.',
      messages: [{ role: 'user', content: 'hello' }],
      tools: [],
      signal: new AbortController().signal,
      onText: () => {},
    })
    expect(r.cache_control).toEqual({ type: 'ephemeral' })
    expect(r.model).toBe('claude-opus-5-5')
  })

  it('says what its world spent, by model and in dollars', () => {
    expect(spentIn(world)).toEqual({ words: 'nothing yet', usd: 0 })
    world.spend.add({ kind: 'turn', turn: 't1' }, [
      priced('claude-opus-5-5', {
        input: 2000,
        output: 1000,
        cacheRead: 100_000,
        cacheWrite: 10_000,
      }),
    ])
    world.spend.add({ kind: 'ask' }, [
      priced('claude-haiku-5-5', { input: 1000, output: 100, cacheRead: 0, cacheWrite: 0 }),
    ])
    const s = spentIn(world)
    // 2000×4 + 1000×20 + 100000×0.2 + 10000×5 = 98,000 per million; Haiku 1000×0.1 + 100×0.5 = 150
    expect(s.usd).toBeCloseTo(0.09815, 5)
    expect(s.words).toBe(
      'claude-opus-5-5: in 112000 (cache read 100000), out 1000; claude-haiku-5-5: in 1000 (cache read 0), out 100; $0.10',
    )
  })
})
