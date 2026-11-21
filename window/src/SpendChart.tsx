// The top of Settings › Model: the month's figures, then one chart card of its spend, split by a
// choice and drawn as columns by day, bars, a donut or a table.
import type { UsageSplit, UsageView } from '@alpha/core/usage'
import { useState } from 'react'
import { forecast, stack } from './spend-words.ts'
import { money } from './table/values.ts'
import { ChartCard } from './ui/chart-card.tsx'
import { Select } from './ui/field.tsx'

const SPLITS: [UsageSplit, string][] = [
  ['model', 'Model'],
  ['day', 'Day'],
  ['module', 'Module'],
  ['agent', 'Agent'],
  ['schedule', 'Schedule'],
  ['use', 'Use'],
  ['person', 'Person'],
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

export function SpendChart({ u, names }: { u: UsageView; names: Record<string, string> }) {
  const [split, setSplit] = useState<UsageSplit>('model')
  const s = stack(u.month, u.days, split)
  const label = (k: string) => (split === 'model' ? (names[k] ?? k) : k)
  const rows = u.by[split]
  const rowOf = (k: string) => rows.find((r) => r.name === k)
  // a part of the stack: its spend from the rows, the rest past the top seven as Other
  const kept = new Set(s.keys)
  const other = rows.filter((r) => !kept.has(r.name))
  const parts = s.keys.map((k) => {
    const rs = k === 'Other' ? other : [rowOf(k)].filter((r) => r !== undefined)
    const tokens = rs.reduce((a, r) => a + r.tokens, 0)
    return {
      label: label(k),
      value: rs.reduce((a, r) => a + (r.usd ?? 0), 0),
      note: `${tokens.toLocaleString()} tokens`,
    }
  })
  const usd = (n: number) => money(n, 'USD')
  return (
    <ChartCard
      title="Spend"
      parts={split === 'day' ? [] : parts}
      fmt={usd}
      columns={s.days.map((d) => ({
        at: String(Number(d.day.slice(8))),
        tip: `${Number(d.day.slice(8))}: ${usd(d.parts.reduce((a, [, v]) => a + v, 0))}`,
        values: d.parts.map(([, v]) => v),
      }))}
      {...(split === 'day' && { looks: ['columns', 'table'] as const })}
      table={{
        head: [SPLITS.find(([v]) => v === split)?.[1] ?? '', 'Replies', 'Runs', 'Tokens', 'Cost'],
        rows: rows.map((r) => ({
          key: r.name,
          cells: [
            label(r.name),
            r.turns || '–',
            r.runs || '–',
            r.tokens.toLocaleString(),
            r.usd === null ? 'Unknown' : usd(r.usd),
          ],
        })),
      }}
      controls={
        <Select
          aria-label="Split by"
          value={split}
          onChange={(e) => setSplit(e.target.value as UsageSplit)}
          className="h-6.5 w-auto shrink-0 text-sm"
        >
          {SPLITS.map(([v, l]) => (
            <option key={v} value={v}>
              By {l.toLowerCase()}
            </option>
          ))}
        </Select>
      }
    />
  )
}
