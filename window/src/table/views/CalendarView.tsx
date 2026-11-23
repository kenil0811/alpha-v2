// The calendar: a month of days, a week or a day of hours, each row on the day and time of the
// view's date, each on one line (its words cut short, the whole in the tip), the earlier and later ones a click away. With the view's end date (until), a row in a
// week or a day is as long as it lasts; a row that takes the whole day sits above the hours. A row
// opens whole; the rows with no date are counted. With no rows yet it is an empty month, with no
// words over it (T5).
import type { RowView, TableView as TableData, ViewConfig } from '@alpha/core/api'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Button, IconButton } from '../../ui/button.tsx'
import { cn } from '../../ui/cn.ts'
import { cutTip } from '../../ui/cut-tip.ts'
import { FRAME } from '../../ui/frame.tsx'
import { Segmented } from '../../ui/segmented.tsx'
import { numberOf } from '../engine.ts'
import { DOT, titleOf } from '../values.ts'

const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
const DAY = 86_400_000
const HOUR = 48 // the height of an hour in a week or a day, in pixels
const CHIP = 24 // a row's line in a month's day, with the gap above it, in pixels
const DAY_TOP = 60 // a month's day's date and its "n more", with its padding
type Span = 'month' | 'week' | 'day'

// Monday of the week a day is in.
const mondayOf = (d: Date) => {
  const m = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  m.setDate(m.getDate() - ((m.getDay() + 6) % 7))
  return m
}
const plusDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)

interface Placed {
  row: RowView
  at: Date
  end: Date | null
  allDay: boolean
}

export function CalendarView({
  rows,
  data,
  view,
  onOpen,
}: {
  rows: RowView[]
  data: TableData
  view: ViewConfig
  onOpen: (id: string) => void
}) {
  const fields = data.fields
  const by = fields.find((f) => f.id === view.by && f.kind === 'date') ?? fields[0]
  const until = fields.find((f) => f.id === view.until && f.kind === 'date')
  // a choice named All day says a row takes the whole day
  const whole = fields.find((f) => f.kind === 'choice' && f.name.toLowerCase() === 'all day')
  const placed = useMemo(
    () =>
      rows.flatMap((r): Placed[] => {
        const t = by ? numberOf(by, r.values[by.slug]) : null
        if (t === null) return []
        const e = until ? numberOf(until, r.values[until.slug]) : null
        const allDay = whole ? String(r.values[whole.slug] ?? '') === 'yes' : false
        return [{ row: r, at: new Date(t), end: e === null ? null : new Date(e), allDay }]
      }),
    [rows, by, until, whole],
  )
  const [span, setSpan] = useState<Span>('month')
  // where it opens: today when any row falls this month, else the latest row's day
  const [anchor, setAnchor] = useState(() => {
    const now = new Date()
    const here = placed.some(
      (d) => d.at.getFullYear() === now.getFullYear() && d.at.getMonth() === now.getMonth(),
    )
    const latest = placed.reduce<Date | null>((a, d) => (!a || d.at > a ? d.at : a), null)
    return here || !latest ? now : latest
  })
  if (!by) return null
  const colour = fields.find((f) => f.kind === 'choice' && Object.keys(f.tones).length)
  const toneOf = (r: RowView) =>
    colour ? colour.tones[String(r.values[colour.slug] ?? '')] : undefined
  const move = (n: number) =>
    setAnchor(
      span === 'month'
        ? new Date(anchor.getFullYear(), anchor.getMonth() + n, 1)
        : plusDays(anchor, n * (span === 'week' ? 7 : 1)),
    )
  const title =
    span === 'month'
      ? anchor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
      : span === 'week'
        ? `Week of ${mondayOf(anchor).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}`
        : anchor.toLocaleDateString(undefined, {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })
  const words = { month: 'month', week: 'week', day: 'day' }[span]
  return (
    <div className="flex min-h-0 flex-1 flex-col p-4">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <h2 className="font-medium font-serif text-ink text-xl">{title}</h2>
        <IconButton label={`The ${words} before`} onClick={() => move(-1)}>
          <ChevronLeft className="size-4" />
        </IconButton>
        <IconButton label={`The ${words} after`} onClick={() => move(1)}>
          <ChevronRight className="size-4" />
        </IconButton>
        <Button size="sm" variant="ghost" onClick={() => setAnchor(new Date())}>
          Today
        </Button>
        <span className="flex-1" />
        {rows.length - placed.length > 0 && (
          <span className="text-ink-3 text-sm">{rows.length - placed.length} with no date</span>
        )}
        <Segmented
          label="Show a month, a week or a day"
          value={span}
          onChange={(v) => setSpan(v as Span)}
          options={[
            { value: 'month', label: 'Month' },
            { value: 'week', label: 'Week' },
            { value: 'day', label: 'Day' },
          ]}
        />
      </div>
      {span === 'month' ? (
        <Month
          anchor={anchor}
          placed={placed}
          names={(r) => titleOf(fields, r)}
          toneOf={toneOf}
          onOpen={onOpen}
          onDay={(d) => {
            setAnchor(d)
            setSpan('day')
          }}
        />
      ) : (
        <Hours
          days={
            span === 'week'
              ? Array.from({ length: 7 }, (_, i) => plusDays(mondayOf(anchor), i))
              : [anchor]
          }
          placed={placed}
          names={(r) => titleOf(fields, r)}
          toneOf={toneOf}
          onOpen={onOpen}
        />
      )}
    </div>
  )
}

interface Draw {
  placed: Placed[]
  names: (r: RowView) => string
  toneOf: (r: RowView) => string | undefined
  onOpen: (id: string) => void
}

function Chip({
  p,
  names,
  toneOf,
  onOpen,
  time,
}: Omit<Draw, 'placed'> & { p: Placed; time?: boolean }) {
  const tone = toneOf(p.row)
  return (
    <button
      type="button"
      onClick={() => onOpen(p.row.id)}
      {...cutTip(names(p.row))}
      className="flex w-full min-w-0 shrink-0 items-center gap-1.5 overflow-hidden whitespace-nowrap rounded-sm bg-sunk px-1.5 py-0.5 text-left text-ink text-sm hover:bg-hover"
    >
      {tone && (
        <span className={cn('size-1.5 shrink-0 rounded-full', DOT[tone as keyof typeof DOT])} />
      )}
      {time && !p.allDay && (
        <span className="shrink-0 text-ink-3 tabular-nums">
          {p.at.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
        </span>
      )}
      <span className="truncate">{names(p.row)}</span>
    </button>
  )
}

function Month({
  anchor,
  placed,
  names,
  toneOf,
  onOpen,
  onDay,
}: Draw & { anchor: Date; onDay: (d: Date) => void }) {
  const month = new Date(anchor.getFullYear(), anchor.getMonth(), 1)
  const byDay = new Map<string, Placed[]>()
  for (const p of [...placed].sort((a, b) => +a.at - +b.at))
    byDay.set(dayKey(p.at), [...(byDay.get(dayKey(p.at)) ?? []), p])
  const first = mondayOf(month)
  const days = Array.from({ length: 42 }, (_, i) => plusDays(first, i))
  const weeks = days[35]?.getMonth() === month.getMonth() ? 6 : 5
  const today = dayKey(new Date())
  // every week of the month on one screen, no scrolling (Vikas, 23 Nov): a day shows the rows its
  // height holds, never fewer than one, with the date and "n more" on lines of their own
  const grid = useRef<HTMLDivElement>(null)
  const [fit, setFit] = useState(3)
  useEffect(() => {
    const g = grid.current
    if (!g) return
    const size = () => setFit(Math.max(1, Math.floor((g.clientHeight / weeks - DAY_TOP) / CHIP)))
    size()
    const watch = new ResizeObserver(size)
    watch.observe(g)
    return () => watch.disconnect()
  }, [weeks])
  return (
    <>
      <div className="grid grid-cols-7 border-line border-b text-ink-3 text-sm">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
          <div key={d} className="px-2 py-1.5 font-semibold">
            {d}
          </div>
        ))}
      </div>
      <div
        ref={grid}
        className="grid min-h-0 flex-1 grid-cols-7 overflow-hidden rounded-b-lg border-line border-r border-l bg-surface"
        style={{ gridTemplateRows: `repeat(${weeks}, minmax(0, 1fr))` }}
      >
        {days.slice(0, weeks * 7).map((d) => {
          const here = byDay.get(dayKey(d)) ?? []
          const inMonth = d.getMonth() === month.getMonth()
          return (
            <div
              key={dayKey(d)}
              className={cn(
                'flex min-h-0 min-w-0 flex-col gap-1 overflow-hidden border-hair border-b border-l p-1.5 first:border-l-0 [&:nth-child(7n+1)]:border-l-0',
                !inMonth && 'bg-canvas',
              )}
            >
              <button
                type="button"
                onClick={() => onDay(d)}
                data-tip="Show this day"
                className={cn(
                  'grid size-6 place-items-center rounded-full text-sm tabular-nums hover:bg-hover',
                  dayKey(d) === today
                    ? 'bg-accent font-medium text-accent-ink hover:bg-accent'
                    : inMonth
                      ? 'text-ink-2'
                      : 'text-ink-3',
                )}
              >
                {d.getDate()}
              </button>
              {here.slice(0, fit).map((p) => (
                <Chip key={p.row.id} p={p} names={names} toneOf={toneOf} onOpen={onOpen} time />
              ))}
              {here.length > fit && (
                <button
                  type="button"
                  onClick={() => onDay(d)}
                  className="px-1.5 text-left text-ink-3 text-xs hover:text-ink"
                >
                  {here.length - fit} more
                </button>
              )}
            </div>
          )
        })}
      </div>
    </>
  )
}

// A week or a day of hours: each timed row as long as it lasts (half an hour when it has no end),
// beside the others it overlaps; whole-day rows above the hours.
function Hours({ days, placed, names, toneOf, onOpen }: Draw & { days: Date[] }) {
  const today = dayKey(new Date())
  const on = (d: Date) => placed.filter((p) => dayKey(p.at) === dayKey(d))
  const allDay = days.map((d) => on(d).filter((p) => p.allDay))
  const hours = Array.from({ length: 24 }, (_, h) => h)
  return (
    <div className={`${FRAME} flex min-h-0 flex-1 flex-col overflow-hidden`}>
      <div
        className="grid overflow-y-hidden border-line border-b [scrollbar-gutter:stable]"
        style={{ gridTemplateColumns: `56px repeat(${days.length}, minmax(0, 1fr))` }}
      >
        <div />
        {days.map((d, i) => (
          <div key={dayKey(d)} className="flex min-w-0 flex-col gap-1 border-hair border-l p-1.5">
            <span
              className={cn(
                'text-sm',
                dayKey(d) === today ? 'font-medium text-accent' : 'text-ink-2',
              )}
            >
              {d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' })}
            </span>
            {allDay[i]?.map((p) => (
              <Chip key={p.row.id} p={p} names={names} toneOf={toneOf} onOpen={onOpen} />
            ))}
          </div>
        ))}
      </div>
      <div
        className="grid min-h-0 flex-1 overflow-y-auto [scrollbar-gutter:stable]"
        style={{ gridTemplateColumns: `56px repeat(${days.length}, minmax(0, 1fr))` }}
        ref={(el) => {
          // opens on the working day: eight in the morning at the top
          if (el && !el.dataset.placed) {
            el.scrollTop = 8 * HOUR
            el.dataset.placed = 'yes'
          }
        }}
      >
        <div className="relative" style={{ height: 24 * HOUR }}>
          {hours.map((h) => (
            <span
              key={h}
              className="absolute right-2 text-ink-3 text-xs tabular-nums"
              style={{ top: h * HOUR - 6 }}
            >
              {h === 0
                ? ''
                : new Date(2000, 0, 1, h).toLocaleTimeString(undefined, { hour: 'numeric' })}
            </span>
          ))}
        </div>
        {days.map((d) => {
          const timed = on(d)
            .filter((p) => !p.allDay)
            .sort((a, b) => +a.at - +b.at)
          // overlapping rows share the width, each in its own lane
          const lanes: number[] = []
          const laid = timed.map((p) => {
            const end = p.end && +p.end > +p.at ? +p.end : +p.at + DAY / 48
            let lane = lanes.findIndex((free) => free <= +p.at)
            if (lane < 0) lane = lanes.push(end) - 1
            else lanes[lane] = end
            return { p, end, lane }
          })
          const width = Math.max(1, lanes.length)
          const start = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
          return (
            <div
              key={dayKey(d)}
              className="relative border-hair border-l"
              style={{ height: 24 * HOUR }}
            >
              {hours.map((h) => (
                <div
                  key={h}
                  className="absolute inset-x-0 border-hair border-t"
                  style={{ top: h * HOUR }}
                />
              ))}
              {laid.map(({ p, end, lane }) => {
                const top = ((+p.at - start) / 3_600_000) * HOUR
                const height = Math.max(20, ((end - +p.at) / 3_600_000) * HOUR - 2)
                return (
                  <button
                    key={p.row.id}
                    type="button"
                    onClick={() => onOpen(p.row.id)}
                    {...cutTip(names(p.row))}
                    className="absolute flex items-baseline gap-1.5 overflow-hidden whitespace-nowrap rounded-sm border border-accent/30 bg-accent-soft px-1.5 py-0.5 text-left text-ink text-sm hover:bg-hover"
                    style={{
                      top,
                      height,
                      left: `calc(${(lane / width) * 100}% + 2px)`,
                      width: `calc(${100 / width}% - 4px)`,
                    }}
                  >
                    <span className="shrink-0 text-ink-3 text-xs tabular-nums">
                      {p.at.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
                    </span>
                    <span className="truncate font-medium">{names(p.row)}</span>
                  </button>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}
