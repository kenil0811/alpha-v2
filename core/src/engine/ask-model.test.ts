// Each one-question use runs on the model models.yaml names for it, one of the models listed.
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
    const o = optionsOf(tmpdir(), {}, 'You check.', {}, m.asks.checking)
    expect(o.model).toBe(m.asks.checking)
    expect(o.tools).toEqual([])
  })

  it('refuses a models.yaml naming a model for an ask that is not listed', () => {
    dir = mkdtempSync(join(tmpdir(), 'alpha-models-'))
    writeFileSync(
      join(dir, 'models.yaml'),
      'desk: a\nagents: [a]\nasks: {reading: a, judging: a, checking: b, plugins: a}\n',
    )
    expect(() => config.models(dir as string)).toThrow(/under agents/)
  })
})
