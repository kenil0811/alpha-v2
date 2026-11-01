// The timeline: each row on a line, marked on the view's date, along months that scroll sideways;
// the name column stays. Rows come in date order. A row opens whole.
import type { FieldView, RowView } from '@alpha/core/api'
import { useMemo } from 'react'
import { cn } from '../../ui/cn.ts'
import { numberOf } from '../engine.ts'
import { DOT, titleOf } from '../values.ts'

const DAY = 86_400_000
const PER_DAY = 6 // px

export function TimelineView({
  rows,
  fields,
  by,
  onOpen,
}: {
  rows: RowView[]
  fields: FieldView[]
  by: FieldView
  onOpen: (id: string) => void
}) {
  const dated = useMemo(
    () =>
      rows
        .flatMap((r) => {
          const t = numberOf(by, r.values[by.slug])
          return t === null ? [] : [{ row: r, at: t }]
        })
        .sort((a, b) => a.at - b.at),
    [rows, by],
  )
  const lo = new Date(dated[0]?.at ?? Date.now())
  const start = new Date(lo.getFullYear(), lo.getMonth(), 1).getTime()
  const hi = new Date(dated.at(-1)?.at ?? Date.now())
  const end = new Date(hi.getFullYear(), hi.getMonth() + 1, 1).getTime()
  const width = Math.max(600, ((end - start) / DAY) * PER_DAY)
  const months: { at: number; label: string }[] = []
  for (let d = new Date(start); d.getTime() < end; d.setMonth(d.getMonth() + 1))
    months.push({
      at: d.getTime(),
      label: d.toLocaleDateString(undefined, { month: 'short', year: 'numeric' }),
    })
  const x = (t: number) => ((t - start) / DAY) * PER_DAY
  const now = Date.now()
  const colour = fields.find((f) => f.kind === 'choice' && Object.keys(f.tones).length)
  return (
    <div className="mx-7 mb-6 min-h-0 flex-1 overflow-auto rounded-lg border border-line bg-surface">
      <div className="relative" style={{ width: 260 + width }}>
        <div className="sticky top-0 z-2 flex h-9 border-line border-b bg-surface text-ink-3 text-sm">
          <div className="sticky left-0 z-3 w-65 shrink-0 border-hair border-r bg-surface px-3 py-2 font-medium">
            {rows.length - dated.length > 0
              ? `${dated.length} by ${by.name} · ${rows.length - dated.length} with none`
              : `By ${by.name}`}
          </div>
          <div className="relative shrink-0" style={{ width }}>
            {months.map((m) => (
              <span
                key={m.at}
                className="absolute top-0 h-9 border-hair border-l px-2 py-2"
                style={{ left: x(m.at) }}
              >
                {m.label}
              </span>
            ))}
          </div>
        </div>
        {now >= start && now <= end && (
          <div
            className="pointer-events-none absolute top-9 bottom-0 z-0 w-px bg-accent"
            style={{ left: 260 + x(now) }}
            title="Today"
          />
        )}
        {dated.map(({ row, at }) => {
          const tone = colour ? colour.tones[String(row.values[colour.slug] ?? '')] : undefined
          return (
            <div key={row.id} className="flex h-9.5 border-hair border-b">
              <button
                type="button"
                onClick={() => onOpen(row.id)}
                className="sticky left-0 z-1 w-65 shrink-0 truncate border-hair border-r bg-surface px-3 text-left text-ink text-md hover:bg-hover"
              >
                {titleOf(fields, row)}
              </button>
              <div className="relative shrink-0" style={{ width }}>
                <button
                  type="button"
                  onClick={() => onOpen(row.id)}
                  title={new Date(at).toLocaleDateString()}
                  className="absolute top-1/2 flex -translate-y-1/2 items-center gap-1.5 whitespace-nowrap text-ink-2 text-sm"
                  style={{ left: x(at) - 5 }}
                >
                  <span
                    className={cn(
                      'size-2.5 rounded-full ring-2 ring-surface',
                      tone ? DOT[tone] : 'bg-accent',
                    )}
                  />
                  {new Date(at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
