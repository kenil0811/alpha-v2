// What each use of the model spent (core plan step 5, Kenil's yes 28 Oct): a row per model per use,
// with its tokens and its cost, and what it served (a desk turn, a schedule's run, a small ask).
// Claude Code says a cost itself, at API prices; a session says running totals, so a turn's own
// share is the total now less the total before. Nothing is capped: this only says what was spent.
import { monthOf, monthSpan } from './day.ts'
import { all, type Db, now, run } from './db.ts'

export interface Use {
  model: string
  input: number
  output: number
  cacheRead: number
  cacheWrite: number
  usd: number | null // null: no price for the model
  how: 'reported' | 'unpriced'
}

export interface SpendFor {
  kind: 'turn' | 'run' | 'ask'
  turn?: string | null
  run?: string | null
  module?: string | null
  schedule?: string | null
  agent?: string | null
}

export interface SpendRow {
  at: string
  kind: SpendFor['kind']
  turn: string | null
  run: string | null
  module_id: string | null
  schedule: string | null
  model: string
  input: number
  output: number
  cache_read: number
  cache_write: number
  usd: number | null
  how: Use['how']
  agent: string | null
}

const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0)

// What the Agent SDK says a query used, by model, with the cost it says itself (Claude Code's
// modelUsage: a desk session's running total, or one ask's own).
export function usesOfModelUsage(map: unknown): Use[] {
  if (!map || typeof map !== 'object') return []
  return Object.entries(map as Record<string, Record<string, unknown>>)
    .filter(([, u]) => u && typeof u === 'object')
    .map(([model, u]) => ({
      model,
      input: n(u.inputTokens),
      output: n(u.outputTokens),
      cacheRead: n(u.cacheReadInputTokens),
      cacheWrite: n(u.cacheCreationInputTokens),
      usd: typeof u.costUSD === 'number' ? u.costUSD : null,
      how: typeof u.costUSD === 'number' ? 'reported' : 'unpriced',
    }))
}

// A desk turn's own share of a session's running totals: now less before, by model; a model
// whose total went down started again (a new session), so all of its now is this turn's.
export function shareOf(nowUses: Use[], before: Use[]): Use[] {
  return nowUses
    .map((u) => {
      const b = before.find((x) => x.model === u.model)
      if (!b || u.input + u.output + u.cacheRead + u.cacheWrite < sum(b)) return u
      return {
        ...u,
        input: u.input - b.input,
        output: u.output - b.output,
        cacheRead: u.cacheRead - b.cacheRead,
        cacheWrite: u.cacheWrite - b.cacheWrite,
        usd: u.usd === null || b.usd === null ? u.usd : Math.max(0, u.usd - b.usd),
      }
    })
    .filter((u) => sum(u) > 0)
}

const sum = (u: Use) => u.input + u.output + u.cacheRead + u.cacheWrite

export class Spend {
  private db: Db

  constructor(db: Db) {
    this.db = db
  }

  add(what: SpendFor, uses: Use[]): void {
    const at = now()
    for (const u of uses)
      run(
        this.db,
        `INSERT INTO spend (at, kind, turn, run, module_id, schedule, model, input, output, cache_read,
          cache_write, usd, how, agent) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        at,
        what.kind,
        what.turn ?? null,
        what.run ?? null,
        what.module ?? null,
        what.schedule ?? null,
        u.model,
        u.input,
        u.output,
        u.cacheRead,
        u.cacheWrite,
        u.usd,
        u.how,
        what.agent ?? null,
      )
  }

  // A month's rows (YYYY-MM), and the months there are, newest first.
  // the person's month, not UTC's (Batch A, pick 4): from its first instant to the next's
  month(month: string): SpendRow[] {
    const [from, to] = monthSpan(month)
    return all<SpendRow>(
      this.db,
      'SELECT * FROM spend WHERE at >= ? AND at < ? ORDER BY id',
      from.toISOString(),
      to.toISOString(),
    )
  }

  // the months that have spend, newest first: each UTC hour's first and last row says which of
  // the person's months it touched (a month starts on an hour or a half hour)
  months(): string[] {
    const ats = all<{ at: string }>(
      this.db,
      `SELECT at FROM spend WHERE id IN (SELECT min(id) FROM spend GROUP BY substr(at, 1, 13)
         UNION SELECT max(id) FROM spend GROUP BY substr(at, 1, 13))`,
    )
    return [...new Set(ats.map((r) => monthOf(new Date(r.at))))].sort().reverse()
  }

  // What one turn or one run spent, for its line in Activity.
  of(what: { turn: string } | { run: string }): number | null {
    const rows = all<{ usd: number | null }>(
      this.db,
      'turn' in what
        ? 'SELECT usd FROM spend WHERE turn = ?'
        : 'SELECT usd FROM spend WHERE run = ?',
      'turn' in what ? what.turn : what.run,
    )
    return rows.length && rows.every((r) => r.usd !== null)
      ? rows.reduce((s, r) => s + (r.usd ?? 0), 0)
      : null
  }
}
