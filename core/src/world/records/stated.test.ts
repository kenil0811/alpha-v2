// What counts as in the person's words (rules D5; Kenil's calls, 5 Nov).
import { describe, expect, it } from 'vitest'
import { dateIn, numbersIn } from './stated.ts'

describe('a stated value in the person’s words', () => {
  it('finds numbers as written, scaled ones both ways', () => {
    expect(numbersIn('Order 40 bags')).toContain(40)
    expect(numbersIn('about 1,200 a month')).toContain(1200)
    expect(numbersIn('asking 12.5k')).toEqual(expect.arrayContaining([12.5, 12500]))
    expect(numbersIn('revenue of 1.2 million')).toContain(1_200_000)
    expect(numbersIn('$3.4M SDE')).toContain(3_400_000)
    expect(numbersIn('log two eggs')).toContain(2)
    expect(numbersIn('a dozen rolls')).toContain(12)
    expect(numbersIn('nothing here')).toEqual([])
  })

  it('finds a date as written, or as a day word on the day it was written', () => {
    const on = '2026-11-05' // a Thursday
    expect(dateIn('due 2026-11-20', '2026-11-20', on)).toBe(true)
    expect(dateIn('due 20 Nov', '2026-11-20', on)).toBe(true)
    expect(dateIn('by November 20th', '2026-11-20', on)).toBe(true)
    expect(dateIn('remind me tomorrow', '2026-11-06', on)).toBe(true)
    expect(dateIn('remind me tomorrow', '2026-11-07', on)).toBe(false)
    expect(dateIn('call him on Monday', '2026-11-09', on)).toBe(true)
    expect(dateIn('call him on Monday', '2026-11-10', on)).toBe(false)
    expect(dateIn('sometime next week', '2026-11-11', on)).toBe(true)
    expect(dateIn('order sugar', '2026-11-20', on)).toBe(false)
  })
})
