// Governance, a workspace skill of Alpha's (30 Oct; decision 13 kept: a skill, not a character).
// It runs on the rules store and the gates as they are: code still decides, the skill explains.
// It puts what Alpha noticed to the person on the Save card (the rules-waiting path), explains a
// refusal in plain words (config/governance.md), and flags an agent whose runs keep hitting a
// wall. It never approves a rule: only the person's Save does (rules.ts holds that wall).
import { config } from '../config.ts'
import type { Ask } from '../files/reading.ts'
import { all, one } from '../world/db.ts'
import type { Actor } from '../world/journal.ts'
import { type RuleSpec, SAVE_RULE } from '../world/rules.ts'
import type { World } from '../world/world.ts'
import { agents } from './agents.ts'

// A noticed rule on its Save card carries the rule it would approve.
export type NoticedSpec = RuleSpec & { noticed?: string }

// The person's Save on a rule's card: a noticed one becomes theirs (approved), any other is made.
export function saveOnCard(
  world: World,
  input: unknown,
  ctx: { actor: Actor; user: string | null; card: string },
): void {
  const s = input as NoticedSpec
  if (s.noticed) world.rules.approve(s.noticed, ctx)
  else world.rules.save(s, ctx)
}

// A noticed rule decided in Governance itself: its card, if still waiting, goes.
export function closeNoticedCard(world: World, rule: string, actor: Actor): void {
  for (const c of world.cards.waiting())
    if (c.call?.tool === SAVE_RULE && (c.call.input as NoticedSpec).noticed === rule)
      world.cards.withdraw(c.id, actor, 'Decided in Governance.')
}

// Each rule Alpha noticed and nobody has decided, put to the person on its own Save card, grouped
// by where it holds; a rule that had a card once is not asked again (it stays in Governance).
export function putNoticed(
  world: World,
  who: { user: string | null; actor: Actor; run?: string | null; module?: string | null },
): number {
  const rules = world.rules
    .list(who.module ?? undefined)
    .filter((r) => r.kind === 'inferred' && !r.revokedAt)
    .filter(
      (r) =>
        !one(
          world.db,
          "SELECT 1 FROM cards WHERE json_extract(call, '$.tool') = ? AND json_extract(call, '$.input.noticed') = ?",
          SAVE_RULE,
          r.id,
        ),
    )
    .sort((a, b) => (a.module ?? '').localeCompare(b.module ?? ''))
  for (const r of rules) {
    const from = (r.source.lines ?? []).flatMap((id) => {
      const l = world.lineById(id)
      return l ? [`You said: “${l.words}”`] : []
    })
    const spec: NoticedSpec = {
      side: r.side,
      module: r.module,
      agent: r.agent,
      covers: r.covers,
      said: r.said,
      noticed: r.id,
    }
    world.cards.open({
      kind: 'question',
      words: `Alpha noticed you keep to this. Make it a rule? ${r.words}`,
      options: ['Save', 'Not now'],
      restsOn: from.length ? from : ['What Alpha noticed in your answers'],
      call: { tool: SAVE_RULE, input: spec as unknown as Record<string, unknown> },
      actor: who.actor,
      user: who.user,
      module: r.module,
      run: who.run ?? null,
    })
  }
  return rules.length
}

export interface Wall {
  agent: string
  module: string
  runs: number
  last: string
}

// The agents whose runs hit a wall (a refusal by a rule or by their own file) in that many runs
// of the last days, with the latest refusal's words.
export function walls(world: World, nowMs = Date.now(), module?: string | null): Wall[] {
  const l = config.limits()
  const since = new Date(nowMs - l.governance_days * 86_400_000).toISOString()
  const hits = all<{ agent: string; module: string; runs: number; last: string }>(
    world.db,
    `SELECT r.agent_id AS agent, r.module_id AS module, count(DISTINCT r.id) AS runs,
       (SELECT j2.words FROM journal j2 JOIN runs r2 ON r2.id = j2.run_id WHERE r2.agent_id = r.agent_id
          AND (j2.kind = 'refused' OR (j2.kind = 'run_step' AND j2.words LIKE 'Refused:%'))
          ORDER BY j2.id DESC LIMIT 1) AS last
     FROM runs r JOIN journal j ON j.run_id = r.id
     WHERE r.started_at >= ? AND r.agent_id IS NOT NULL
       AND (j.kind = 'refused' OR (j.kind = 'run_step' AND j.words LIKE 'Refused:%'))
     GROUP BY r.agent_id, r.module_id`,
    since,
  )
  const names = new Map(agents(world).map((a) => [a.id, a.name]))
  return hits
    .filter((h) => h.runs >= l.governance_wall_runs && names.has(h.agent))
    .filter((h) => !module || h.module === module)
    .map((h) => ({
      agent: names.get(h.agent) as string,
      module: h.module,
      runs: h.runs,
      last: h.last.replace(/^Refused:\s*/, ''),
    }))
}

// The day's look: what was noticed, put to the person; the agents walled, said.
export function review(
  world: World,
  who: { user: string | null; actor: Actor; run?: string | null; module?: string | null },
  nowMs = Date.now(),
): { words: string; noticed: number; walls: Wall[] } {
  const noticed = putNoticed(world, who)
  const hit = walls(world, nowMs, who.module)
  const parts = [
    ...(noticed
      ? [`${noticed} rule${noticed === 1 ? '' : 's'} Alpha noticed, put to you to save or leave`]
      : []),
    ...hit.map(
      (w) =>
        `${w.agent} hit a wall in ${w.runs} runs this week (last: ${w.last.replace(/\.$/, '')})`,
    ),
  ]
  return {
    words: parts.length ? `${parts.join('; ')}.` : 'Nothing for governance today.',
    noticed,
    walls: hit,
  }
}

const EXPLAIN = {
  type: 'object',
  properties: { plain: { type: 'string' }, fix: { type: 'string' } },
  required: ['plain', 'fix'],
  additionalProperties: false,
}

// A refusal in plain words: what was stopped, by which rule or wall, and what the person can do.
// The model only explains; the refusal stands whatever it says.
export async function explain(
  world: World,
  ask: Ask,
  q: { refusal: string; module?: string | null; agent?: string | null },
): Promise<{ words: string; tokens: number }> {
  const rules = world.rules.inForce({ module: q.module ?? null, agent: q.agent ?? null })
  const where = q.module ? world.shape.module(q.module)?.name : null
  const { answer, tokens } = await ask(
    [
      `The refusal: ${q.refusal}`,
      where
        ? `Where: ${where}${q.agent ? `, agent ${q.agent}` : ''}.`
        : q.agent
          ? `Agent: ${q.agent}.`
          : '',
      rules.length
        ? `The rules in force:\n${rules.map((r) => `- ${r}`).join('\n')}`
        : 'No rule of the person’s is in force here.',
    ]
      .filter(Boolean)
      .join('\n\n'),
    EXPLAIN,
  )
  const a = (answer ?? {}) as { plain?: unknown; fix?: unknown }
  const plain = String(a.plain ?? '').trim()
  const fix = String(a.fix ?? '').trim()
  if (!plain) return { words: q.refusal, tokens }
  return { words: fix ? `${plain} ${fix}` : plain, tokens }
}
