// Revert, with what it did outside Alpha taken back (step 2, part 2, Kenil's yes 30 Oct): the
// rows first, in one transaction, as undo has done since core step 1; then each take-back the
// revert offered, run through its connector and journaled as any call. One that fails is said in
// its own line, and the rest go on. A preview runs nothing outside.
import type { Undo, UndoTarget } from '../world/records/index.ts'
import { revert } from '../world/records/index.ts'
import type { WriteCtx } from '../world/shape/index.ts'
import type { World } from '../world/world.ts'
import type { ConnectorService } from './service.ts'

export async function revertAll(
  world: World,
  connectors: ConnectorService | null,
  target: UndoTarget,
  ctx: WriteCtx,
  what: string,
  options: { preview?: boolean } = {},
): Promise<Undo> {
  const undone = revert(world.records, target, ctx, what, options)
  if (options.preview || !undone.takeBacks.length) return undone
  const said: string[] = []
  for (const t of undone.takeBacks) {
    const line = world.lineById(t.line)
    try {
      if (!connectors || !line) throw new Error('its connector is not loaded')
      const { words } = await connectors.takeBack(line)
      world.line({
        actor: ctx.actor,
        kind: 'took_back',
        words: `${words}, reverting ${what}.`,
        data: { line: t.line, target },
        user: ctx.user ?? null,
      })
      said.push(words)
    } catch (err) {
      const why = err instanceof Error ? err.message : String(err)
      world.line({
        actor: ctx.actor,
        kind: 'took_back',
        words: `Could not take back “${t.words}”: ${why}`,
        data: { line: t.line, target, failed: true },
        user: ctx.user ?? null,
      })
      said.push(`could not: ${t.words} (${why})`)
    }
  }
  // what was done, in the past, in place of what the preview said it would do
  return { ...undone, words: `${said.join('; ')}.` }
}
