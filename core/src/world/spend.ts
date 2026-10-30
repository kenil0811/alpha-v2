// What each use of the model spent (core plan step 5, Kenil's yes 28 Oct): a row per model per use,
// with its tokens and its cost, and what it served (a desk turn, an agent's run, a small ask).
// Claude Code says a cost itself, at API prices; an API key's own loop says only tokens, priced
// here from models.yaml. Counted from the day it shipped (his call 1): nothing is worked out from
// before. Nothing is capped: this only says what was spent.
import { config } from '../config.ts'
import { all, type Db, now, run } from './db.ts'

export interface Use {
  model: string
  input: number
  output: number
  cacheRead: number
  cacheWrite: number
  usd: number | null // null: no price for the model
  how: 'reported' | 'priced' | 'unpriced'
}

export interface SpendFor {
  kind: 'turn' | 'run' | 'ask'
  turn?: string | null
  run?: string | null
  module?: string | null
  agent?: string | null
}

export interface SpendRow {
  at: string
  kind: SpendFor['kind']
  turn: string | null
  run: string | null
  module_id: string | null
  agent: string | null
  model: string
  input: number
  output: number
  cache_read: number
  cache_write: number
  usd: number | null
  how: Use['how']
}

const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0)

// A model's tokens priced from the table; no price, no cost.
export function priced(
  model: string,
  t: Pick<Use, 'input' | 'output' | 'cacheRead' | 'cacheWrite'>,
): Use {
  const p = config.models().prices?.[model]
  const usd = p
    ? (t.input * p.input +
        t.output * p.output +
        t.cacheRead * p.cache_read +
        t.cacheWrite * p.cache_write) /
      1_000_000
    : null
  return { model, ...t, usd, how: p ? 'priced' : 'unpriced' }
}

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

// What the API says one call used, in tokens only: priced from the table.
export function usesOfTokens(model: string, usage: unknown): Use[] {
  const u = (usage ?? {}) as Record<string, unknown>
  const t = {
    input: n(u.input_tokens),
    output: n(u.output_tokens),
    cacheRead: n(u.cache_read_input_tokens),
    cacheWrite: n(u.cache_creation_input_tokens),
  }
  return t.input + t.output + t.cacheRead + t.cacheWrite ? [priced(model, t)] : []
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
        `INSERT INTO spend (at, kind, turn, run, module_id, agent, model, input, output, cache_read,
          cache_write, usd, how) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        at,
        what.kind,
        what.turn ?? null,
        what.run ?? null,
        what.module ?? null,
        what.agent ?? null,
        u.model,
        u.input,
        u.output,
        u.cacheRead,
        u.cacheWrite,
        u.usd,
        u.how,
      )
  }

  // A month's rows (YYYY-MM), and the months there are, newest first.
  month(month: string): SpendRow[] {
    return all<SpendRow>(
      this.db,
      'SELECT * FROM spend WHERE substr(at, 1, 7) = ? ORDER BY id',
      month,
    )
  }

  months(): string[] {
    return all<{ m: string }>(
      this.db,
      'SELECT DISTINCT substr(at, 1, 7) AS m FROM spend ORDER BY m DESC',
    ).map((r) => r.m)
  }

  // What each agent's runs spent since a time, by agent id: its Cost on the Agents list and its
  // page (Vikas, 28 Oct). The same rows Usage sums, never a second store.
  byAgentSince(since: string): Record<string, number> {
    return Object.fromEntries(
      all<{ agent: string; usd: number }>(
        this.db,
        `SELECT r.agent_id AS agent, SUM(s.usd) AS usd FROM spend s JOIN runs r ON r.id = s.run
         WHERE s.at >= ? AND r.agent_id IS NOT NULL AND s.usd IS NOT NULL GROUP BY r.agent_id`,
        since,
      ).map((r) => [r.agent, r.usd]),
    )
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
