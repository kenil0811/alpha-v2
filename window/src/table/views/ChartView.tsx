// The chart: a bar for each of the view's groups (a choice in its order), or for each month of its
// date, as long as the rows it holds or the sum of a number, drawn by the one chart (ui/chart). A
// bar's click shows those rows in the table.
import type { FieldView, RowView } from '@alpha/core/api'
import { Chart } from '../../ui/chart.tsx'
import { groupRows, numberOf } from '../engine.ts'
import { money } from '../values.ts'

export function ChartView({
  rows,
  group,
  by,
  measure,
  names,
  onBar,
}: {
  rows: RowView[]
  group: FieldView | undefined
  by: FieldView | undefined
  measure: FieldView | undefined
  names: Record<string, string>
  onBar: (field: FieldView, key: string) => void
}) {
  const axis = group ?? by
  if (!axis) return <p className="px-7 text-ink-3">Choose what the bars go by.</p>
  const groups = groupRows(rows, axis, names)
  // a choice shows every choice, even with no rows, so the funnel keeps its shape
  const all =
    axis.kind === 'choice'
      ? [
          ...axis.choices.map(
            (c) => groups.find((g) => g.key === c) ?? { key: c, label: c, rows: [] },
          ),
          ...groups.filter((g) => !axis.choices.includes(g.key)),
        ]
      : groups
  const amountOf = (rs: RowView[]) =>
    measure
      ? rs.reduce((n, r) => n + (numberOf(measure, r.values[measure.slug]) ?? 0), 0)
      : rs.length
  const currency =
    measure?.kind === 'money'
      ? ((rows.find((r) => r.values[measure.slug])?.values[measure.slug] as { currency?: string })
          ?.currency ?? 'USD')
      : null
  const words = (n: number) =>
    currency ? money(n, currency, true) : Number.isInteger(n) ? n.toLocaleString() : n.toFixed(1)
  const marks = all.map((g) => ({
    label: g.label,
    n: amountOf(g.rows),
    onOpen: () => onBar(axis, g.key),
  }))
  const sum = marks.reduce((a, m) => a + m.n, 0)
  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-7 pb-6">
      <div className="flex max-w-stream flex-col gap-3">
        <div className="flex items-baseline gap-3">
          <h2 className="font-medium font-serif text-base text-ink">
            {measure ? `${measure.name} by ${axis.name}` : `Rows by ${axis.name}`}
          </h2>
          <span className="text-ink-3 text-sm">
            {measure ? `${words(sum)} in all` : `${sum} row${sum === 1 ? '' : 's'}`}
          </span>
        </div>
        <Chart kind="bar" marks={marks} fmt={words} />
      </div>
    </div>
  )
}
