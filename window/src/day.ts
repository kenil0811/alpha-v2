// The person's own day in the window: the browser's zone is theirs. A day ("2026-10-31") is
// compared as a day, a moment as a moment, never as UTC strings side by side.

const pad = (n: number) => String(n).padStart(2, '0')

// Today, or a moment's day, in the person's zone: 2026-10-31.
export function dayOf(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

// Whether a day or a moment is over: a day once it has ended where the person is, a moment once
// it has passed.
export function isPast(at: string, now: Date = new Date()): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(at) ? at < dayOf(now) : Date.parse(at) <= now.getTime()
}
