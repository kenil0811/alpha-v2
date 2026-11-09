// When a schedule next runs, as Today's "Coming up" shows it.
import { describe, expect, it } from 'vitest'
import { nextRun } from './schedules.ts'

const at = (s: string) => new Date(s).getTime()

describe('a schedule’s next run', () => {
  it('is tomorrow at its hour when it ran today', () => {
    const next = nextRun(
      { every: 'day', at: '07:00' },
      '2026-10-20T10:04:00',
      at('2026-10-20T13:00:00'),
    )
    expect(next?.getDate()).toBe(21)
    expect(next?.getHours()).toBe(7)
  })

  it('is today at its hour when that has not come yet', () => {
    const next = nextRun(
      { every: 'day', at: '18:00' },
      '2026-10-19T18:00:00',
      at('2026-10-20T13:00:00'),
    )
    expect(next?.getDate()).toBe(20)
    expect(next?.getHours()).toBe(18)
  })

  it('is now when it never ran and its hour has passed', () => {
    const now = at('2026-10-20T13:00:00')
    expect(nextRun({ every: 'day', at: '07:00' }, null, now)?.getTime()).toBe(now)
  })

  it('is an hour after the last for an hourly one', () => {
    const next = nextRun({ every: 'hour' }, '2026-10-20T12:30:00', at('2026-10-20T13:00:00'))
    expect(next?.getTime()).toBe(at('2026-10-20T13:30:00'))
  })

  it('follows a schedule', () => {
    const next = nextRun({ cron: '0 9 * * 1' }, null, at('2026-10-20T13:00:00')) // Mondays at 9
    expect(next?.getDay()).toBe(1)
    expect(next?.getHours()).toBe(9)
  })

  it('has no time when it runs on changes', () => {
    expect(nextRun({ changes: 'Deals' }, null, Date.now())).toBeNull()
  })
})
