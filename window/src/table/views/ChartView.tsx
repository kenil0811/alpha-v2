// The chart: a bar for each of the view's groups (a choice in its order), or for each month of its
// date, as long as the rows it holds or the sum of a number. A bar's click shows those rows in the
// table. It stretches like every chart (`Stretch`): the labels down the left are its y-axis, a drag
// there heightens it; the bottom-right corner widens it too.
import type { FieldView, RowView } from '@alpha/core/api'
import { Stretch } from '../../ui/chart.tsx'
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
  const values = all.map((g) => amountOf(g.rows))
  const top = Math.max(1, ...values)
  const sum = values.reduce((a, b) => a + b, 0)
  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-7 pb-6">
      <div className="max-w-stream rounded-lg border border-line bg-surface p-5">
        <div className="mb-4 flex items-baseline gap-3">
          <h2 className="font-medium font-serif text-ink text-xl">
            {measure ? `${measure.name} by ${axis.name}` : `Rows by ${axis.name}`}
          </h2>
          <span className="text-ink-3 text-sm">
            {measure ? `${words(sum)} in all` : `${sum} row${sum === 1 ? '' : 's'}`}
          </span>
        </div>
        <Stretch least={[360, all.length * 30]} axes={{ y: 160, x: 0 }}>
          {(_, height) => (
            <div className="flex flex-col gap-1.5" style={{ minHeight: height }}>
              {all.map((g, i) => (
                <button
                  key={g.key || 'none'}
                  type="button"
                  onClick={() => onBar(axis, g.key)}
                  title={`Show these rows in the table`}
                  className="grid flex-1 grid-cols-[160px_1fr_88px] items-center gap-3 rounded-sm px-1 py-0.5 text-left text-md hover:bg-hover"
                >
                  <span className="truncate text-ink">{g.label}</span>
                  <span className="h-4.5 overflow-hidden rounded-sm bg-sunk">
                    <span
                      className="block h-full rounded-sm bg-accent"
                      style={{
                        width: `${((values[i] ?? 0) / top) * 100}%`,
                        minWidth: values[i] ? 2 : 0,
                      }}
                    />
                  </span>
                  <span className="text-right text-ink-2 tabular-nums">
                    {words(values[i] ?? 0)}
                  </span>
                </button>
              ))}
            </div>
          )}
        </Stretch>
      </div>
    </div>
  )
}
