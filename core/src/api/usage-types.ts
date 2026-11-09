// What Settings › Model shows of a month's spend (core plan step 5, Kenil's yes 28 Oct): its total,
// then by module, by schedule and by model, largest first. Its own file, beside the window's contract
// in types.ts, which is kept from growing.
export interface UsageRow {
  name: string
  turns: number // desk turns
  runs: number // schedules' runs
  tokens: number // in, out and from cache
  usd: number | null // null: some of it has no price
}

export interface UsageView {
  month: string // YYYY-MM
  months: string[] // the months with spend, newest first
  atApiPrices: boolean // on the subscription: what it would cost on an API key
  total: UsageRow
  byModule: UsageRow[]
  bySchedule: UsageRow[]
  byAgent: UsageRow[]
  byModel: UsageRow[]
}
