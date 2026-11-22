import { describe, expect, it } from 'vitest'
import { forecast, stack } from './spend-words.ts'

describe('the month’s spend', () => {
  it('is forecast at the daily rate so far, only for the month it is', () => {
    expect(forecast(10, '2026-11', new Date(2026, 10, 10))).toBeCloseTo(30) // $1 a day, 30 days
    expect(forecast(10, '2026-10', new Date(2026, 10, 10))).toBeNull()
  })

  it('stacks every day of the month, the biggest keys first and the rest as Other', () => {
    const day = (d: string, split: Record<string, number>) => ({
      day: d,
      usd: 0,
      split: { day: {}, model: split, module: {}, agent: {}, schedule: {}, use: {}, person: {} },
    })
    const s = stack('2026-11', [day('2026-11-02', { a: 3, b: 2, c: 1 })], 'model', 2)
    expect(s.days).toHaveLength(30)
    expect(s.keys).toEqual(['a', 'b', 'Other'])
    expect(s.days[1]?.parts).toEqual([
      ['a', 3],
      ['b', 2],
      ['Other', 1],
    ])
    expect(s.days[0]?.parts.every(([, v]) => v === 0)).toBe(true)
  })
})
