// The three gates, the only gates (design §7): anything that leaves the tenant's world; deleting
// the person's own entries when they didn't ask for it; a sign-in. A gate makes a card and the
// call does not run; the person's yes on that card lets the same call through once.
import type { Effect } from '@alpha/connector-sdk'
import type { Call, Card } from '../world/cards.ts'
import type { Actor } from '../world/journal.ts'
import type { World } from '../world/world.ts'

export type GateName = 'leaves_world' | 'deletes_own' | 'sign_in'

export interface GateInput {
  call: Call
  effect: Effect | undefined // undeclared counts as leaving the world
  preview: string // what the card shows
  restsOn?: string[]
  cannotUndo?: string | null
  ownEntries?: boolean // for a removal: whether what goes is the person's own
  askedIn?: string | null // for a removal: the person's words asking for it...
  message?: string | null // ...which must be in their own message, in the desk's turn on it
  actor: Actor
  user?: string | null
  turn?: string | null
  module?: string | null
}

export type Verdict = { pass: true; card?: Card } | { pass: false; card: Card; reason: string }

// What the model reads when a gated call did not run.
export const WAITS =
  "Not done yet: this waits for the person's yes on a card in their window. You will be told when they answer."

export function gateOf(input: GateInput): GateName | null {
  switch (input.effect) {
    case 'read':
    case 'write':
      return null
    case 'remove':
      if (!input.ownEntries) return null
      return askedFor(input.askedIn ?? null, input.message ?? null) ? null : 'deletes_own'
    case 'sign_in':
      return 'sign_in'
    default:
      return 'leaves_world'
  }
}

// A removal the person asked for carries their words, and code finds them in their message.
export function askedFor(words: string | null, message: string | null): boolean {
  if (!words || !message) return false
  const norm = (s: string) => s.toLowerCase().replace(/[’']/g, "'").replace(/\s+/g, ' ').trim()
  const w = norm(words)
  return w.length >= 3 && norm(message).includes(w)
}

export function decide(world: World, input: GateInput): Verdict {
  const gate = gateOf(input)
  if (!gate) return { pass: true }
  const yes = world.cards.useYes(input.call)
  if (yes) return { pass: true, card: yes }
  const card = world.cards.open({
    kind: 'permission',
    gate,
    words: input.preview,
    restsOn: input.restsOn ?? [],
    cannotUndo: input.cannotUndo ?? null,
    call: input.call,
    actor: input.actor,
    user: input.user ?? null,
    turn: input.turn ?? null,
    module: input.module ?? null,
  })
  return { pass: false, card, reason: WAITS }
}
