// Home's Next and the day's strip (ui-rules O1, L14): a meeting under way, else the soonest thing
// ahead, else a task due any time today; free time from a quarter of an hour; now in its place.
import type { DayView } from '@alpha/core/api'
import { describe, expect, it } from 'vitest'
import { lengthOf, nextOf, stripOf } from './next.ts'

const at = (hhmm: string) => new Date(`2026-11-17T${hhmm}:00`).getTime()
const iso = (hhmm: string) => new Date(at(hhmm)).toISOString()
const event = (id: string, from: string, to: string) => ({
  id,
  table: 't_events',
  title: id,
  starts: iso(from),
  ends: iso(to),
  allDay: false,
  location: null,
})
const day: DayView = {
  calendar: 't_events',
  events: [
    { ...event('Offsite', '00:00', '00:00'), starts: '2026-11-17', ends: null, allDay: true },
    event('Standup', '09:00', '09:15'),
    event('Harbor call', '10:30', '11:00'),
  ],
  tasks: [
    { id: 'Send tax forms', title: 'Send tax forms', due: '2026-11-17', timed: false },
    { id: 'Call the bank', title: 'Call the bank', due: iso('14:00'), timed: true },
  ],
}
const words = (now: string) => nextOf(day, at(now))?.words.replace(/\d{1,2}:\d{2}\s?[AP]?M?/g, 'T')

describe('Next', () => {
  it('is a meeting under way until it ends, else the soonest ahead, else a task due today', () => {
    expect(words('08:00')).toBe('T · Standup')
    expect(words('10:45')).toBe('Now until T · Harbor call')
    expect(words('11:30')).toBe('Due T · Call the bank')
    expect(words('15:00')).toBe('Due today · Send tax forms')
    expect(nextOf({ ...day, tasks: [] }, at('15:00'))).toBeNull()
  })
})

describe('the day’s strip', () => {
  it('greys what is over, says the free time between, and puts now in its place', () => {
    const strip = stripOf(day, at('10:00')).map((s) =>
      s.kind === 'thing'
        ? `${s.thing.title}${s.past ? ' (over)' : ''}${s.now ? ' (next)' : ''}`
        : s.kind === 'free'
          ? `free ${lengthOf(s.minutes)}`
          : 'now',
    )
    expect(strip).toEqual([
      'Standup (over)',
      'now',
      'free 1 h 15 min',
      'Harbor call (next)',
      'free 3 h',
      'Call the bank',
    ])
    // in a meeting, the meeting is now: no line beside it
    expect(stripOf(day, at('10:45')).some((s) => s.kind === 'now')).toBe(false)
  })
})
