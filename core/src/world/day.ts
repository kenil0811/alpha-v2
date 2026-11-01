// The person's own day (Batch A, pick 4, Kenil's yes 1 Nov): a day or a month as the person lives
// it, never the UTC one. Late in the evening west of London, the UTC day is already tomorrow, so
// Home's "due today", Usage's month, a backup's and an export's name would all be a day ahead.
// Every place that needs today, this month, or a day's start asks here. The zone is the
// machine's unless given, so a server's per-person zone is one setting later.

type Parts = Record<'year' | 'month' | 'day' | 'hour' | 'minute' | 'second', string>

function partsOf(d: Date, zone?: string): Parts {
  const f = new Intl.DateTimeFormat('en-CA', {
    ...(zone ? { timeZone: zone } : {}),
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  })
  return Object.fromEntries(f.formatToParts(d).map((p) => [p.type, p.value])) as Parts
}

// The day a moment falls on, in the zone: 2026-10-31.
export function dayOf(d: Date = new Date(), zone?: string): string {
  const p = partsOf(d, zone)
  return `${p.year}-${p.month}-${p.day}`
}

// The month a moment falls in, in the zone: 2026-10.
export function monthOf(d: Date = new Date(), zone?: string): string {
  return dayOf(d, zone).slice(0, 7)
}

// A due or a time as a day: a day stays as it is; a moment is the day it falls on, in the zone.
export function dayOfWhen(when: string, zone?: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(when) ? when : dayOf(new Date(when), zone)
}

// The moment a day starts in the zone (its midnight), as the instant it is.
export function startOf(day: string, zone?: string): Date {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number]
  const want = Date.UTC(y, m - 1, d)
  let t = want
  // twice, so a day a clock change falls in lands right
  for (let i = 0; i < 2; i++) {
    const p = partsOf(new Date(t), zone)
    t += want - Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second)
  }
  return new Date(t)
}

// A month's first instant and the next month's, in the zone: what "this month" holds.
export function monthSpan(month: string, zone?: string): [Date, Date] {
  const [y, m] = month.split('-').map(Number) as [number, number]
  const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`
  return [startOf(`${month}-01`, zone), startOf(`${next}-01`, zone)]
}

// Calendar arithmetic on a day, with no zone in it: 2026-10-31 plus 1 is 2026-11-01.
export function dayPlus(day: string, n: number): string {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number]
  const t = new Date(Date.UTC(y, m - 1, d + n))
  const pad = (v: number) => String(v).padStart(2, '0')
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`
}

// The weekday of a day, Monday 0 to Sunday 6.
export function weekdayOf(day: string): number {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number]
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7
}
