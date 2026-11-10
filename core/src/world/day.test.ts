// The person's own day: days and months in the person's zone, never UTC's. These tests also run
// under TZ=America/Chicago (pnpm tz), where the UTC day is often tomorrow.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { dayOf, dayOfWhen, dayPlus, monthOf, monthSpan, startOf, weekdayOf } from './day.ts'

const lateInChicago = new Date('2026-11-01T03:00:00Z') // 31 Oct, 22:00 in Chicago

describe('the person’s own day', () => {
  it('is the day and month in their zone, not UTC’s', () => {
    expect(dayOf(lateInChicago, 'America/Chicago')).toBe('2026-10-31')
    expect(dayOf(lateInChicago, 'Europe/London')).toBe('2026-11-01')
    expect(monthOf(lateInChicago, 'America/Chicago')).toBe('2026-10')
    expect(dayOfWhen('2026-10-31', 'Asia/Tokyo')).toBe('2026-10-31') // a day stays a day
    expect(dayOfWhen('2026-11-01T03:00:00.000Z', 'America/Chicago')).toBe('2026-10-31')
  })

  it('starts at the zone’s midnight, across a clock change', () => {
    // Chicago leaves summer time at 02:00 on 1 Nov 2026: its midnight is still UTC-5
    expect(startOf('2026-11-01', 'America/Chicago').toISOString()).toBe('2026-11-01T05:00:00.000Z')
    expect(startOf('2026-11-02', 'America/Chicago').toISOString()).toBe('2026-11-02T06:00:00.000Z')
    expect(monthSpan('2026-12', 'Asia/Kolkata').map((d) => d.toISOString())).toEqual([
      '2026-11-30T18:30:00.000Z',
      '2026-12-31T18:30:00.000Z',
    ])
  })

  it('counts days on the calendar, with no zone in it', () => {
    expect(dayPlus('2026-10-31', 1)).toBe('2026-11-01')
    expect(dayPlus('2026-03-01', -1)).toBe('2026-02-28')
    expect(weekdayOf('2026-11-02')).toBe(0) // a Monday
  })

  it('uses the machine’s zone when none is given', () => {
    const d = new Date()
    const pad = (n: number) => String(n).padStart(2, '0')
    expect(dayOf(d)).toBe(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`)
  })
})

// The wall: no day or month is taken from a UTC string outside the helpers (core's and the
// window's day.ts).
describe('the day wall', () => {
  const ROOT = join(import.meta.dirname, '..', '..', '..')
  const files = (dir: string): string[] =>
    readdirSync(dir).flatMap((n) => {
      const p = join(dir, n)
      if (statSync(p).isDirectory()) return files(p)
      return /\.tsx?$/.test(n) && !/\.test\.tsx?$/.test(n) ? [p] : []
    })

  it('finds no toISOString().slice(0, 10) or slice(0, 7) outside the day helpers', () => {
    const found = [...files(join(ROOT, 'core', 'src')), ...files(join(ROOT, 'window', 'src'))]
      .filter((f) => !f.endsWith(`${join('', 'day.ts')}`))
      .flatMap((f) =>
        readFileSync(f, 'utf8')
          .split('\n')
          .map((line, i) => ({ f, i, line }))
          .filter(({ line }) => /toISOString\(\)\.slice\(0, (10|7)\)/.test(line))
          .map(({ f, i }) => `${f.replace(ROOT, '')}:${i + 1}`),
      )
    expect(found).toEqual([])
  })
})
