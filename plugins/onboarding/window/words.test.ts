// Onboarding's row on Home says what waits, in words.
import { describe, expect, it } from 'vitest'
import { waitWords } from './index.tsx'

describe('Home’s row', () => {
  it('says what waits, in words', () => {
    expect(waitWords({ lines: 11, questions: 4, routines: 0, suggestions: 6 })).toBe(
      '11 lines, 4 questions and 6 suggestions wait for you',
    )
    expect(waitWords({ lines: 0, questions: 1, routines: 0, suggestions: 0 })).toBe(
      '1 question waits for you',
    )
    expect(waitWords({ lines: 0, questions: 0, routines: 2, suggestions: 0 })).toBe(
      '2 routines wait for you',
    )
  })
})
