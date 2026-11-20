// Home's Next chip at the bar's right, and the day it opens beside the page (ui-rules O1, L14):
// today's meetings and tasks down one strip, the free time between them, and where now is. Both
// read the person's day from the core, again at each journal line and each minute.
import type { DayView } from '@alpha/core/api'
import { CalendarClock, Circle } from 'lucide-react'
import { useEffect, useState } from 'react'
import { api } from './api.ts'
import { dayOf } from './day.ts'
import { lengthOf, nextOf, stripOf, type Thing, thingsOf, time } from './next.ts'
import { withBeside } from './opened.ts'
import { cn } from './ui/cn.ts'
import { cutTip } from './ui/cut-tip.ts'

// The person's day, and now, moving on each minute.
function useDay(version: number): { day: DayView | null; now: number } {
  const [day, setDay] = useState<DayView | null>(null)
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(t)
  }, [])
  const date = dayOf(new Date(now))
  useEffect(() => {
    if (version < 0) return
    const from = new Date(`${date}T00:00:00`)
    const to = new Date(from)
    to.setDate(to.getDate() + 1)
    const q = new URLSearchParams({ date, from: from.toISOString(), to: to.toISOString() })
    api.get<DayView>(`/api/day?${q}`).then(setDay, () => setDay(null))
  }, [version, date])
  return { day, now }
}

const iconOf = (t: Thing, className: string) =>
  t.kind === 'event' ? <CalendarClock className={className} /> : <Circle className={className} />

// What comes next today, at the right of Home's bar; nothing when nothing is left today. It opens
// the day beside the page, or the Calendar where there is no room beside.
export function NextChip({ version, room }: { version: number; room: boolean }) {
  const { day, now } = useDay(version)
  const next = day ? nextOf(day, now) : null
  if (!day || !next) return null
  return (
    <a
      href={
        room
          ? withBeside('#/', { kind: 'day', id: 'today' })
          : day.calendar
            ? `#/table/${day.calendar}`
            : '#/tasks'
      }
      {...cutTip(next.words)}
      className="hidden h-7 min-w-0 max-w-72 items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 text-ink-2 text-md hover:bg-hover hover:text-ink @2xl:flex"
    >
      {iconOf(next.thing, 'size-3.5 shrink-0 text-accent')}
      <span className="truncate">{next.words}</span>
    </a>
  )
}

// The day beside the page: all-day events, the strip, and the tasks due any time today. A meeting
// opens its event in the panel's place, a task the task.
export function DayBeside({
  version,
  onName,
  onPage,
}: {
  version: number
  onName: (name: string) => void
  onPage: (href: string) => void
}) {
  const { day, now } = useDay(version)
  // named once the day is in: the panel clears the name when it opens
  useEffect(() => {
    if (!day) return
    const today = new Date().toLocaleDateString(undefined, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    })
    onName(`Today, ${today}`)
    if (day.calendar) onPage(`#/table/${day.calendar}`)
  }, [day, onName, onPage])
  if (!day) return null
  const { allDay, anyTime } = thingsOf(day)
  const strip = stripOf(day, now)
  const line = (t: Thing) => (
    <a
      key={`${t.kind}-${t.id}`}
      href={t.href}
      className="flex min-w-0 items-center gap-2 rounded-md px-2 py-1 text-ink text-md hover:bg-hover"
    >
      {iconOf(t, 'size-3.5 shrink-0 text-ink-3')}
      <span className="min-w-0 flex-1 truncate">{t.title}</span>
    </a>
  )
  return (
    <div className="flex h-full flex-col gap-5 overflow-y-auto px-4 py-4">
      {allDay.length > 0 && (
        <section className="flex flex-col gap-0.5">
          <h3 className="px-2 font-semibold text-ink-3 text-sm">All day</h3>
          {allDay.map(line)}
        </section>
      )}
      {strip.length > 0 ? (
        <ol className="flex flex-col">
          {strip.map((s) =>
            s.kind === 'now' ? (
              <li key="now" className="flex items-center gap-2 py-1" aria-label="Now">
                <span className="w-16 shrink-0 text-right font-medium text-accent text-sm tabular-nums">
                  {time(s.at)}
                </span>
                <span className="h-px flex-1 bg-accent" />
              </li>
            ) : s.kind === 'free' ? (
              <li key={`free-${s.at}`} className="flex items-center gap-2 py-1.5">
                <span className="w-16 shrink-0" />
                <span className="text-ink-3 text-sm">Free {lengthOf(s.minutes)}</span>
              </li>
            ) : (
              <li key={`${s.thing.kind}-${s.thing.id}`} className="flex items-stretch gap-2">
                <span
                  className={cn(
                    'w-16 shrink-0 pt-1.5 text-right text-sm tabular-nums',
                    s.past ? 'text-ink-3' : 'text-ink-2',
                  )}
                >
                  {time(s.thing.at ?? now)}
                </span>
                <a
                  href={s.thing.href}
                  style={{ minHeight: blockHeight(s.thing) }}
                  className={cn(
                    'flex min-w-0 flex-1 flex-col rounded-md border-l-2 px-2.5 py-1.5 hover:bg-hover',
                    s.thing.kind === 'event' ? 'bg-sunk' : 'bg-transparent',
                    s.now ? 'border-accent' : 'border-line',
                    s.past && 'opacity-60',
                  )}
                >
                  <span className="truncate text-ink text-md">{s.thing.title}</span>
                  {s.thing.until !== null && (
                    <span className="text-ink-3 text-sm tabular-nums">
                      {time(s.thing.at ?? now)} to {time(s.thing.until)}
                    </span>
                  )}
                </a>
              </li>
            ),
          )}
        </ol>
      ) : null}
      {anyTime.length > 0 && (
        <section className="flex flex-col gap-0.5">
          <h3 className="px-2 font-semibold text-ink-3 text-sm">Any time today</h3>
          {anyTime.map(line)}
        </section>
      )}
    </div>
  )
}

// A meeting as tall as it is long, a little under a pixel a minute; a task one line.
function blockHeight(t: Thing): number | undefined {
  if (t.until === null || t.at === null) return undefined
  return Math.max(40, Math.round(((t.until - t.at) / 60_000) * 0.8))
}
