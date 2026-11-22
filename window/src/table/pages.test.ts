import { describe, expect, it } from 'vitest'
import { pageNumbers } from './FootBar.tsx'

describe('page numbers', () => {
  it('shows the first, the last and the ones beside this one, a gap for the rest', () => {
    expect(pageNumbers(0, 21)).toEqual([0, 1, 2, null, 20])
    expect(pageNumbers(8, 21)).toEqual([0, null, 7, 8, 9, null, 20])
    expect(pageNumbers(20, 21)).toEqual([0, null, 18, 19, 20])
    expect(pageNumbers(2, 21)).toEqual([0, 1, 2, 3, null, 20])
    expect(pageNumbers(0, 1)).toEqual([0])
    expect(pageNumbers(1, 3)).toEqual([0, 1, 2])
  })
})
