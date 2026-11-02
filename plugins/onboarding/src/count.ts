// What the closer look's tools count with (onboarding B): moments in the person's own zone,
// how often something comes, by weekday and hour.

export const WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
export const MINUTE = 60_000

export interface When {
  day: string // 2026-10-31
  time: string // 09:40
  hour: number
  weekday: string // Fri
}

// A moment in the person's own zone.
export function clock(zone: string): (iso: string) => When | null {
  const f = new Intl.DateTimeFormat('en-GB', {
    timeZone: zone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    weekday: 'short',
    hourCycle: 'h23',
  })
  return (iso) => {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return null
    const p = Object.fromEntries(f.formatToParts(d).map((x) => [x.type, x.value]))
    return {
      day: `${p.year}-${p.month}-${p.day}`,
      time: `${p.hour}:${p.minute}`,
      hour: Number(p.hour),
      weekday: String(p.weekday),
    }
  }
}

// How often each key comes, the most first.
export function tally<T>(xs: T[], key: (x: T) => string | null | undefined, by = (_: T) => 1) {
  const n = new Map<string, number>()
  for (const x of xs) {
    const k = key(x)
    if (k) n.set(k, (n.get(k) ?? 0) + by(x))
  }
  return [...n.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
}

export const round = (n: number) => Math.round(n * 10) / 10
export const minutes = (a: string, b: string) =>
  Math.max(0, Math.round((Date.parse(b) - Date.parse(a)) / MINUTE))
export const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b)
  return s.length ? (s[Math.floor(s.length / 2)] ?? 0) : 0
}
export const matches = (words: string) => {
  const w = words.toLowerCase().trim()
  return (...texts: string[]) => texts.some((t) => t.toLowerCase().includes(w))
}
export const weekdays = (whens: When[], by: (i: number) => number = () => 1) => {
  const n = new Map<string, number>()
  whens.forEach((w, i) => {
    n.set(w.weekday, (n.get(w.weekday) ?? 0) + by(i))
  })
  return Object.fromEntries(WEEK.filter((d) => n.get(d)).map((d) => [d, round(n.get(d) ?? 0)]))
}
export const hours = (whens: When[]) =>
  Object.fromEntries(
    tally(whens, (w) => String(w.hour).padStart(2, '0')).sort((a, b) => a[0].localeCompare(b[0])),
  )

export type Timed<T> = T & { w: When }
