// The top of Settings › Model: the month's figures, then one chart of its days, split by a choice.
import type { UsageDay, UsageSplit, UsageView } from '@alpha/core/usage'
import { useState } from 'react'
import { forecast, stack } from './spend-words.ts'
import { money } from './table/values.ts'
import { cn } from './ui/cn.ts'
import { Segmented } from './ui/segmented.tsx'

const SPLITS: [UsageSplit | 'day', string][] = [
  ['day', 'Day'],
  ['model', 'Model'],
  ['module', 'Module'],
  ['agent', 'Agent'],
  ['use', 'Use'],
  ['person', 'Person'],
]
// the page's own option colours, which hold in dark mode
const FILL = [
  'bg-opt-1',
  'bg-opt-2',
  'bg-opt-3',
  'bg-opt-4',
  'bg-opt-5',
  'bg-opt-6',
  'bg-opt-7',
  'bg-opt-8',
]

export function Figures({ u }: { u: UsageView }) {
  const spent = u.total.usd
  const f = spent === null ? null : forecast(spent, u.month)
  const per = spent !== null && u.tasksDone > 0 ? spent / u.tasksDone : null
  const cells: [string, string, string?][] = [
    ['Spent', spent === null ? 'Unknown' : money(spent, 'USD')],
    [
      'Forecast',
      f === null ? '–' : money(f, 'USD'),
      'An estimate: today’s daily rate carried to the month’s end',
    ],
    ['Replies · runs', `${u.total.turns.toLocaleString()} · ${u.total.runs.toLocaleString()}`],
    [
      'Per task done',
      per === null ? '–' : money(per, 'USD'),
      `${u.tasksDone} tasks done this month`,
    ],
  ]
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {cells.map(([label, value, tip]) => (
        <div
          key={label}
          className="rounded-lg border border-line bg-surface px-3 py-2"
          data-tip={tip}
        >
          <div className="text-ink-3 text-sm">{label}</div>
          <div className="font-medium text-ink text-lg tabular-nums">{value}</div>
        </div>
      ))}
    </div>
  )
}

export function SpendChart({
  month,
  days,
  names,
}: {
  month: string
  days: UsageDay[]
  names: Record<string, string>
}) {
  const [split, setSplit] = useState<UsageSplit | 'day'>('day')
  const s = stack(month, days, split)
  const label = (k: string) => (split === 'model' ? (names[k] ?? k) : k)
  const totalOf = (parts: [string, number][]) => parts.reduce((a, [, v]) => a + v, 0)
  const top = Math.max(0.0001, ...s.days.map((d) => totalOf(d.parts)))
  return (
    <div className="flex flex-col gap-2">
      <Segmented
        label="Split by"
        value={split}
        options={SPLITS.map(([value, l]) => ({ value, label: l }))}
        onChange={setSplit}
      />
      <div className="flex h-40 items-end gap-0.5 border-line border-b">
        {s.days.map((d) => (
          <div
            key={d.day}
            className="flex h-full min-w-0 flex-1 flex-col-reverse"
            data-tip={`${d.day.slice(8)}: ${money(totalOf(d.parts), 'USD')}`}
          >
            {d.parts.map(([k, v], i) =>
              v > 0 ? (
                <span
                  key={k}
                  className={cn('block w-full', FILL[Math.min(i, 7)])}
                  style={{ height: `${(v / top) * 100}%`, minHeight: 1 }}
                />
              ) : null,
            )}
          </div>
        ))}
      </div>
      <div className="flex justify-between text-ink-3 text-sm tabular-nums">
        <span>1</span>
        <span>{s.days.length}</span>
      </div>
      {split !== 'day' && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-ink-2 text-md">
          {s.keys.map((k, i) => (
            <span key={k} className="inline-flex items-center gap-1.5">
              <span className={cn('size-2.5 rounded-sm', FILL[Math.min(i, 7)])} />
              {label(k)}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
