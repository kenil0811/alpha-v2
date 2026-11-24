// What Settings › Usage shows of a month's spend: its total, then split every way, largest first;
// each split counts every row, so each adds up to the total (by person, the owner's alone: a member
// sees their own line and everyone else's together). Its own file, beside the window's contract in
// types.ts, which is kept from growing.
export interface UsageRow {
  name: string
  turns: number // desk turns
  runs: number // schedules' runs
  tokens: number // in, out and from cache
  usd: number | null // null: some of it has no price
}

export const SPLITS = ['day', 'model', 'module', 'agent', 'schedule', 'use', 'person'] as const
export type UsageSplit = (typeof SPLITS)[number]

// One day's spend in dollars (priced rows only), whole and split each way by key
export interface UsageDay {
  day: string // YYYY-MM-DD, the person's day
  usd: number
  split: Record<UsageSplit, Record<string, number>>
}

export interface UsageView {
  month: string // YYYY-MM
  months: string[] // the months with spend, newest first
  atApiPrices: boolean // on the subscription: what it would cost on an API key
  total: UsageRow
  by: Record<UsageSplit, UsageRow[]>
  days: UsageDay[] // the days with spend, oldest first
}
