// A kit someone else maintains (decision 3b; docs/rules.md, M4): its shape changes, by any door,
// go on a card for the person first. Ask the maintainer to put it in the kit's next version, or do
// it now and they are told later (api/routes/cards.ts answers it). The change is refused in the
// card's words, so the door that asked says so. A kit's own install and update make its shape.
import { one } from './db.ts'
import { Refused } from './kinds.ts'
import { findField, type Redo, type WriteCtx } from './shape/index.ts'
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

// Who manages a module, when it is managed: Alpha, or Kenil for a signed pack (rules M1).
export function managedBy(world: World, moduleId: string): string | null {
  return (
    one<{ managed: string | null }>(
      world.db,
      'SELECT managed FROM kits WHERE module_id = ?',
      moduleId,
    )?.managed ?? null
  )
}

// A managed module's shape stays as it is, by every door (rules M2); only its kit changes it, by
// its own install and update, which the core makes as itself.
export function refuseManaged(world: World, moduleId: string, words: string, ctx: WriteCtx): void {
  if (ctx.actor.kind === 'system') return
  const who = managedBy(world, moduleId)
  const m = who ? world.shape.module(moduleId) : undefined
  if (who && m)
    throw new Refused(
      `${m.name} is managed by ${who}, so it cannot ${words}: ${who === 'Alpha' ? 'it comes with Alpha' : 'only a newer pack signed by Kenil changes it'}. Its rows are the firm's to change.`,
    )
}

// A mirror's source fields are its connector's, managed by Alpha (rules M1): a field the person
// adds beside them is theirs, the table may be renamed, and what a field is about may be said.
function refuseSourceField(world: World, redo: Redo, ctx: WriteCtx): void {
  if (ctx.actor.kind === 'connector') return
  const [at, name] =
    redo.method === 'rename'
      ? [redo.args[0].table, redo.args[0].field]
      : redo.method === 'removeTable'
        ? [redo.args[0], undefined]
        : redo.method === 'makeTable' ||
            redo.method === 'addFields' ||
            redo.method === 'describe' ||
            redo.method === 'setBusinessCase' ||
            redo.method === 'keep'
          ? [undefined, undefined]
          : [redo.args[0], redo.args[1]]
  const t = at ? world.shape.table(at) : undefined
  if (!t?.mirror) return
  if (redo.method === 'removeTable')
    throw new Refused(
      `${t.name} is a mirror of ${t.mirror}, managed by Alpha: it goes when its connection does.`,
    )
  const f = name ? findField(t, name, true) : undefined
  if (f?.key)
    throw new Refused(
      `${f.name} is ${t.mirror}'s field on ${t.name}, managed by Alpha, so it stays as it is. A field you add beside it is yours.`,
    )
}

export function askMaintainer(world: World, moduleId: string, redo: Redo, ctx: WriteCtx): void {
  if (ctx.actor.kind === 'system') return
  refuseManaged(world, moduleId, redo.words, ctx)
  refuseSourceField(world, redo, ctx)
  if (ctx.anyway) return
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
