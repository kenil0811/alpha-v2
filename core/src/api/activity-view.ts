// Activity: what the window lists, newest first, from the journal and the runs.

import type { RunRow } from '../modules/runs/index.ts'
import { schedules } from '../modules/schedules.ts'
import type { Line } from '../world/journal.ts'
import { undoable } from '../world/records/index.ts'
import type { BaseCtx } from './ctx.ts'
import type { RunView, UndoTarget } from './types.ts'

export function activityView(
  ctx: Pick<BaseCtx, 'world' | 'engine'>,
  byWords: (madeBy: string) => string,
): { activity: () => RunView[]; runOut: (r: RunRow) => RunView } {
  const { world, engine } = ctx
  // Activity: schedules' runs and connections' reads, newest first, and Alpha's turns
  // that changed rows, removals outside both, and the person's reverts, each with its Revert or
  // Bring back where it can be undone. A run that ended having changed nothing is quiet, so the
  // window can fold it.
  const ROWS = ['landed', 'wrote', 'changed', 'removed', 'reverted']
  const clock = (at: string) =>
    new Date(at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })
  const undoOf = (target: UndoTarget, label: 'Revert' | 'Bring back', what: string) =>
    undoable(world.records, target) ? { target, label, what } : null
  function runOut(r: RunRow): RunView {
    const CHANGES = new Set([...ROWS, 'told', 'card_opened'])
    const steps = world
      .lines({ run: r.id, kinds: ['run_step', 'told', ...ROWS, 'card_opened', 'task'] })
      .map((l) => ({ id: l.id, at: l.at, kind: l.kind, words: l.words }))
    const name = (r.schedule && schedules(world).find((a) => a.id === r.schedule)?.name) || 'A try'
    return {
      id: r.id,
      kind: 'run',
      name,
      module: r.module ? (world.shape.module(r.module)?.name ?? null) : null,
      moduleId: r.module,
      startedAt: r.startedAt,
      ms: r.endedAt ? Date.parse(r.endedAt) - Date.parse(r.startedAt) : null,
      state: r.state,
      words: r.words,
      tokens: r.tokens, // a script's own work uses none; a document read by the model does
      usd: world.spend.of({ run: r.id }),
      quiet: r.state === 'ok' && !steps.some((st) => CHANGES.has(st.kind)),
      steps,
      undo:
        r.state === 'running'
          ? null
          : undoOf({ run: r.id }, 'Revert', `what ${name} did at ${clock(r.startedAt)}`),
    }
  }
  const lineOut = (
    l: { id: number; at: string; words: string; kind: string },
    kind: RunView['kind'],
    name: string,
    moduleId: string | null,
  ): RunView => ({
    id: `${kind}-${l.id}`,
    kind,
    name,
    module: moduleId ? (world.shape.module(moduleId)?.name ?? null) : null,
    moduleId,
    startedAt: l.at,
    ms: null,
    state: 'ok',
    words: l.words,
    tokens: null,
    usd: null,
    quiet: false,
    steps: [],
    undo: null,
  })
  // What Alpha did through a connector: each write or send of a turn that went, as a
  // step of the turn that asked for it; one that went on the person's yes, under that card's turn.
  // Each web page opened too, saying how it went (shown, on the list, named, on a yes: rules L1).
  function actionsOut(): Line[] {
    const calls = new Map<string, Line>()
    for (const l of world.lines({ kinds: ['call'], limit: 2000 }))
      if (
        !l.run &&
        (l.data.effect === 'write' ||
          l.data.effect === 'outward' ||
          ((l.data.tool === 'WebFetch' || l.data.tool === 'look') &&
            typeof (l.data.input as { url?: unknown } | undefined)?.url === 'string'))
      )
        calls.set(String(l.data.call), l)
    return world.lines({ kinds: ['called'], limit: 2000 }).flatMap((done) => {
      const c = done.data.ok === true ? calls.get(String(done.data.call)) : undefined
      if (!c) return []
      const card = typeof done.data.card === 'string' ? world.cards.get(done.data.card) : undefined
      return [
        {
          ...c,
          id: done.id,
          at: done.at,
          turn: card?.turn ?? c.turn,
          words: card
            ? `${c.words}, on your yes`
            : typeof done.data.how === 'string'
              ? `${c.words}, ${done.data.how}`
              : c.words,
        },
      ]
    })
  }
  // Alpha's turns that wrote rows or did something through a connector, each with the person's
  // words and those lines as steps
  function turnsOut(lines: Line[]): RunView[] {
    const byTurn = new Map<string, Line[]>()
    for (const l of lines)
      if (l.turn && !l.run) byTurn.set(l.turn, [...(byTurn.get(l.turn) ?? []), l])
    return [...byTurn].map(([turn, unsorted]) => {
      const ls = unsorted.sort((a, b) => a.id - b.id)
      const said = world.lineById(Number(turn))
      const at = said?.at ?? (ls[0] as Line).at
      const asked = said?.words ?? ''
      return {
        ...lineOut({ ...(ls[0] as Line), at }, 'turn', 'Alpha', said?.module ?? null),
        id: `turn-${turn}`,
        usd: world.spend.of({ turn }),
        words: asked
          ? `You asked: “${asked.length > 120 ? `${asked.slice(0, 117)}…` : asked}”`
          : null,
        steps: ls.map((l) => ({ id: l.id, at: l.at, kind: l.kind, words: l.words })),
        undo: undoOf({ turn }, 'Revert', `what Alpha did at ${clock(at)}`),
      }
    })
  }
  const activity = (): RunView[] => {
    const runs: RunView[] = (engine.hands?.runner.runs(100) ?? []).map(runOut)
    // a connector's refused reach is a step of the read that made it,
    // or an entry of its own when no read did
    const refusals = world.lines({ kinds: ['reach_refused'], limit: 200 })
    const placed = new Set<number>()
    const reads: RunView[] = world.lines({ kinds: ['connection_read'], limit: 200 }).map((l) => {
      const startedAt = new Date(Date.parse(l.at) - Number(l.data.ms ?? 0)).toISOString()
      const steps = refusals
        .filter((r) => r.actor.id === l.actor.id && r.at >= startedAt && r.at <= l.at)
        .map((r) => {
          placed.add(r.id)
          return { id: r.id, at: r.at, kind: r.kind, words: r.words }
        })
      return {
        id: `read-${l.id}`,
        kind: 'read',
        name: String(l.data.name ?? 'A connection'),
        module: null,
        moduleId: null,
        startedAt,
        ms: Number(l.data.ms ?? 0),
        state: l.data.state === 'failed' ? 'failed' : 'ok',
        words: l.words,
        tokens: null,
        usd: null,
        quiet: l.data.quiet === true && !steps.length,
        steps,
        undo: null,
      }
    })
    const alone: RunView[] = refusals
      .filter((r) => !placed.has(r.id))
      .map((r) => lineOut(r, 'read', String(r.data.title ?? r.actor.id ?? 'A connector'), null))
    const rowLines = world.lines({ kinds: ROWS, limit: 1000 })
    const tookBack = world.lines({ kinds: ['took_back'], limit: 200 })
    // removals and reverts made outside a run or a turn: the person's, mostly
    const own = rowLines
      .filter((l) => !l.run && !l.turn && (l.kind === 'reverted' || l.kind === 'removed'))
      .filter((l) => l.kind === 'reverted' || Array.isArray(l.data.records))
      .map((l) => {
        const who = byWords(`${l.actor.kind}:${l.actor.id ?? ''}`)
        return l.kind === 'removed'
          ? {
              ...lineOut(l, 'removal', who, l.module),
              undo: undoOf({ line: l.id }, 'Bring back', 'the removal'),
            }
          : {
              ...lineOut(l, 'revert', who, l.module),
              // what it took back outside Alpha, each its own step
              steps: tookBack
                .filter((t) => JSON.stringify(t.data.target) === JSON.stringify(l.data.target))
                .map((t) => ({ id: t.id, at: t.at, kind: t.kind, words: t.words })),
              undo: undoOf({ line: l.id }, 'Revert', `the revert at ${clock(l.at)}`),
            }
      })
    return [...runs, ...reads, ...alone, ...turnsOut([...rowLines, ...actionsOut()]), ...own]
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
      .slice(0, 200)
  }
  return { activity, runOut }
}
