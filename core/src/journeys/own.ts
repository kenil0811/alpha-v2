// Journeys on Alpha's own loop (step 3, part 1, Kenil's yes 30 Oct): `--loop own` runs a journey's
// desk turns and its small asks through the own loop on the person's API key, read from the secret
// store where Settings › Model keeps it, never from a file, the environment or the chat. And what
// a journey's world spent, from its spend rows: Claude Code's own reported cost, the own loop's
// tokens priced from models.yaml.
import { MemorySecrets, type SecretStore } from '@alpha/connector-sdk'
import { ClaudeApiProvider } from '../engine/claudeapi.ts'
import { KEY_REF } from '../engine/route.ts'
import { platformHere } from '../platform/index.ts'
import { all } from '../world/db.ts'
import { Refused } from '../world/kinds.ts'
import type { User, World } from '../world/world.ts'

export async function ownLoop(
  world: World,
  user: User,
  secrets: SecretStore,
): Promise<ClaudeApiProvider> {
  const key = await secrets.get(KEY_REF).catch(() => null)
  if (!key)
    throw new Refused(
      'No API key is kept in the Keychain: save one in Settings › Model first, then run the journeys on the own loop.',
    )
  return new ClaudeApiProvider(world, { key: () => key, userId: user.id })
}

// The key read once for a round, before its journeys start a few at once: the Keychain asked
// once, through Alpha's helper, and each journey given a store that holds only the key.
export async function keyOnce(): Promise<SecretStore> {
  const kept = await platformHere()
    .secrets(null)
    .store.get(KEY_REF)
    .catch(() => null)
  const store = new MemorySecrets()
  if (kept) await store.set(KEY_REF, kept)
  return store
}

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
