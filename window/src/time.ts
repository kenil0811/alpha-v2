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

// A due as a person says it: Today, Tomorrow, Fri 24 Oct, with its time when it has one.
export function dueWords(due: string): string {
  const d = new Date(due.includes('T') ? due : `${due}T12:00:00`)
  const days = Math.round(
    (new Date(d).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) / 86_400_000,
  )
  const day =
    days === 0
      ? 'Today'
      : days === 1
        ? 'Tomorrow'
        : days === -1
          ? 'Yesterday'
          : d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })
  return due.includes('T')
    ? `${day}, ${d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false })}`
    : day
}

// The key a shortcut names: Command on a Mac, Control everywhere else.
export const MOD =
  typeof navigator !== 'undefined' && /Mac/.test(navigator.platform) ? '⌘' : 'Ctrl+'

// A moment as a datetime field shows it, in the person's own time.
export function toLocalInput(iso: string): string {
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}
