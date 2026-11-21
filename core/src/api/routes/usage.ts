// What the model was used for and what it spent, a month at a time (core plan step 5). Every split
// counts every spend row, so each adds up to the month's total: a row with no agent (a schedule's
// run, a small ask) is counted under what it was, not left out.
import { z } from 'zod'
import { dayOf, monthOf, monthSpan } from '../../world/day.ts'
import type { SpendRow } from '../../world/spend.ts'
import type { Ctx } from '../ctx.ts'
import { SPLITS, type UsageRow, type UsageSplit, type UsageView } from '../usage-types.ts'
import { daysOf } from './usage-days.ts'

const USE = { turn: 'Chat turns', run: 'Schedule runs', ask: 'Small asks' }
const NO_AGENT = { run: 'Schedules (no agent)', ask: 'Small asks (no agent)' }

export function registerUsage(ctx: Ctx): void {
  const { app, world, engine } = ctx

  app.get('/api/usage', async (req): Promise<UsageView> => {
    const { month } = z
      .object({
        month: z
          .string()
          .regex(/^\d{4}-\d{2}$/)
          .optional(),
      })
      .parse(req.query)
    const months = world.spend.months()
    const m = month ?? months[0] ?? monthOf()
    const rows = world.spend.month(m)
    const people = world.users()
    const keysOf = (r: SpendRow): Record<UsageSplit, string> => ({
      day: dayOf(new Date(r.at)),
      model: r.model,
      module: (r.module_id && world.shape.module(r.module_id)?.name) || 'Alpha',
      agent:
        r.kind === 'turn'
          ? (r.agent && world.agents.get(r.agent)?.name) || 'Chief of staff'
          : NO_AGENT[r.kind],
      schedule: r.schedule ?? 'Not a schedule',
      use: USE[r.kind],
      person: people.find((u) => u.id === r.user_id)?.name ?? 'No one: schedules and asks',
    })
    return {
      month: m,
      months,
      atApiPrices: (engine.route?.name ?? 'subscription') === 'subscription',
      total: sumOf('All', rows),
      by: Object.fromEntries(SPLITS.map((s) => [s, grouped(rows, (r) => keysOf(r)[s])])) as Record<
        UsageSplit,
        UsageRow[]
      >,
      days: daysOf(rows, keysOf),
      tasksDone: world.tasks.doneBetween(...monthSpan(m)),
    }
  })
}

function grouped(rows: SpendRow[], key: (r: SpendRow) => string): UsageRow[] {
  const by = new Map<string, SpendRow[]>()
  for (const r of rows) by.set(key(r), [...(by.get(key(r)) ?? []), r])
  return [...by.entries()]
    .map(([name, rs]) => sumOf(name, rs))
    .sort((a, b) => (b.usd ?? 0) - (a.usd ?? 0) || b.tokens - a.tokens)
}

function sumOf(name: string, rows: SpendRow[]): UsageRow {
  return {
    name,
    turns: new Set(rows.filter((r) => r.kind === 'turn').map((r) => r.turn)).size,
    runs: new Set(rows.filter((r) => r.run).map((r) => r.run)).size,
    tokens: rows.reduce((s, r) => s + r.input + r.output + r.cache_read + r.cache_write, 0),
    usd: rows.some((r) => r.usd === null) ? null : rows.reduce((s, r) => s + (r.usd ?? 0), 0),
  }
}
