// Revert, with what it did outside Alpha taken back: the rows first, in one transaction, as undo
// does; then each take-back the revert offered, run through its connector and journaled as any
// call. One that fails is said in its own line, and the rest go on. A preview runs nothing outside.

import { Refused } from '../world/kinds.ts'
import type { Undo, UndoTarget } from '../world/records/index.ts'
import { revert } from '../world/records/index.ts'
import type { WriteCtx } from '../world/shape/index.ts'
import type { World } from '../world/world.ts'
import { isRemote } from './process.ts'
import type { ConnectorService } from './service.ts'

// What a done call's take-back would do, in words; none when it is final.
export async function undoOf(
  connectors: ConnectorService,
  name: string,
  input: Record<string, unknown>,
  result: unknown,
): Promise<{
  kind: 'final' | 'undoable' | 'counter'
  said: string | null
  words: string | null
} | null> {
  const t = connectors.toolOf(name)
  if (!t) return null
  const says = await connectors.says(name, input)
  if (!says?.undo) return null
  if (says.undo.kind === 'final') return { ...says.undo, words: null }
  const words = isRemote(t.c)
    ? await t.c.remote.undoWords(t.tool, input, result)
    : t.spec.undo && t.spec.undo !== 'final'
      ? t.spec.undo.words(input as never, result)
      : null
  return { ...says.undo, words }
}

// A done call taken back, from the line that said it was done: its tool's take-back runs with
// what the call returned, journaled as any call; the words say it.
export async function takeBack(
  connectors: ConnectorService,
  world: World,
  line: { data: Record<string, unknown> },
): Promise<{ words: string }> {
  const undo = line.data.undo as { words?: string; result?: unknown } | undefined
  const call = line.data.call as string | undefined
  const from = world.lines({ kinds: ['call'], limit: 5000 }).find((l) => l.data.call === call)
  const t = from ? connectors.toolOf(String(from.data.tool)) : undefined
  if (!t?.spec.undo || t.spec.undo === 'final' || !undo)
    throw new Refused('That cannot be taken back.')
  const c = connectors.connector(t.c.manifest.name)
  await t.spec.undo.run(
    connectors.call(c, connectors.connectionFor(c), 'write'),
    from?.data.input as never,
    undo.result,
  )
  const words = (undo.words ?? 'Taken back').replace(/^(\w+)s\b/, (_m, v: string) =>
    v.endsWith('e') ? `${v}d` : `${v}ed`,
  )
  return { words }
}

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
      const { words } = await takeBack(connectors, world, line)
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
