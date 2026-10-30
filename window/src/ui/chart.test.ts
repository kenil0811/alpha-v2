import { describe, expect, it } from 'vitest'
import { ticksOf } from './chart.tsx'

describe('ticksOf', () => {
  it('steps round from below the least to above the most', () => {
    expect(ticksOf(0, 4)).toEqual([0, 1, 2, 3, 4])
    expect(ticksOf(104, 147)).toEqual([100, 120, 140, 160])
    expect(ticksOf(0, 7300)).toEqual([0, 2000, 4000, 6000, 8000])
  })
})
