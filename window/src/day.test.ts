// The person's own day in the window (Batch A, pick 4). Also run under TZ=America/Chicago (pnpm tz).
import { describe, expect, it } from 'vitest'
import { dayOf, isPast } from './day.ts'

describe('the person’s own day', () => {
  it('is the browser’s day', () => {
    const d = new Date(2026, 9, 31, 23, 30) // 23:30 on 31 Oct, wherever this runs
    expect(dayOf(d)).toBe('2026-10-31')
  })

  it('keeps today’s all-day event ahead until the day ends, and a moment past once it passes', () => {
    const evening = new Date(2026, 9, 31, 22, 0)
    expect(isPast('2026-10-31', evening)).toBe(false) // today, all day
    expect(isPast('2026-10-30', evening)).toBe(true)
    expect(isPast(new Date(2026, 9, 31, 21, 0).toISOString(), evening)).toBe(true)
    expect(isPast(new Date(2026, 9, 31, 23, 0).toISOString(), evening)).toBe(false)
  })
})
