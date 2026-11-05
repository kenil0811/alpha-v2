// A kit someone else maintains (decision 3b; docs/rules.md, M4): its shape changes, by any door,
// go on a card for the person first. Ask the maintainer to put it in the kit's next version, or do
// it now and they are told later (api/routes/cards.ts answers it). The change is refused in the
// card's words, so the door that asked says so. A kit's own install and update make its shape.
import { one } from './db.ts'
import { Refused } from './kinds.ts'
import type { Redo, WriteCtx } from './shape/index.ts'
import type { World } from './world.ts'

export const MAINTAINED_SHAPE = 'maintained_shape'

export function maintainerOf(
  world: World,
  moduleId: string,
): { name: string; address: string; kit: string; version: string } | null {
  const k = one<{ kit: string; version: string; maintainer: string | null }>(
    world.db,
    'SELECT kit, version, maintainer FROM kits WHERE module_id = ?',
    moduleId,
  )
  if (!k?.maintainer) return null
  const m = JSON.parse(k.maintainer) as { name: string; address: string }
  return { ...m, kit: k.kit, version: k.version }
}

export function askMaintainer(world: World, moduleId: string, redo: Redo, ctx: WriteCtx): void {
  if (ctx.anyway || (ctx.actor.kind === 'system' && ctx.actor.id?.startsWith('kit:'))) return
  const kit = maintainerOf(world, moduleId)
  const m = world.shape.module(moduleId)
  if (!kit || !m) return
  const card = world.cards.open({
    kind: 'suggestion',
    words: `${kit.name} maintains ${m.name}: ${redo.words}. Ask them to put it in the kit's next version, or do it now and they are told later.`,
    restsOn: [`${kit.kit} ${kit.version} is maintained by ${kit.name}`],
    options: [`Ask ${kit.name}`, 'Do it now anyway'],
    call: { tool: MAINTAINED_SHAPE, input: redo as unknown as Record<string, unknown> },
    actor: ctx.actor,
    user: ctx.user ?? null,
    turn: ctx.turn ?? null,
    module: m.id,
  })
  throw new Refused(
    `${kit.name} maintains ${m.name}, so this change is on a card for the person: ask ${kit.name}, or do it now (card ${card.id}). Nothing changed yet.`,
  )
}
