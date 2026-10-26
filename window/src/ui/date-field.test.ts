import { describe, expect, it } from 'vitest'
import { dayLabel, parseDay } from './date-field.tsx'

// Monday 26 October 2026
const today = new Date(2026, 9, 26, 10)

describe('parseDay', () => {
  it('reads the ways a person types a day', () => {
    expect(parseDay('', today)).toBe('')
    expect(parseDay('Today', today)).toBe('2026-10-26')
    expect(parseDay('tomorrow', today)).toBe('2026-10-27')
    expect(parseDay('fri', today)).toBe('2026-10-30')
    expect(parseDay('monday', today)).toBe('2026-11-02')
    expect(parseDay('25 Oct', today)).toBe('2026-10-25')
    expect(parseDay('Oct 25, 2027', today)).toBe('2027-10-25')
    expect(parseDay('3rd December', today)).toBe('2026-12-03')
    expect(parseDay('25/10', today)).toBe('2026-10-25')
    expect(parseDay('1/2/27', today)).toBe('2027-02-01')
    expect(parseDay('2026-10-25', today)).toBe('2026-10-25')
  })
  it('refuses what is not a day', () => {
    expect(parseDay('31 Feb', today)).toBeNull()
    expect(parseDay('soon', today)).toBeNull()
    expect(parseDay('13/13', today)).toBeNull()
    expect(parseDay('25 Foo', today)).toBeNull()
  })
})

it('says a day as "25 Oct", with the year only in another year', () => {
  expect(dayLabel('2026-10-25', today)).toBe('25 Oct')
  expect(dayLabel('2027-01-03', today)).toBe('3 Jan 2027')
  expect(dayLabel('', today)).toBe('')
})
