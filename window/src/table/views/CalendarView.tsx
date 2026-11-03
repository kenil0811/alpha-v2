// The calendar: a month of days, each row on the day of the view's date; earlier and later
// months a click away. A row opens whole; the rows with no date are counted under the month. The
// Calendar module's also lays every task due and every date ahead from the other modules beside
// its events, outlined (Vikas, 3 Nov).
import type { DateRow, FieldView, RowView } from '@alpha/core/api'
import { ChevronLeft, ChevronRight, ListChecks } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { api } from '../../api.ts'
import { peek } from '../../Peek.tsx'
import { Button, IconButton } from '../../ui/button.tsx'
import { cn } from '../../ui/cn.ts'
import { numberOf } from '../engine.ts'
import { DOT, titleOf } from '../values.ts'

const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`

export function CalendarView({
  rows,
  fields,
  by,
  onOpen,
  gather = false,
}: {
  rows: RowView[]
  fields: FieldView[]
  by: FieldView
  onOpen: (id: string) => void
  gather?: boolean // the Calendar module's: every task due and date ahead beside its events
}) {
  const [more, setMore] = useState<DateRow[]>([])
  useEffect(() => {
    if (gather) api.get<DateRow[]>('/api/dates').then(setMore, () => setMore([]))
  }, [gather])
  const dated = useMemo(
    () =>
      rows.flatMap((r) => {
        const t = numberOf(by, r.values[by.slug])
        return t === null ? [] : [{ row: r, at: new Date(t) }]
      }),
    [rows, by],
  )
  // the month shown starts where the rows are: this month if any fall in it, else the latest
  const [month, setMonth] = useState(() => {
    const now = new Date()
    const here = dated.some(
      (d) => d.at.getFullYear() === now.getFullYear() && d.at.getMonth() === now.getMonth(),
    )
    const latest = dated.reduce<Date | null>((a, d) => (!a || d.at > a ? d.at : a), null)
    const m = here || !latest ? now : latest
    return new Date(m.getFullYear(), m.getMonth(), 1)
  })
  const byDay = new Map<string, (RowView | DateRow)[]>()
  const put = (at: Date, x: RowView | DateRow) =>
    byDay.set(dayKey(at), [...(byDay.get(dayKey(at)) ?? []), x])
  for (const d of dated) put(d.at, d.row)
  for (const x of more) {
    const t = Date.parse(x.at.length === 10 ? `${x.at}T00:00:00` : x.at)
    if (!Number.isNaN(t)) put(new Date(t), x)
  }
  // weeks start on Monday
  const first = new Date(month)
  first.setDate(1 - ((month.getDay() + 6) % 7))
  const days = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(first)
    d.setDate(first.getDate() + i)
    return d
  })
  const weeks = days[35]?.getMonth() === month.getMonth() ? 6 : 5
  const today = dayKey(new Date())
  const colour = fields.find((f) => f.kind === 'choice' && Object.keys(f.tones).length)
  const move = (by: number) => setMonth(new Date(month.getFullYear(), month.getMonth() + by, 1))
  return (
    <div className="flex min-h-0 flex-1 flex-col px-7 pb-6">
      <div className="mb-2 flex items-center gap-2">
        <h2 className="font-medium font-serif text-ink text-xl">
          {month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
        </h2>
        <IconButton label="The month before" onClick={() => move(-1)}>
          <ChevronLeft className="size-4" />
        </IconButton>
        <IconButton label="The month after" onClick={() => move(1)}>
          <ChevronRight className="size-4" />
        </IconButton>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1))}
        >
          This month
        </Button>
        <span className="flex-1" />
        <span className="text-ink-3 text-sm">
          By {by.name}
          {rows.length - dated.length > 0 && ` · ${rows.length - dated.length} with no date`}
        </span>
      </div>
      <div className="grid grid-cols-7 border-line border-b text-ink-3 text-sm">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
          <div key={d} className="px-2 py-1.5 font-semibold">
            {d}
          </div>
        ))}
      </div>
      <div
        className="grid min-h-0 flex-1 grid-cols-7 overflow-y-auto rounded-b-lg border-line border-r border-l bg-surface"
        style={{ gridTemplateRows: `repeat(${weeks}, minmax(104px, 1fr))` }}
      >
        {days.slice(0, weeks * 7).map((d) => {
          const here = byDay.get(dayKey(d)) ?? []
          const inMonth = d.getMonth() === month.getMonth()
          return (
            <div
              key={dayKey(d)}
              className={cn(
                'flex min-w-0 flex-col gap-1 border-hair border-b border-l p-1.5 first:border-l-0 [&:nth-child(7n+1)]:border-l-0',
                !inMonth && 'bg-canvas',
              )}
            >
              <span
                className={cn(
                  'grid size-6 place-items-center rounded-full text-sm tabular-nums',
                  dayKey(d) === today
                    ? 'bg-accent font-medium text-accent-ink'
                    : inMonth
                      ? 'text-ink-2'
                      : 'text-ink-3',
                )}
              >
                {d.getDate()}
              </span>
              {here.slice(0, 3).map((r) => {
                // a task or another module's date: outlined, its module said, opening beside
                if ('what' in r)
                  return (
                    <button
                      key={r.href + r.hint}
                      type="button"
                      onClick={() => peek(r.href)}
                      title={`${r.label} · ${r.module ? `${r.module}, ` : ''}${r.hint}`}
                      className="flex items-center gap-1.5 truncate rounded-sm border border-line px-1.5 py-0.5 text-left text-ink-2 text-sm hover:bg-hover"
                    >
                      {r.what === 'task' ? (
                        <ListChecks className="size-3 shrink-0 text-ink-3" />
                      ) : (
                        <span className="size-1.5 shrink-0 rounded-full bg-ink-3" />
                      )}
                      <span className="truncate">{r.label}</span>
                    </button>
                  )
                const tone = colour ? colour.tones[String(r.values[colour.slug] ?? '')] : undefined
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => onOpen(r.id)}
                    title={titleOf(fields, r)}
                    className="flex items-center gap-1.5 truncate rounded-sm bg-sunk px-1.5 py-0.5 text-left text-ink text-sm hover:bg-hover"
                  >
                    {tone && <span className={cn('size-1.5 shrink-0 rounded-full', DOT[tone])} />}
                    <span className="truncate">{titleOf(fields, r)}</span>
                  </button>
                )
              })}
              {here.length > 3 && (
                <span className="px-1.5 text-ink-3 text-xs">{here.length - 3} more</span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
