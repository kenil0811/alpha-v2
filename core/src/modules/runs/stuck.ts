// Agents that did not finish, on one card per module (Vikas, 30 Oct: "why are we not combining
// them into a single thing telling 'I tried 10 things and it didn't run'?"): each agent with its
// reason in words, Try again all or Leave all, and Try again or Leave it on each. A new failure in
// the module joins the card that waits rather than open another.

import type { Card } from '../../world/cards.ts'
import type { Actor } from '../../world/journal.ts'
import { Refused } from '../../world/kinds.ts'
import type { AgentRunner } from './runner.ts'
import { RUN_AGAIN, type RunFor } from './types.ts'

export interface Stuck {
  agent: string
  name: string
  cursor: string | null // where the journal stood, for Leave it
  words: string // why, in words: its last run's
  times: number
}

// The agents a card holds. A card from before 30 Oct held one agent, its reason in its words.
export function stuckOn(c: Card | undefined): Stuck[] {
  if (c?.call?.tool !== RUN_AGAIN) return []
  const input = c.call.input as { agents?: Stuck[]; agent?: string; cursor?: string | null }
  if (input.agents) return input.agents
  if (!input.agent) return []
  const name = c.words.split(' did not finish')[0] ?? 'An agent'
  const words = c.words.replace(/^.*? did not finish \d+ times: /, '')
  return [{ agent: input.agent, name, cursor: input.cursor ?? null, words, times: 3 }]
}

// Why, in plain words (design: no tool names): a run's own words without the agent's name, and the
// browser's errors said as what happened.
const PLAIN: [RegExp, string][] = [
  [
    /ERR_INTERNET_DISCONNECTED|ERR_NAME_NOT_RESOLVED|ERR_ADDRESS_UNREACHABLE/,
    'the Mac was offline',
  ],
  [/ERR_NETWORK_IO_SUSPENDED|ERR_NETWORK_CHANGED/, 'the Mac went to sleep'],
  [/ERR_TIMED_OUT|ERR_CONNECTION_TIMED_OUT|Timeout \d+ms exceeded/, 'the site took too long'],
  [/ERR_CONNECTION_REFUSED|ERR_CONNECTION_RESET|ERR_CONNECTION_CLOSED/, 'the site did not answer'],
  [/was stopped at (\d+) minutes?, its budget/, 'it ran past its $1 minutes'],
]
export function reasonOf(name: string, words: string): string {
  const prefix = `${name} did not finish: `
  const own = words.startsWith(prefix)
    ? words.slice(prefix.length)
    : words.startsWith(`${name} `)
      ? words.slice(name.length + 1)
      : words
  for (const [re, said] of PLAIN) {
    const m = re.exec(own)
    if (m) return said.replace('$1', m[1] ?? '')
  }
  return own.replace(/\.$/, '')
}

// "North Ledger, Harbor, Kestrel and 12 more"
function named(list: Stuck[]): string {
  const names = list.map((s) => s.name)
  if (names.length <= 3) return names.join(', ').replace(/, ([^,]*)$/, ' and $1')
  return `${names.slice(0, 3).join(', ')} and ${names.length - 3} more`
}

function shapeOf(list: Stuck[]) {
  const one = list.length === 1 ? list[0] : undefined
  return {
    words: one
      ? `${one.name} did not finish ${one.times} times: ${reasonOf(one.name, one.words)}`
      : `${list.length} agents did not finish: ${named(list)}`,
    options: one ? ['Try again', 'Leave it'] : ['Try again all', 'Leave all'],
    call: { tool: RUN_AGAIN, input: { agents: list } },
    restsOn: list.map((s) => `${s.name}'s last ${s.times} runs`),
  }
}

const waitingIn = (runner: AgentRunner, module: string): Card | undefined =>
  runner.world.cards.waiting().find((c) => c.call?.tool === RUN_AGAIN && c.module === module)

// An agent past its runs that did not finish: onto its module's waiting card, or a new one, and
// held until the person decides.
export function holdStuck(runner: AgentRunner, module: string, entry: Stuck, by: Actor): Card {
  const waiting = waitingIn(runner, module)
  const list = [...stuckOn(waiting).filter((s) => s.agent !== entry.agent), entry]
  const card = waiting
    ? runner.world.cards.amend(waiting.id, shapeOf(list), by, `${entry.name}: ${entry.words}`)
    : runner.world.cards.open({
        kind: 'suggestion',
        ...shapeOf(list),
        actor: by,
        user: runner.owner,
        module,
      })
  runner.held.set(entry.agent, card.id)
  return card
}

// After a restart the runner's memory is empty: the waiting cards say who is held. Cards of one
// module from before 30 Oct, one an agent, become the one card.
export function rehold(runner: AgentRunner): void {
  const byModule = new Map<string, Card>()
  for (const c of runner.world.cards.waiting()) {
    if (c.call?.tool !== RUN_AGAIN) continue
    const into = c.module ? byModule.get(c.module) : undefined
    if (into) {
      const list = [
        ...stuckOn(into),
        ...stuckOn(c).filter((s) => !stuckOn(into).some((x) => x.agent === s.agent)),
      ]
      const by = { kind: 'system' as const }
      const joined = runner.world.cards.amend(
        into.id,
        shapeOf(list),
        by,
        `${named(stuckOn(c))} joined`,
      )
      runner.world.cards.withdraw(c.id, by, 'Joined the card of the agents that did not finish.')
      byModule.set(c.module as string, joined)
    } else if (c.module) byModule.set(c.module, c)
  }
  for (const c of byModule.values()) for (const s of stuckOn(c)) runner.held.set(s.agent, c.id)
}

// The person's word on one agent of the card, or on all of it (agent null): Try again runs them
// one after another, Leave it moves on as if they had run. The card keeps the rest, or closes.
export function settleStuck(
  runner: AgentRunner,
  cardId: string,
  agent: string | null,
  again: boolean,
  who: RunFor,
  by: Actor,
): Card {
  const card = runner.world.cards.get(cardId)
  if (card?.state !== 'waiting') throw new Refused('That card has already been answered.')
  const list = stuckOn(card)
  const chosen = agent ? list.filter((s) => s.agent === agent) : list
  if (!chosen.length) throw new Refused('That agent is not on this card any more.')
  if (again)
    void (async () => {
      for (const s of chosen) await runner.retry(s.agent, who).catch(() => undefined)
    })()
  else for (const s of chosen) runner.leave(s.agent, s.cursor)
  const rest = list.filter((s) => !chosen.includes(s))
  const said = `${again ? 'Try again' : 'Leave it'}: ${named(chosen)}`
  if (rest.length) return runner.world.cards.amend(cardId, shapeOf(rest), by, said)
  const answer = agent ? (again ? 'Try again' : 'Leave it') : (card.options[again ? 0 : 1] ?? '')
  return runner.world.cards.answer(cardId, answer, by, said)
}

// What the window shows of each agent on the card.
export const stuckView = (c: Card) =>
  c.call?.tool === RUN_AGAIN
    ? stuckOn(c).map((s) => ({
        agent: s.agent,
        name: s.name,
        words: reasonOf(s.name, s.words),
        times: s.times,
      }))
    : null
