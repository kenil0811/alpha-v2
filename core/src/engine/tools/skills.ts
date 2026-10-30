// Alpha's workspace skills at the desk (30 Oct): Research, Governance and the Builder, the same
// skills a module's agent calls through the kit API (alpha.research, alpha.governance.*,
// alpha.builder.propose), so they serve every module's thread. Each is a skill of Alpha's, never
// a character: the reply is Alpha's.
import { z } from 'zod'
import { config } from '../../config.ts'
import { propose } from '../../modules/builder.ts'
import { explain, review } from '../../modules/governance.ts'
import { research } from '../../modules/research.ts'
import { Refused } from '../../world/kinds.ts'
import type { ToolEntry } from '../registry.ts'
import type { Tooling } from './common.ts'
import { guardAsync, ok, tool } from './common.ts'

export function skillTools({ world, here, hands, ctx }: Tooling): ToolEntry[] {
  const runner = () => {
    if (!hands) throw new Refused('The workspace skills are not set up in this core.')
    return hands.runner
  }
  const from = () => here.current.from?.id ?? null
  return [
    tool(
      'research',
      'Alpha’s Research skill: a bounded web look before building something not exact, or when the person asks what others do. It searches and reads (reading only), then gives a short brief ranked by impact × reach ÷ effort: competitors and new startups, open-source alternatives (licence, activity, what they do better or worse, learn from or reuse), and common practice, each line with sources code checked. Give ask (the question, in the person’s words) and about (what you know of their business). It takes minutes; say so first.',
      { ask: z.string().min(1), about: z.string().optional() },
      async (a) =>
        guardAsync(async () => {
          const r = runner()
          const out = await research(r.researchAsk, r.web, { ask: a.ask, about: a.about ?? null })
          return ok(out.words)
        }),
    ),
    tool(
      'governance',
      'Alpha’s Governance skill, on the rules and gates as they are: code decides, this explains. review: puts each rule Alpha noticed on its Save card for the person (never approves one) and names the agents that keep hitting a wall, for the module asked from or all of Alpha. explain: a refusal (give refusal, its words, and agent when an agent was refused) in plain words with what the person could do.',
      {
        action: z.enum(['review', 'explain']),
        refusal: z.string().optional(),
        agent: z.string().optional(),
      },
      async (a) =>
        guardAsync(async () => {
          if (a.action === 'review') {
            const out = review(world, {
              user: here.current.user.id,
              actor: ctx().actor,
              module: from(),
            })
            return ok(out.words)
          }
          if (!a.refusal?.trim()) throw new Refused('explain needs refusal: its words.')
          const out = await explain(world, runner().governanceAsk, {
            refusal: a.refusal,
            module: from(),
            agent: a.agent ?? null,
          })
          return ok(out.words)
        }),
    ),
    tool(
      'build',
      config.builder(),
      {
        ask: z.string().min(1),
        case: z.object({ for: z.string(), keeps: z.string(), decides: z.string() }).optional(),
        exact: z.boolean().optional(),
        changes: z.array(z.looseObject({ action: z.string() })),
      },
      async (a) =>
        guardAsync(async () => {
          const r = runner()
          const out = await propose(world, { ask: r.researchAsk, web: r.web }, a, {
            user: here.current.user.id,
            actor: ctx().actor,
            turn: here.current.turn,
          })
          return ok(out.words)
        }),
    ),
  ]
}
