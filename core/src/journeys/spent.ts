// What a journey's world spent, from its spend rows: Claude Code's own reported cost.
import { all } from '../world/db.ts'
import type { World } from '../world/world.ts'

// What the world spent so far, by model, and in dollars when every row has a price.
interface ByModel {
  model: string
  input: number
  output: number
  cache_read: number
  cache_write: number
  usd: number | null
  unpriced: number
}

export function spentIn(world: World): { words: string; usd: number | null } {
  const rows = all<ByModel>(
    world.db,
    `SELECT model, sum(input) AS input, sum(output) AS output, sum(cache_read) AS cache_read,
       sum(cache_write) AS cache_write, sum(usd) AS usd, count(*) - count(usd) AS unpriced
     FROM spend GROUP BY model ORDER BY min(id)`,
  )
  if (!rows.length) return { words: 'nothing yet', usd: 0 }
  const usd = rows.some((r) => r.unpriced > 0) ? null : rows.reduce((s, r) => s + (r.usd ?? 0), 0)
  const words = rows
    .map(
      (r) =>
        `${r.model}: in ${r.input + r.cache_read + r.cache_write} (cache read ${r.cache_read}), out ${r.output}`,
    )
    .join('; ')
  return { words: `${words}; ${usd === null ? 'some of it unpriced' : `$${usd.toFixed(2)}`}`, usd }
}
