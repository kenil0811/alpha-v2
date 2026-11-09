// What the model was used for and what it spent, a month at a time (core plan step 5): desk turns
// under the module they were asked in (Alpha's, asked on Home), schedules' runs under their schedule.
import { z } from 'zod'
import { monthOf } from '../../world/day.ts'
import type { SpendRow } from '../../world/spend.ts'
import type { Ctx } from '../ctx.ts'
import type { UsageRow, UsageView } from '../usage-types.ts'

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
    const moduleName = (id: string | null) => (id && world.shape.module(id)?.name) || 'Alpha'
    return {
      month: m,
      months,
      atApiPrices: (engine.route?.name ?? 'subscription') === 'subscription',
      total: sumOf('All', rows),
      byModule: grouped(rows, (r) => moduleName(r.module_id)),
      bySchedule: grouped(
        rows.filter((r) => r.schedule),
        (r) => r.schedule as string,
      ),
      byModel: grouped(rows, (r) => r.model),
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
