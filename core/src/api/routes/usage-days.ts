// A month's spend day by day, each day split by model, module, agent, use and person: what the
// chart at the top of Settings › Model stacks. Only priced rows count; an unpriced one has no dollars.
import { dayOf } from '../../world/day.ts'
import type { SpendRow } from '../../world/spend.ts'
import type { UsageDay, UsageSplit } from '../usage-types.ts'

const USE = { turn: 'Chat turns', run: 'Schedule runs', ask: 'Asks' }

export function daysOf(
  rows: SpendRow[],
  by: Record<'module' | 'agent' | 'person', (r: SpendRow) => string>,
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
        split: { model: {}, module: {}, agent: {}, use: {}, person: {} },
      } satisfies UsageDay)
    days.set(day, d)
    d.usd += r.usd
    const keys: Record<UsageSplit, string> = {
      model: r.model,
      module: by.module(r),
      agent: r.kind === 'turn' ? by.agent(r) : 'Not a chat turn',
      use: USE[r.kind],
      person: by.person(r),
    }
    for (const k of Object.keys(keys) as UsageSplit[])
      d.split[k][keys[k]] = (d.split[k][keys[k]] ?? 0) + r.usd
  }
  return [...days.values()].sort((a, b) => a.day.localeCompare(b.day))
}
