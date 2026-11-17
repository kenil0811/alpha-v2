// What marks an agent in the Agents list for one person: the cards from it that wait on them, and
// whether something of its failed since they last opened its chat (ui-rules A11). Each person's
// own: what they have seen is a preference of theirs, nothing about the firm's data.
import { CHIEF } from '../world/agents/index.ts'
import type { Card } from '../world/cards.ts'
import { one, run } from '../world/db.ts'
import type { World } from '../world/world.ts'

const SEEN = (agent: string) => `agent_seen:${agent}`

// The agent a card waits on the person from: the chat it shows in. A card no agent raised (a
// schedule's, a match, a kit's signature) shows in the Chief of staff's, so it is the Chief's.
export function cardAgent(c: Card): string {
  return c.agent ?? CHIEF
}

// The person opened the agent's chat: what failed until now no longer marks it.
export function chatOpened(world: World, user: string, agent: string): void {
  world.setPreference(user, SEEN(agent), String(world.lastLineId()))
}

// An agent deleted: no one's mark for it is kept.
export function forgetMarks(world: World, agent: string): void {
  run(world.db, 'DELETE FROM preferences WHERE key = ?', SEEN(agent))
}

// The agents that failed since the person last opened their chat: the latest finished run of one
// of the schedules that wake it ended Failed, or a task given to it stopped on a failure.
export function failedAgents(world: World, user: string): string[] {
  const ids = [CHIEF, ...world.agents.list().map((a) => a.id)]
  return ids.filter((id) => {
    const seen = Number(world.preference(user, SEEN(id)) ?? 0)
    const seenAt = (seen && world.lineById(seen)?.at) || ''
    const ran = one(
      world.db,
      `SELECT 1 AS x FROM schedules s
         JOIN runs r ON r.id = (SELECT id FROM runs WHERE schedule_id = s.id AND state != 'running'
                                ORDER BY started_at DESC LIMIT 1)
       WHERE s.agent = ? AND r.state = 'failed' AND COALESCE(r.ended_at, r.started_at) > ?
       LIMIT 1`,
      id,
      seenAt,
    )
    if (ran) return true
    return !!one(
      world.db,
      `SELECT 1 AS x FROM journal
       WHERE agent_id ${id === CHIEF ? 'IS NULL' : '= ?'} AND user_id = ? AND id > ?
         AND kind = 'error' AND actor_kind = 'alpha' AND turn_id LIKE 'task:%'
       LIMIT 1`,
      ...(id === CHIEF ? [] : [id]),
      user,
      seen,
    )
  })
}
