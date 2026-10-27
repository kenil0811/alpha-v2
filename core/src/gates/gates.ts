// The three gates, the only gates (design §7): anything that leaves the tenant's world; deleting
// the person's own entries when they didn't ask for it; a sign-in. A gate makes a card and the
// call does not run; the person's yes on that card lets the same call through once. Before them,
// the person's rules (core step 2): an approved deny refuses any call it covers, with no card,
// quoting itself; an approved allow lets a gated call through; what Alpha noticed is followed on a
// read or on rows that are not the person's own, and otherwise only said on the card.

import type { Effect } from '@alpha/connector-sdk'
import { config } from '../config.ts'
import type { Call, Card } from '../world/cards.ts'
import type { Actor } from '../world/journal.ts'
import { type CallFacts, doesOf, type Rule } from '../world/rules.ts'
import type { World } from '../world/world.ts'

// `noticed`: a write to the person's own rows that what Alpha noticed says they may not want
export type GateName = 'leaves_world' | 'deletes_own' | 'sign_in' | 'noticed'

export interface GateInput {
  call: Call
  effect: Effect | undefined // undeclared counts as leaving the world
  preview: string // what the card shows
  detail?: string | null // and in full: the message as it will go
  yes?: string // the yes in the card's own words (Send it); else by its gate
  restsOn?: string[]
  cannotUndo?: string | null
  ownEntries?: boolean // for a removal or a change: whether the rows are the person's own
  askedIn?: string | null // for a removal: the person's words asking for it...
  message?: string | null // ...which must be in their own message, in the desk's turn on it
  actor: Actor
  user?: string | null
  turn?: string | null
  module?: string | null
  table?: string | null // the table it writes, removes from or reads, by id
  agent?: string | null // the agent making the call, by name
}

// A refusal by a rule has no card: nothing the person can say yes to on the spot.
export type Verdict =
  | { pass: true; card?: Card }
  | { pass: false; card: Card | null; reason: string; rule?: Rule }

// What the model reads when a gated call did not run.
export const WAITS =
  "Not done yet: this waits for the person's yes on a card in their window. You will be told when they answer."

// The yes on a card, in words that say what happens.
const YES: Record<GateName, string> = {
  leaves_world: 'Go ahead',
  deletes_own: 'Remove them',
  sign_in: 'Sign in',
  noticed: 'Go ahead',
}

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

// A removal the person asked for carries their words, and code finds them in their message:
// the quote must be in what they typed this turn, and must say removal in one of the words
// core/config/words.yaml lists (item 11 of the problems list, 25 Oct); anything else is a card.
export function askedFor(words: string | null, message: string | null): boolean {
  if (!words || !message) return false
  const norm = (s: string) => s.toLowerCase().replace(/[’']/g, "'").replace(/\s+/g, ' ').trim()
  const w = norm(words)
  if (w.length < 3 || !norm(message).includes(w)) return false
  return config
    .words()
    .removal.some((r) => new RegExp(`\\b${norm(r).replace(/ /g, '\\s+')}\\b`).test(w))
}

// What a call is, as the rules read it.
export function factsOf(input: GateInput): CallFacts {
  const i = (input.call.input ?? {}) as Record<string, unknown>
  const site = input.call.tool === 'network' && typeof i.host === 'string' ? i.host : null
  const to = [i.to, i.cc]
    .filter((x): x is string => typeof x === 'string')
    .flatMap((x) => x.split(/[,;]/))
    .map((x) => x.trim())
    .filter(Boolean)
  return {
    effect: input.effect,
    tool: input.call.tool,
    to,
    site,
    table: input.table ?? null,
    module: input.module ?? null,
    agent: input.agent ?? null,
    own: !!input.ownEntries,
  }
}

// The words the model reads when a rule refused its call.
export const refusedBy = (r: Rule) =>
  `Refused by the person's rule: “${r.words}” Do not try it another way. Tell them which rule stopped it, and that they can revoke it in Governance or Settings › Permissions.`

export function decide(world: World, input: GateInput): Verdict {
  const facts = factsOf(input)
  const rules = world.rules.judge(facts)
  const ctx = {
    actor: input.actor,
    user: input.user ?? null,
    turn: input.turn ?? null,
  }
  if (rules.deny) {
    world.rules.used(
      rules.deny,
      `Refused: ${input.preview.replace(/\?$/, '')}. Your rule: ${rules.deny.words}`,
      ctx,
      true,
    )
    return { pass: false, card: null, reason: refusedBy(rules.deny), rule: rules.deny }
  }
  const noticed = rules.noticed
  let gate = gateOf(input)
  if (!gate && noticed?.side === 'deny') {
    // what Alpha noticed is followed where little is at stake, and asked about where it is not
    const low = facts.effect === 'read' || (doesOf(facts) === 'change' && !facts.own)
    if (low) {
      world.rules.used(
        noticed,
        `Did not ${input.preview.replace(/\?$/, '').toLowerCase()}: Alpha noticed “${noticed.words}”`,
        ctx,
        true,
      )
      return {
        pass: false,
        card: null,
        reason: `Not done: Alpha noticed the person keeps to “${noticed.words}” Say so in a line; they can approve or dismiss it in Governance.`,
        rule: noticed,
      }
    }
    gate = 'noticed'
  }
  if (!gate) return { pass: true }
  if (rules.allow) {
    world.rules.used(rules.allow, `Allowed by your rule: ${input.preview.replace(/\?$/, '')}`, ctx)
    return { pass: true }
  }
  const yes = world.cards.useYes(input.call, config.limits().yes_hours)
  if (yes) return { pass: true, card: yes }
  const card = world.cards.open({
    kind: 'permission',
    gate,
    options: [input.yes ?? YES[gate], 'Not now'],
    words: input.preview,
    detail: input.detail ?? null,
    restsOn: [
      ...(input.restsOn ?? []),
      ...(noticed
        ? [
            `Alpha noticed you ${noticed.side === 'deny' ? 'may not want this' : 'usually allow this'}: “${noticed.words}”`,
          ]
        : []),
    ],
    cannotUndo: input.cannotUndo ?? null,
    call: input.call,
    actor: input.actor,
    user: input.user ?? null,
    turn: input.turn ?? null,
    module: input.module ?? null,
  })
  return { pass: false, card, reason: WAITS }
}
