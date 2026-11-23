// The chart: a bar for each of the view's groups (a choice in its order), or for each month of its
// date, as long as the rows it holds or the sum of a number, drawn with the window's one chart
// pieces (ui/chart.tsx). A bar's click shows those rows in the table.
import type { FieldView, RowView } from '@alpha/core/api'
import { Bars } from '../../ui/chart.tsx'
import { Frame } from '../../ui/frame.tsx'
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
  // a view writes no words over its rows (T5): with nothing to go by, an empty chart
  if (!axis) return <div className="min-h-0 flex-1" />
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
  const values = all.map((g) => amountOf(g.rows))
  const sum = values.reduce((a, b) => a + b, 0)
  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-4">
      <Frame className="max-w-stream">
        <div className="mb-4 flex items-baseline gap-3">
          <h2 className="font-medium font-serif text-ink text-xl">
            {measure ? `${measure.name} by ${axis.name}` : `Rows by ${axis.name}`}
          </h2>
          <span className="text-ink-3 text-sm">
            {measure ? `${words(sum)} in all` : `${sum} row${sum === 1 ? '' : 's'}`}
          </span>
        </div>
        <Bars
          parts={all.map((g, i) => ({ label: g.label, value: values[i] ?? 0 }))}
          fmt={words}
          onPick={(i) => onBar(axis, all[i]?.key ?? '')}
          pickTip="Show these rows in the table"
          // a choice's bars wear its choices' colours; months and others the accent
          colours={axis.kind === 'choice' ? 'parts' : 'accent'}
        />
      </Frame>
    </div>
  )
}
