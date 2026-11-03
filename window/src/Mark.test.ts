import { describe, expect, it } from 'vitest'
import { boxAt } from './Mark.tsx'

describe('the comment box stays inside the window', () => {
  it('goes under what was marked', () =>
    expect(boxAt({ top: 100, bottom: 120 }, 800)).toEqual({ top: 128 }))
  it('else over it', () => expect(boxAt({ top: 600, bottom: 700 }, 800)).toEqual({ bottom: 208 }))
  it('else inside its top', () => expect(boxAt({ top: 20, bottom: 790 }, 800)).toEqual({ top: 28 }))
})
