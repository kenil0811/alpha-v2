// An agent's post said again unchanged (Vikas, 30 Oct: Dell's "Lead aging" posted "5 unassigned
// leads not yet called after 4 hours" every hour): the journal keeps every saying, append-only,
// and the stream shows the post once, at the time it was last said.
import { one, parse } from '../../world/db.ts'
import type { Line } from '../../world/journal.ts'
import type { World } from '../../world/world.ts'

export const TOLD_AGAIN = 'told_again'

export function lastTold(
  world: World,
  agent: string,
): { id: number; words: string; data: { about?: unknown } } | undefined {
  const r = one<{ id: number; words: string; data: string }>(
    world.db,
    "SELECT id, words, data FROM journal WHERE kind = 'told' AND json_extract(data, '$.agent') = ? ORDER BY id DESC LIMIT 1",
    agent,
  )
  return r ? { id: r.id, words: r.words, data: parse(r.data, {}) } : undefined
}

export const sameJson = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

// The stream's lines with each agent's unchanged repeats folded into its first post, which takes
// the time of the last. A repeat whose post is not among the lines stands for it.
export function foldTold(lines: Line[]): Line[] {
  const kept: Line[] = []
  const last = new Map<string, number>() // an agent's last post: its place in `kept`
  for (const l of lines) {
    if (l.kind !== 'told' && l.kind !== TOLD_AGAIN) {
      kept.push(l)
      continue
    }
    const agent = String(l.data.agent ?? '')
    const at = last.get(agent)
    const prev = at === undefined ? undefined : kept[at]
    const same =
      prev && prev.words === l.words && sameJson(prev.data.about ?? null, l.data.about ?? null)
    if (prev && at !== undefined && same) {
      kept[at] = { ...prev, at: l.at }
      continue
    }
    last.set(agent, kept.length)
    kept.push(l.kind === TOLD_AGAIN ? { ...l, kind: 'told' } : l)
  }
  return kept
}
