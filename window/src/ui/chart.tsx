// The window's one way of drawing a chart: bars, columns over time, a donut, the key under them and
// the same numbers as a table. A table's Chart view and the spend card on Settings › Usage both draw
// with these, so the two never drift apart. Each part has one colour, kept across the looks: the
// page's option colours, which a choice wears by its place too (ui-rules T17) and which hold in
// dark mode.
import type { ReactNode } from 'react'
import { cn } from './cn.ts'

const FILL = ['opt-1', 'opt-2', 'opt-3', 'opt-4', 'opt-5', 'opt-6', 'opt-7', 'opt-8']
export const fill = (i: number) => `var(--${FILL[i % FILL.length]})`

export interface Part {
  label: string
  value: number
  note?: string // what else it counts, after the value in its key: "205,100 tokens"
}

// A bar for each part, as long as its value, its words at the right. With onPick each bar is a
// button (a table's: show these rows); one colour for all (the accent) or each its own.
export function Bars({
  parts,
  fmt,
  onPick,
  pickTip,
  colours = 'parts',
}: {
  parts: Part[]
  fmt: (n: number) => string
  onPick?: ((i: number) => void) | undefined
  pickTip?: string | undefined
  colours?: 'parts' | 'accent'
}) {
  const top = Math.max(1e-9, ...parts.map((p) => p.value))
  return (
    <div className="flex flex-col gap-1.5">
      {parts.map((p, i) => {
        const inner = (
          <>
            <span className="truncate text-ink-2">{p.label}</span>
            <span className="h-4.5 overflow-hidden rounded-sm bg-sunk">
              <span
                className="block h-full rounded-sm"
                style={{
                  width: `${(p.value / top) * 100}%`,
                  minWidth: p.value ? 2 : 0,
                  background: colours === 'accent' ? 'var(--accent)' : fill(i),
                }}
              />
            </span>
            <span className="text-right text-ink tabular-nums">
              {fmt(p.value)}
              {p.note && <span className="text-ink-3"> · {p.note}</span>}
            </span>
          </>
        )
        const row =
          'grid grid-cols-[minmax(6rem,10rem)_1fr_auto] items-center gap-3 rounded-sm px-1 py-0.5 text-left text-md'
        return onPick ? (
          <button
            key={p.label || i}
            type="button"
            onClick={() => onPick(i)}
            data-tip={pickTip}
            className={cn(row, 'hover:bg-hover')}
          >
            {inner}
          </button>
        ) : (
          <div key={p.label || i} className={row}>
            {inner}
          </div>
        )
      })}
    </div>
  )
}

export function Columns({ columns }: { columns: { at: string; tip: string; values: number[] }[] }) {
  const top = Math.max(1e-9, ...columns.map((c) => c.values.reduce((a, v) => a + v, 0)))
  return (
    <div>
      <div className="flex h-40 items-end gap-0.5 border-line border-b">
        {columns.map((c) => (
          <div key={c.at} className="flex h-full min-w-0 flex-1 flex-col-reverse" data-tip={c.tip}>
            {c.values.map((v, i) =>
              v > 0 ? (
                <span
                  // biome-ignore lint/suspicious/noArrayIndexKey: a part's place is its identity
                  key={i}
                  className="block w-full"
                  style={{ height: `${(v / top) * 100}%`, minHeight: 1, background: fill(i) }}
                />
              ) : null,
            )}
          </div>
        ))}
      </div>
      <div className="flex justify-between pt-1 text-ink-3 text-sm tabular-nums">
        <span>{columns[0]?.at}</span>
        <span>{columns.at(-1)?.at}</span>
      </div>
    </div>
  )
}

export function Donut({ parts }: { parts: Part[] }) {
  const total = parts.reduce((a, p) => a + Math.max(0, p.value), 0) || 1
  let at = 0
  // one circle per part, its dash the part's share: no arcs to work out
  return (
    <svg viewBox="0 0 42 42" className="mx-auto size-40" role="img" aria-label="Donut chart">
      {parts.map((p, i) => {
        const share = (Math.max(0, p.value) / total) * 100
        const c = (
          <circle
            key={p.label}
            cx="21"
            cy="21"
            r="15.915"
            fill="none"
            strokeWidth="6"
            stroke={fill(i)}
            strokeDasharray={`${share} ${100 - share}`}
            strokeDashoffset={25 - at}
          >
            <title>{p.label}</title>
          </circle>
        )
        at += share
        return c
      })}
    </svg>
  )
}

export function Key({ parts, fmt }: { parts: Part[]; fmt: (n: number) => string }) {
  return (
    <div className="flex flex-wrap gap-x-5 gap-y-1 text-ink-2 text-md">
      {parts.map((p, i) => (
        <span key={p.label} className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm" style={{ background: fill(i) }} />
          {p.label}
          <span className="text-ink tabular-nums">{fmt(p.value)}</span>
          {p.note && <span className="text-ink-3 tabular-nums">{p.note}</span>}
        </span>
      ))}
    </div>
  )
}

export function ChartTable({
  head,
  rows,
}: {
  head: string[]
  rows: { key: string; cells: ReactNode[] }[]
}) {
  return (
    <table className="w-full border-collapse text-md">
      <thead>
        <tr className="text-left text-ink-3 text-sm">
          {head.map((h, i) => (
            <th
              key={h}
              className={cn('border-line border-b py-1 pr-3 font-normal', i > 0 && 'text-right')}
            >
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="tabular-nums">
        {rows.map((r) => (
          <tr key={r.key}>
            {r.cells.map((c, i) => (
              <td
                // biome-ignore lint/suspicious/noArrayIndexKey: a cell's place is its column
                key={i}
                className={cn(
                  'whitespace-nowrap border-hair border-b py-1.5 pr-3',
                  i > 0 ? 'text-right text-ink-2' : 'text-ink',
                )}
              >
                {c}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
