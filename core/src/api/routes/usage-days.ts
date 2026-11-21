// A month's spend day by day, each day split every way: what the chart at the top of
// Settings › Model stacks. Only priced rows count; an unpriced one has no dollars.
import { dayOf } from '../../world/day.ts'
import type { SpendRow } from '../../world/spend.ts'
import { SPLITS, type UsageDay, type UsageSplit } from '../usage-types.ts'

export function daysOf(
  rows: SpendRow[],
  keysOf: (r: SpendRow) => Record<UsageSplit, string>,
): UsageDay[] {
  const days = new Map<string, UsageDay>()
  for (const r of rows) {
    if (r.usd === null) continue
    const day = dayOf(new Date(r.at))
    const d =
      days.get(day) ??
      ({
        day,
        usd: 0,
        split: Object.fromEntries(SPLITS.map((s) => [s, {}])) as UsageDay['split'],
      } satisfies UsageDay)
    days.set(day, d)
    d.usd += r.usd
    const keys = keysOf(r)
    for (const k of SPLITS) d.split[k][keys[k]] = (d.split[k][keys[k]] ?? 0) + r.usd
  }
  return [...days.values()].sort((a, b) => a.day.localeCompare(b.day))
}
