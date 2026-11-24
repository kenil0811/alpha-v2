// Each one-question use runs on the model models.yaml names for it, one of the models listed; a
// pasted token is checked on the desk's own model.
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { config } from '../config.ts'
import { optionsOf } from './ask.ts'

let dir: string | null = null
afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true })
  dir = null
})

describe('the model an ask runs on', () => {
  it('is the one named for its use, from the models listed', () => {
    const m = config.models()
    for (const model of Object.values(m.asks)) expect(m.agents).toContain(model)
    const o = optionsOf(tmpdir(), {}, 'You judge.', {}, m.asks.judging)
    expect(o.model).toBe(m.asks.judging)
    expect(o.tools).toEqual([])
  })

  it('refuses a models.yaml naming a model for an ask that is not listed', () => {
    dir = mkdtempSync(join(tmpdir(), 'alpha-models-'))
    writeFileSync(
      join(dir, 'models.yaml'),
      'desk: a\nagents: [a]\nasks: {reading: a, judging: b, plugins: a}\n',
    )
    expect(() => config.models(dir as string)).toThrow(/under agents/)
  })
})
