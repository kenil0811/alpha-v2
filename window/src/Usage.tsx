// What the model was used for and what it cost, a month at a time, at the top of Settings › Model:
// the month's figures, then one chart card split by a choice (its Table look holds the numbers). On the subscription the cost is
// what it would be on an API key, and says so.
import type { UsageView } from '@alpha/core/usage'
import { useEffect, useState } from 'react'
import { api } from './api.ts'
import { Figures, SpendChart } from './SpendChart.tsx'
import { money } from './table/values.ts'
import { Info } from './ui/info.tsx'
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

const plural = (n: number, one: string, many = `${one}s`) =>
  `${n.toLocaleString()} ${n === 1 ? one : many}`

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
        <Empty>Nothing used yet.</Empty>
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
              {u.atApiPrices && (
                <Info help="Your Claude subscription doesn't charge per reply: this is what the same use would cost paid by use." />
              )}
              <span className="text-ink-3 text-md">
                {[u.atApiPrices ? 'at API prices' : '', plural(u.total.tokens, 'token')]
                  .filter(Boolean)
                  .join(' · ')}
              </span>
            </div>
            <Figures u={u} />
            <SpendChart u={u} names={MODEL_NAMES} />
          </div>
        )
      )}
    </Section>
  )
}
