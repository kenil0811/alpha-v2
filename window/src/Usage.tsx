// What the model was used for and what it cost, a month at a time (core plan step 5, Kenil's yes
// 28 Oct): Settings › Usage: the month's total, then by module, by schedule and by model,
// largest first. On the subscription the cost is what it would be on an API key, and says so.
import type { UsageRow, UsageView } from '@alpha/core/usage'
import { useEffect, useState } from 'react'
import { api } from './api.ts'
import { money } from './table/values.ts'
import { Empty, Section } from './ui/section.tsx'
import { Segmented } from './ui/segmented.tsx'

// The models by their names, never their ids (W6)
export const MODEL_NAMES: Record<string, string> = {
  'claude-opus-5-5': 'Claude Opus 5.5',
  'claude-sonnet-5-5': 'Claude Sonnet 5.5',
  'claude-haiku-5-5': 'Claude Haiku 5.5',
}

export const usdWords = (v: number | null) =>
  v === null ? 'Unknown' : v > 0 && v < 0.01 ? 'Under $0.01' : money(v, 'USD')

const monthName = (m: string) =>
  new Date(`${m}-01T12:00:00`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })

const plural = (n: number, one: string) => `${n.toLocaleString()} ${one}${n === 1 ? '' : 's'}`

export function UsageSection() {
  const [month, setMonth] = useState<string | null>(null)
  const [u, setU] = useState<UsageView | null>(null)
  useEffect(() => {
    api.get<UsageView>(`/api/usage${month ? `?month=${month}` : ''}`).then(setU, () => setU(null))
  }, [month])
  return (
    <Section
      title="Usage"
      about="What each use of the model cost: Alpha's turns under the module they were asked in, schedules' runs under their schedule. Counted from 28 Oct 2026."
    >
      {u && !u.months.length ? (
        <Empty>Nothing used yet. Each turn and each schedule's use of the model shows here.</Empty>
      ) : (
        u && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              {u.months.length > 1 ? (
                <Segmented
                  label="Month"
                  value={u.month}
                  options={u.months.slice(0, 12).map((m) => ({ value: m, label: monthName(m) }))}
                  onChange={setMonth}
                />
              ) : (
                <span className="text-ink text-md">{monthName(u.month)}</span>
              )}
              <span className="font-medium text-ink text-lg tabular-nums">
                {usdWords(u.total.usd)}
              </span>
              <span className="text-ink-3 text-md">
                {[
                  u.atApiPrices ? 'at API prices' : '',
                  plural(u.total.turns, 'turn'),
                  plural(u.total.runs, 'run'),
                  plural(u.total.tokens, 'token'),
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </span>
            </div>
            {u.atApiPrices && (
              <p className="text-ink-3 text-sm">
                Your Claude subscription bills nothing per turn: this is what the same use would
                cost on an API key.
              </p>
            )}
            <UsageTable title="By module" rows={u.byModule} />
            {u.bySchedule.length > 0 && <UsageTable title="By schedule" rows={u.bySchedule} />}
            <UsageTable
              title="By model"
              rows={u.byModel.map((r) => ({ ...r, name: MODEL_NAMES[r.name] ?? r.name }))}
            />
          </div>
        )
      )}
    </Section>
  )
}

function UsageTable({ title, rows }: { title: string; rows: UsageRow[] }) {
  return (
    <table className="w-full table-fixed border-collapse text-md">
      <thead>
        <tr className="text-left text-ink-3 text-sm">
          <th className="border-line border-b py-1 pr-3 font-normal">{title}</th>
          <th className="w-20 border-line border-b py-1 pr-3 text-right font-normal">Turns</th>
          <th className="w-20 border-line border-b py-1 pr-3 text-right font-normal">Runs</th>
          <th className="w-32 border-line border-b py-1 pr-3 text-right font-normal">Tokens</th>
          <th className="w-28 border-line border-b py-1 text-right font-normal">Cost</th>
        </tr>
      </thead>
      <tbody className="tabular-nums">
        {rows.map((r) => (
          <tr key={r.name}>
            <td className="truncate border-hair border-b py-1.5 pr-3 text-ink" title={r.name}>
              {r.name}
            </td>
            <td className="border-hair border-b py-1.5 pr-3 text-right text-ink-2">
              {r.turns || '–'}
            </td>
            <td className="border-hair border-b py-1.5 pr-3 text-right text-ink-2">
              {r.runs || '–'}
            </td>
            <td className="border-hair border-b py-1.5 pr-3 text-right text-ink-2">
              {r.tokens.toLocaleString()}
            </td>
            <td className="border-hair border-b py-1.5 text-right text-ink">{usdWords(r.usd)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
