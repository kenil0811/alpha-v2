// The spend card on Settings › LLM: a title, the card's own controls, and a drop-down that draws
// the same numbers as columns over time, bars, a donut or a table, with the window's one chart
// pieces (ui/chart.tsx). Each part has one colour, kept across the looks, and a key under the
// drawing saying its value (ui-rules L19).
import { type ReactNode, useState } from 'react'
import { Bars, ChartTable, Columns, Donut, Key, type Part } from './chart.tsx'
import { Select } from './field.tsx'

export type Look = 'columns' | 'bars' | 'donut' | 'table'
const LOOK_WORDS: Record<Look, string> = {
  columns: 'Columns',
  bars: 'Bars',
  donut: 'Donut',
  table: 'Table',
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
        <ChartTable {...table} />
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
