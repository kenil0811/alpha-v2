// One card for every visual (Vikas, 21 Nov, the Overview's chart card of 27 Oct brought back): a
// title, the card's own controls, and a drop-down that draws the same numbers as columns over
// time, bars, a donut or a table. Each part has one colour, kept across the looks, and a key under
// the drawing saying its value. Every chart and report draws through this card unless the person
// asks for something else (docs/ui-rules.md).
import type { ReactNode } from 'react'
import { useState } from 'react'
import { cn } from './cn.ts'
import { Select } from './field.tsx'

export type Look = 'columns' | 'bars' | 'donut' | 'table'
const LOOK_WORDS: Record<Look, string> = {
  columns: 'Columns',
  bars: 'Bars',
  donut: 'Donut',
  table: 'Table',
}

// the page's own option colours, which hold in dark mode
const FILL = ['opt-1', 'opt-2', 'opt-3', 'opt-4', 'opt-5', 'opt-6', 'opt-7', 'opt-8']
const fill = (i: number) => `var(--${FILL[Math.min(i, FILL.length - 1)]})`

export interface Part {
  label: string
  value: number
  note?: string // what else it counts, after the value in its key: "205,100 tokens"
}

export function ChartCard({
  title,
  parts,
  fmt,
  columns,
  table,
  controls,
  looks = ['columns', 'bars', 'donut', 'table'],
}: {
  title: string
  parts: Part[] // in colour order
  fmt: (n: number) => string
  columns?: { at: string; tip: string; values: number[] }[] // one per step in time, by part
  table: { head: string[]; rows: { key: string; cells: ReactNode[] }[] }
  controls?: ReactNode // the card's own choices, before the look
  looks?: readonly Look[]
}) {
  const offered = looks.filter((l) => l !== 'columns' || columns)
  const [look, setLook] = useState<Look>(offered[0] ?? 'table')
  const shown = offered.includes(look) ? look : (offered[0] ?? 'table')
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-3.5">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-medium text-ink text-md">{title}</h3>
        <span className="ml-auto flex flex-wrap items-center gap-2">
          {controls}
          {offered.length > 1 && (
            <Select
              aria-label="Show as"
              value={shown}
              onChange={(e) => setLook(e.target.value as Look)}
              className="h-6.5 w-auto shrink-0 text-sm"
            >
              {offered.map((l) => (
                <option key={l} value={l}>
                  {LOOK_WORDS[l]}
                </option>
              ))}
            </Select>
          )}
        </span>
      </div>
      {shown === 'table' ? (
        <Table {...table} />
      ) : (
        <>
          {shown === 'columns' && columns && <Columns columns={columns} />}
          {shown === 'bars' && <Bars parts={parts} fmt={fmt} />}
          {shown === 'donut' && <Donut parts={parts} />}
          {shown !== 'bars' && parts.length > 1 && <Key parts={parts} fmt={fmt} />}
        </>
      )}
    </div>
  )
}

function Columns({ columns }: { columns: { at: string; tip: string; values: number[] }[] }) {
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

function Bars({ parts, fmt }: { parts: Part[]; fmt: (n: number) => string }) {
  const top = Math.max(1e-9, ...parts.map((p) => p.value))
  return (
    <div className="flex flex-col gap-1.5">
      {parts.map((p, i) => (
        <div
          key={p.label}
          className="grid grid-cols-[minmax(6rem,12rem)_1fr_auto] items-center gap-2 text-md"
        >
          <span className="truncate text-ink-2">{p.label}</span>
          <span className="h-2.5">
            <span
              className="block h-full rounded-sm"
              style={{ width: `${Math.max(1.5, (p.value / top) * 100)}%`, background: fill(i) }}
            />
          </span>
          <span className="text-right text-ink tabular-nums">
            {fmt(p.value)}
            {p.note && <span className="text-ink-3"> · {p.note}</span>}
          </span>
        </div>
      ))}
    </div>
  )
}

function Donut({ parts }: { parts: Part[] }) {
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

function Key({ parts, fmt }: { parts: Part[]; fmt: (n: number) => string }) {
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

function Table({ head, rows }: { head: string[]; rows: { key: string; cells: ReactNode[] }[] }) {
  return (
    <table className="w-full border-collapse text-md">
      <thead>
        <tr className="text-left text-ink-3 text-sm">
          {head.map((h, i) => (
            <th
              key={h}
              className={cn(
                'border-line border-b py-1 pr-3 font-normal',
                i > 0 && 'text-right',
              )}
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
