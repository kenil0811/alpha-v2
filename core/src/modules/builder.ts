// The Builder, a workspace skill of Alpha's (30 Oct; decision 13 kept: a skill, not a character).
// A build ask (a new module, table or agent, or an Add new… that needs more than a value) comes
// with its business case (who it is for, what it keeps, the decisions it serves) when its module
// has none: the shape walls' own check (walls.ts caseFirst), runs Research when the ask is not
// exact, and is proposed on one card for the person's yes. Nothing is applied before it: the card's
// Build it applies each change as the shape tool and keep would, and keeps the business case in
// the module's module.yaml, as the shape tool does.
import { z } from 'zod'
import { applyShape, describeShape, SHAPE_INPUT, type ShapeAction } from '../engine/tools/shape.ts'
import { type CaseInput, caseFirst } from '../engine/tools/walls.ts'
import type { Ask } from '../files/reading.ts'
import type { Actor } from '../world/journal.ts'
import { Refused } from '../world/kinds.ts'
import type { WriteCtx } from '../world/shape/index.ts'
import { businessCase, setBusinessCase } from '../world/shape/manifest.ts'
import type { World } from '../world/world.ts'
import { keep } from './keep.ts'
import { type Brief, research, type Web } from './research.ts'

export const BUILD = 'build'

export type BuildCase = CaseInput

export type Keep = { action: 'keep'; module: string; path: string; content: string }
export type Change = ShapeAction | Keep

export interface BuildInput {
  ask: string
  case: BuildCase
  changes: Change[]
}

const Case = z.object({
  for: z.string().trim().min(1),
  keeps: z.string().trim().min(1),
  decides: z.string().trim().min(1),
})
const KeepChange = z.object({
  action: z.literal('keep'),
  module: z.string().min(1),
  path: z.string().min(1),
  content: z.string().min(1),
})
const ShapeChange = z.object(SHAPE_INPUT)

const say = (c: Change): string =>
  c.action === 'keep' ? `keep ${c.path} in ${c.module}` : describeShape(c)

// The module a change lands in, by name.
function moduleOf(world: World, c: Change): string | null {
  if (c.action === 'keep' || c.action === 'make_table') return c.module?.trim() || null
  if (c.action === 'place_module') return c.module ?? null
  const t = c.table ? world.shape.table(c.table) : undefined
  return t?.module.name ?? null
}

// A build proposed: checked, researched when not exact, on one card. `within` is the module of an
// agent that asks: its changes stay inside it (a wall, as an agent's writes do).
export async function propose(
  world: World,
  hands: { ask: Ask; web: Web },
  p: { ask: string; case?: unknown; exact?: boolean | undefined; changes?: unknown[] | undefined },
  who: {
    user: string | null
    actor: Actor
    run?: string | null
    turn?: string | null
    within?: string | null
  },
  log: (words: string) => void = () => {},
): Promise<{ card: string; words: string; brief: Brief | null }> {
  const ask = String(p.ask ?? '').trim()
  if (!ask) throw new Refused('A build needs ask: what the person asked for, in their words.')
  const given = Case.safeParse(p.case)
  const changes: Change[] = []
  for (const [i, c] of (p.changes ?? []).entries()) {
    const k = KeepChange.safeParse(c)
    const s = k.success ? null : ShapeChange.safeParse(c)
    if (!k.success && !s?.success)
      throw new Refused(
        `Change ${i + 1} is not one Alpha can apply: a shape action (as the shape tool takes it) or { action: keep, module, path, content }.`,
      )
    changes.push(k.success ? k.data : (s?.data as ShapeAction))
  }
  if (!changes.length) throw new Refused('A build needs changes: what would be made, in order.')
  if (who.within) {
    const own = world.shape.module(who.within)
    for (const c of changes) {
      const m = moduleOf(world, c)
      const at = m ? world.shape.module(m) : undefined
      if (!own || !at || !world.shape.within(own.id).includes(at.id))
        throw new Refused(
          `An agent proposes changes to ${own?.name ?? 'its module'} only: ${say(c)}.`,
        )
    }
  }
  // the one business-case wall, the shape tool's: given now, or the module has one already
  const target = changes.map((c) => moduleOf(world, c)).find(Boolean)
  const at = target ? world.shape.module(target) : undefined
  caseFirst(
    at,
    target ?? ask,
    given.success ? given.data : undefined,
    'case { for, keeps, decides } with the build',
  )
  const theCase: BuildCase = given.success
    ? given.data
    : (businessCase(at as NonNullable<typeof at>) as BuildCase)
  const brief =
    p.exact === true ? null : await research(hands.ask, hands.web, { ask, about: theCase.for }, log)
  const input: BuildInput = { ask, case: theCase, changes }
  const detail = [
    `Asked: ${ask}`,
    `For: ${theCase.for}. Keeps: ${theCase.keeps}. Serves: ${theCase.decides}.`,
    `What would be made:\n${changes.map((c, i) => `${i + 1}. ${say(c)}`).join('\n')}`,
    ...(brief ? [brief.words] : []),
  ].join('\n\n')
  const m = target
  const card = world.cards.open({
    kind: 'suggestion',
    words: `Build this? ${ask}`,
    detail,
    restsOn: [
      `The business case: for ${theCase.for}`,
      ...(brief?.lines.slice(0, 3).map((b) => `${b.name}: ${b.line} (${b.sources[0]})`) ?? []),
    ],
    options: ['Build it', 'Not now'],
    call: { tool: BUILD, input: input as unknown as Record<string, unknown> },
    actor: who.actor,
    user: who.user,
    turn: who.turn ?? null,
    run: who.run ?? null,
    module: (m && world.shape.module(m)?.id) ?? null,
  })
  return {
    card: card.id,
    words: `Proposed on a card (${card.id}): ${changes.length} change${changes.length === 1 ? '' : 's'}${brief ? `, with research (${brief.lines.length} line${brief.lines.length === 1 ? '' : 's'})` : ''}. Nothing is built before the person’s Build it.`,
    brief,
  }
}

// The person's Build it: each change in order, as the shape tool and keep apply them; a module's
// first table carries the build's business case through the shape tool's own wall, and a module
// still without one keeps it in its module.yaml. A refusal stops there.
export async function build(world: World, input: BuildInput, ctx: WriteCtx): Promise<string> {
  const done: string[] = []
  try {
    for (const c of input.changes) {
      if (c.action === 'keep') {
        const m = world.shape.module(c.module) ?? world.shape.makeModule(c.module, ctx)
        await keep(world, m, c.path, c.content, ctx)
        done.push(`kept ${c.path} in ${m.name}`)
      } else
        done.push(
          applyShape(
            world,
            c.action === 'make_table' && !c.business_case ? { ...c, business_case: input.case } : c,
            ctx,
          ),
        )
    }
  } catch (err) {
    const why = err instanceof Error ? err.message : String(err)
    return `${done.length ? `Built ${done.join('; ')}; then stopped: ` : 'Nothing built: '}${why}`
  }
  const name = input.changes.map((c) => moduleOf(world, c)).find(Boolean)
  const m = name ? world.shape.module(name) : undefined
  if (m && !businessCase(m)) setBusinessCase(world.shape, m, input.case, 'alpha', ctx)
  return `Built: ${done.join('; ')}.`
}
