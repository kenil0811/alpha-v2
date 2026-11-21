// The numbers over the spend chart, worked out here from what the core counted.
import type { UsageDay, UsageSplit } from '@alpha/core/usage'

// The month's spend at today's daily rate so far: spent / days gone x days in the month.
// An estimate, and the screen says so. Null for a month that is over or not begun.
export function forecast(spent: number, month: string, today: Date = new Date()): number | null {
  const [y, m] = month.split('-').map(Number) as [number, number]
  if (today.getFullYear() !== y || today.getMonth() + 1 !== m) return null
  const inMonth = new Date(y, m, 0).getDate()
  return (spent / today.getDate()) * inMonth
}

// Every day of the month with its spend, split by a key; the keys by the month's total, the
// biggest first, the rest past `keep` joined as Other.
export function stack(
  month: string,
  days: UsageDay[],
  split: UsageSplit,
  keep = 7,
): { days: { day: string; parts: [string, number][] }[]; keys: string[] } {
  const [y, m] = month.split('-').map(Number) as [number, number]
  const inMonth = new Date(y, m, 0).getDate()
  const partsOf = (d: UsageDay | undefined): Record<string, number> =>
    !d ? {} : split === 'day' ? { Spend: d.usd } : d.split[split]
  const totals = new Map<string, number>()
  for (const d of days)
    for (const [k, v] of Object.entries(partsOf(d))) totals.set(k, (totals.get(k) ?? 0) + v)
  const ranked = [...totals.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k)
  const shown = ranked.slice(0, keep)
  const keys = ranked.length > keep ? [...shown, 'Other'] : shown
  return {
    keys,
    days: Array.from({ length: inMonth }, (_, i) => {
      const day = `${month}-${String(i + 1).padStart(2, '0')}`
      const own = partsOf(days.find((d) => d.day === day))
      const parts: [string, number][] = keys.map((k) => [
        k,
        k === 'Other'
          ? Object.entries(own)
              .filter(([n]) => !shown.includes(n))
              .reduce((s, [, v]) => s + v, 0)
          : (own[k] ?? 0),
      ])
      return { day, parts }
    }),
  }
}
