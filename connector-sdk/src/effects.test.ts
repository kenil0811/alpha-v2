import { describe, expect, it } from 'vitest'
import { isEffect } from './effects.ts'

describe('effects', () => {
  it('knows the five effects and nothing else', () => {
    for (const e of ['read', 'write', 'remove', 'outward', 'sign_in'])
      expect(isEffect(e)).toBe(true)
    expect(isEffect('money')).toBe(false)
    expect(isEffect(undefined)).toBe(false)
  })
})
