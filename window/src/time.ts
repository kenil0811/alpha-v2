// Times as a person says them: a clock time, "tomorrow at 07:00", "since you cleared it at 13:21".

export const clock = (d: Date) =>
  d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false })

// A time ahead or behind, as a person says it: "now", "today at 18:00", "tomorrow at 07:00".
export function dayWords(at: string): string {
  const d = new Date(at)
  const now = new Date()
  if (Math.abs(d.getTime() - now.getTime()) < 60_000) return 'now'
  const days = Math.round(
    (new Date(d).setHours(0, 0, 0, 0) - new Date(now).setHours(0, 0, 0, 0)) / 86_400_000,
  )
  if (days === 0) return `today at ${clock(d)}`
  if (days === 1) return `tomorrow at ${clock(d)}`
  if (days === -1) return `yesterday at ${clock(d)}`
  const date = d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })
  return `${date} at ${clock(d)}`
}

// Where "since you last looked" starts: today, or when the person last cleared it.
export function sinceWords(since: string): string {
  const d = new Date(since)
  if (d.getTime() === new Date().setHours(0, 0, 0, 0)) return 'Today, until you clear it'
  if (d.toDateString() === new Date().toDateString()) return `Since you cleared it at ${clock(d)}`
  return `Since you cleared it ${dayWords(since)}`
}
