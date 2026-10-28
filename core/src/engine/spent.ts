// What a desk turn spent (core plan step 5): Claude Code says a desk session's running total, by
// model with its cost, so a turn's own share is that total less the one its session said at the
// turn before; an API key's own loop says one turn's tokens, priced from models.yaml.
import { config } from '../config.ts'
import { one } from '../world/db.ts'
import { shareOf, type Use, usesOfModelUsage, usesOfTokens } from '../world/spend.ts'
import type { World } from '../world/world.ts'

export function turnSpent(world: World, user: string, data: Record<string, unknown>): Use[] {
  const usage = data.usage
  if (!usage || typeof usage !== 'object') return []
  const values = Object.values(usage as Record<string, unknown>)
  // the own loop's: one turn's tokens, summed over its rounds
  if (values.every((v) => typeof v === 'number')) return usesOfTokens(config.models().desk, usage)
  return shareOf(usesOfModelUsage(usage), before(world, user))
}

// The running total the session said at its last turn: the newest reply since it started.
function before(world: World, user: string): Use[] {
  const last = one<{ data: string }>(
    world.db,
    `SELECT data FROM journal WHERE kind IN ('replied', 'error') AND user_id = ?
       AND at >= coalesce((SELECT started_at FROM desk_sessions WHERE user_id = ?), '')
     ORDER BY id DESC LIMIT 1`,
    user,
    user,
  )
  if (!last) return []
  try {
    return usesOfModelUsage((JSON.parse(last.data) as { usage?: unknown }).usage)
  } catch {
    return []
  }
}

// What the uses cost in all, when every one has a price.
export function costOf(uses: Use[]): number | null {
  return uses.length && uses.every((u) => u.usd !== null)
    ? uses.reduce((s, u) => s + (u.usd ?? 0), 0)
    : null
}
