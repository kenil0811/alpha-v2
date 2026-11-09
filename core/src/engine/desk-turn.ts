// A running turn's own bookkeeping (split from desk.ts for its wall): the text and steps in the
// order they came, and how a teammate's ask it served is settled.
import { type AgentAsk, askOfTurn, OPEN } from '../world/agents/asks.ts'
import type { User, World } from '../world/world.ts'
import type { DeskEvent, DeskOptions, Turn, TurnPart } from './desk-types.ts'

export type Running = Turn & { reply: string; doing: string | null; parts: TurnPart[] }

export const startTurn = (t: Turn): Running => ({ ...t, reply: '', doing: null, parts: [] })

export const liveOf = (r: Running): DeskEvent => ({
  type: 'live',
  turn: r.turn,
  text: r.reply,
  doing: r.doing,
  parts: r.parts,
})

export function addText(r: Running, delta: string): void {
  r.reply += delta
  const last = r.parts.at(-1)
  if (last?.kind === 'text') last.text += delta
  else r.parts.push({ kind: 'text', text: delta })
}

// A new message of the model with no step before it: a new paragraph of the same text.
export function addBreak(r: Running): void {
  if (r.reply) r.reply += '\n\n'
  const last = r.parts.at(-1)
  if (last?.kind === 'text') last.text += '\n\n'
}

export function addStep(r: Running, words: string): void {
  r.doing = words
  r.parts.push({ kind: 'step', words })
}

// What the model has written since its last step.
export function textSoFar(r: Running): string | null {
  const last = r.parts.at(-1)
  return last?.kind === 'text' ? last.text.trim() || null : null
}

// The usage window closed: said in the conversation, and the turn that picks up when it opens.
export function limitLine(
  e: { resetsAt: Date | null; info: unknown },
  user: string,
  agent: string | null,
  turn: string | null,
) {
  const at = e.resetsAt
  return {
    actor: { kind: 'system' as const },
    kind: 'limit',
    words: at
      ? `Your Claude usage window is closed until ${at.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}. I'll carry on then.`
      : 'Your Claude usage window is closed for now.',
    data: { info: e.info },
    user,
    agent,
    turn,
  }
}

export const turnAfterLimit = (turn: string): Turn => ({
  turn,
  text: 'The usage window is open again: carry on with what was asked.',
  said: null,
  message: null,
})

// A teammate's ask this turn served: answered with the answer tool, or by its last words; left
// open while the answers to what this turn asked, or a card it raised, are still to come.
export function settleAsk(
  world: World,
  bus: DeskOptions['bus'],
  user: User,
  running: Turn,
  e: { ok: boolean; text: string },
  stopped: boolean,
  spent: number | null,
): void {
  if (!running.ask) return
  const asks = world.asks
  const row = asks.get(running.ask)
  if (!row) return
  const waiting =
    asks.ofTurn(running.turn).some((x) => OPEN.includes(x.state)) ||
    world.cards.waiting(user.id).some((c) => askOfTurn(c.turn) === row.id)
  if (row.state === 'running' && !waiting)
    asks.settle(
      row.id,
      stopped ? 'stopped' : e.ok ? 'answered' : 'failed',
      stopped ? null : { status: e.ok ? 'done' : 'failed', result: e.text || 'Nothing to say.' },
    )
  const now = asks.get(row.id) as AgentAsk
  if (now.state !== 'running') bus?.settled(user, now, spent)
  // named by the person and still waiting on a card: what it has so far goes to them now
  else if (now.brief.direct && e.text) bus?.interim(user, now, e.text)
}
