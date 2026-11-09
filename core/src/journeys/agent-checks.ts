// A journey's checks on agents (clean base step 7): how many, what one remembers, its instructions,
// and the asks between them. Read from the world, never from the model's prose.
import { instructionsOf } from '../modules/agents.ts'
import type { World } from '../world/world.ts'

type Saw = { check: string; ok: boolean; saw: string }

export function agentCheck(check: object, world: World, user: string): Saw | null {
  if ('agents' in check) {
    const want = check.agents as number
    const n = world.agents.list().length
    return { check: `agents: ${want}`, ok: n === want, saw: String(n) }
  }
  if ('memory' in check) {
    const m = check.memory as { agent: string; matches: string }
    const a = world.agents.byName(m.agent)
    const texts = a ? world.memories.list(a.id, user).map((x) => x.text) : []
    return {
      check: `${m.agent} remembers ${m.matches}`,
      ok: texts.some((t) => new RegExp(m.matches, 'i').test(t)),
      saw: texts.join(' | ') || 'nothing',
    }
  }
  if ('instructions' in check) {
    const m = check.instructions as { agent: string; matches: string }
    const a = world.agents.byName(m.agent)
    const text = a ? instructionsOf(world, a.id) : ''
    return {
      check: `${m.agent}'s instructions say ${m.matches}`,
      ok: new RegExp(m.matches, 'i').test(text),
      saw: text.slice(0, 200) || 'nothing',
    }
  }
  if ('asks' in check) {
    const m = check.asks as { count: number; status?: string }
    const every = (['answered', 'failed', 'stopped', 'unknown'] as const).flatMap((s) =>
      world.asks.inState(s),
    )
    const n = every.filter((a) => !m.status || a.answer?.status === m.status).length
    return {
      check: `asks${m.status ? ` ${m.status}` : ''}: ${m.count}`,
      ok: n === m.count,
      saw: String(n),
    }
  }
  return null
}
