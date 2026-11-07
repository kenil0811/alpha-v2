// What a journey's world spent, by model and in dollars. A scripted world: never the real model.
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { World } from '../world/world.ts'
import { spentIn } from './spent.ts'

let home: string
let world: World
beforeEach(async () => {
  home = mkdtempSync(join(tmpdir(), 'alpha-spent-'))
  world = await World.open(join(home, 'tenants', 't_test'))
})
afterEach(() => {
  world.close()
  rmSync(home, { recursive: true, force: true })
})

const used = (model: string, input: number, output: number, cacheRead: number, usd: number) => ({
  model,
  input,
  output,
  cacheRead,
  cacheWrite: 0,
  usd,
  how: 'reported' as const,
})

describe('a journey', () => {
  it('says what its world spent, by model and in dollars', () => {
    expect(spentIn(world)).toEqual({ words: 'nothing yet', usd: 0 })
    world.spend.add({ kind: 'turn', turn: 't1' }, [
      used('claude-opus-5-5', 2000, 1000, 100_000, 0.09),
    ])
    world.spend.add({ kind: 'ask' }, [used('claude-haiku-5-5', 1000, 100, 0, 0.01)])
    const s = spentIn(world)
    expect(s.usd).toBeCloseTo(0.1, 5)
    expect(s.words).toBe(
      'claude-opus-5-5: in 102000 (cache read 100000), out 1000; claude-haiku-5-5: in 1000 (cache read 0), out 100; $0.10',
    )
  })
})
