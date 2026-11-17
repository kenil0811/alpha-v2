// What comes next today, and the day as one strip (ui-rules O1, L14), worked out from the day the
// core sends: the meetings and the open tasks due today, in the person's own time (W7).
import type { DayView } from '@alpha/core/api'

// One thing in the day: a meeting from its start to its end, or a task due at a time or any time.
export interface Thing {
  kind: 'event' | 'task'
  id: string
  title: string
  at: number | null // none: a task due any time today
  until: number | null // a meeting's end
  href: string // its page: a meeting opens as its row, a task as the task
}

// The strip's rows, in order: things, the free time between them, and where now is.
export type Slot =
  | { kind: 'thing'; thing: Thing; past: boolean; now: boolean }
  | { kind: 'free'; minutes: number; at: number }
  | { kind: 'now'; at: number }

// free time is said from a quarter of an hour
const FREE = 15 * 60_000

export const time = (at: number) =>
  new Date(at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })

export function thingsOf(day: DayView): { timed: Thing[]; allDay: Thing[]; anyTime: Thing[] } {
  const events = day.events.map(
    (e): Thing => ({
      kind: 'event',
      id: e.id,
      title: e.title,
      at: e.allDay ? null : Date.parse(e.starts),
      until: e.allDay || !e.ends ? null : Date.parse(e.ends),
      href: `#/row/${e.id}`,
    }),
  )
  const tasks = day.tasks.map(
    (t): Thing => ({
      kind: 'task',
      id: t.id,
      title: t.title,
      at: t.timed ? Date.parse(t.due) : null,
      until: null,
      href: `#/tasks/${t.id}`,
    }),
  )
  const timed = [...events, ...tasks]
    .filter((x) => x.at !== null)
    .sort((a, b) => (a.at ?? 0) - (b.at ?? 0))
  return {
    timed,
    allDay: events.filter((x) => x.at === null),
    anyTime: tasks.filter((x) => x.at === null),
  }
}

// The chip's words: a meeting under way until it ends, else the soonest meeting or timed task
// still ahead, else a task due any time today; none when nothing is left today.
export function nextOf(day: DayView, now: number): { thing: Thing; words: string } | null {
  const { timed, anyTime } = thingsOf(day)
  const on = timed.find(
    (x) => x.kind === 'event' && (x.at ?? 0) <= now && x.until !== null && x.until > now,
  )
  if (on) return { thing: on, words: `Now until ${time(on.until ?? now)} · ${on.title}` }
  const ahead = timed.find((x) => (x.at ?? 0) > now)
  if (ahead)
    return {
      thing: ahead,
      words:
        ahead.kind === 'event'
          ? `${time(ahead.at ?? now)} · ${ahead.title}`
          : `Due ${time(ahead.at ?? now)} · ${ahead.title}`,
    }
  const any = anyTime[0]
  return any ? { thing: any, words: `Due today · ${any.title}` } : null
}

// The timed part of the day, top to bottom: each thing, greyed once over, the free time of a
// quarter of an hour or more between them, and a line where now is.
export function stripOf(day: DayView, now: number): Slot[] {
  const { timed } = thingsOf(day)
  const next = nextOf(day, now)?.thing
  const out: Slot[] = []
  let end: number | null = null
  // a meeting under way is marked itself: no line for now beside it
  let placed = !!next && next.at !== null && next.at <= now
  for (const thing of timed) {
    const at = thing.at ?? 0
    if (!placed && at > now) {
      out.push({ kind: 'now', at: now })
      placed = true
    }
    if (end !== null && at - end >= FREE)
      out.push({ kind: 'free', minutes: (at - end) / 60_000, at: end })
    const isNext = !!next && next.kind === thing.kind && next.id === thing.id
    out.push({ kind: 'thing', thing, past: (thing.until ?? at) <= now, now: isNext })
    end = Math.max(end ?? 0, thing.until ?? at)
  }
  if (!placed && timed.length) out.push({ kind: 'now', at: now })
  return out
}

// "1 h 30 min", "45 min"
export function lengthOf(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = Math.round(minutes % 60)
  return h ? (m ? `${h} h ${m} min` : `${h} h`) : `${m} min`
}
