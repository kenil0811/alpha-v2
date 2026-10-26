import { describe, expect, it } from 'vitest'
import { span } from './Reports.tsx'

describe('a report period', () => {
  const now = new Date(2026, 1, 14) // 14 Feb 2026
  it('runs from the first to the last day', () => {
    expect(span('month', now)).toEqual(['2026-02-01', '2026-02-28'])
    expect(span('last', now)).toEqual(['2026-01-01', '2026-01-31'])
    expect(span('quarter', now)).toEqual(['2026-01-01', '2026-03-31'])
    expect(span('year', now)).toEqual(['2026-01-01', '2026-12-31'])
    expect(span('all', now)).toBeNull()
  })
  it('crosses the year back in January', () => {
    expect(span('last', new Date(2026, 0, 5))).toEqual(['2025-12-01', '2025-12-31'])
  })
})
