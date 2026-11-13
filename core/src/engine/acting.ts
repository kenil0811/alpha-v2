// Acting in the browser (docs/rules.md L2): which of an agent's browse steps put something into a
// site, and what the person is asked. Reading, moving around and clicking ask nothing. Typing,
// choosing, keys that type, Enter in a form and a button that sends to other people (Share, Post)
// are acting: asked once per agent, site and piece of work, and the yes holds for that work, within
// its hours. A button or dialog that cannot be taken back (Pay, Delete forever) asks every time.
// Code decides which a step is before it runs, from the action and the element in the page's last
// view; the lists of words are core/config/words.yaml.
import {
  type BrowserEngine,
  dialogOf,
  focused,
  outlined,
  type Ref,
  said,
} from '@alpha/connector-sdk'
import { config } from '../config.ts'
import { refusedBy, WAITS } from '../gates/gates.ts'
import { CHIEF, CHIEF_CARD } from '../world/agents/index.ts'
import type { Card } from '../world/cards.ts'
import type { Actor } from '../world/journal.ts'
import type { Covered } from '../world/rules.ts'
import { taskOfTurn } from '../world/tasks/types.ts'
import type { User, World } from '../world/world.ts'
import type { TurnContext } from './tools/common.ts'

export const ACT = 'browse.act' // the card for acting on a site, for a piece of work
export const PRESS = 'browse.press' // the card for one step that cannot be taken back
export const ACT_ON_SITE = 'act_on_site' // what Always covers: an agent, a site, a person

export type Step =
  | { kind: 'free' }
  | { kind: 'act'; host: string; words: string; n?: Ref }
  | { kind: 'each'; host: string; words: string; button: string; n?: Ref }

// The piece of work a turn serves: its task, or the person's one request in a conversation. A tab
// and a yes are that work's, and each agent on it has a tab of its own.
export function workOf(cur: TurnContext): string {
  const task = taskOfTurn(cur.turn)
  return task ? `task:${task}` : (cur.root ?? cur.turn ?? 'chat')
}
export const tabOf = (cur: TurnContext): string => `${cur.agent ?? CHIEF}.${workOf(cur)}`

// Whether words hold one of a list's entries as whole words; "sign" leaves out sign in, up and out.
export function says(list: string[], words: string): boolean {
  const text = words.replace(/\bsign (?:in|up|out)\b/gi, '')
  const any = list.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s+'))
  return new RegExp(`\\b(?:${any.join('|')})\\b`, 'i').test(text)
}

const nameOf = (what: string) => /"([^"]*)"/.exec(what)?.[1] ?? what
const short = (v: string, n = 120) => (v.length > n ? `${v.slice(0, n - 1)}…` : v)
// Keys that only move: around the page, between its boxes, out of a menu.
const MOVES =
  /^(?:(?:Shift|Control|Meta|Alt|ControlOrMeta)\+)*(?:Arrow(?:Up|Down|Left|Right)|Home|End|PageUp|PageDown|Tab|Escape)$/

// What a click on an element is, from what the page's last view said it is and the dialog it is in.
export function clickStep(host: string, what: string, dialog: string, n?: Ref): Step {
  if (!/^(?:button|menuitem)\b/.test(what)) return { kind: 'free' }
  const words = config.words()
  const name = nameOf(what)
  const at = n === undefined ? {} : { n }
  if (says(words.browse_each_time, name))
    return { kind: 'each', host, button: name, words: `Press ${name}`, ...at }
  if (dialog && says(words.browse_each_time, dialog))
    return { kind: 'each', host, button: `${name} in “${dialog}”`, words: `Press ${name}`, ...at }
  if (says(words.browse_acts, name)) return { kind: 'act', host, words: `Press ${name}`, ...at }
  return { kind: 'free' }
}

// What pressing keys is, from the keys and what has them: its own words, its dialog's, whether it
// takes text or sits in a form.
export function keyStep(
  host: string,
  keys: string,
  on: { editable: boolean; words: string; dialog: string },
): Step {
  if (MOVES.test(keys)) return { kind: 'free' }
  if (!/^(?:Enter|Space)$/.test(keys)) return { kind: 'act', host, words: `Press ${keys}` }
  const words = config.words()
  if (says(words.browse_each_time, on.words) || says(words.browse_each_time, on.dialog))
    return {
      kind: 'each',
      host,
      button: on.words || `${keys} in “${on.dialog}”`,
      words: `Press ${keys}`,
    }
  return on.editable || says(words.browse_acts, on.words)
    ? { kind: 'act', host, words: `Press ${keys}` }
    : { kind: 'free' }
}

// What a browse step is, before it runs.
export async function stepOf(
  browser: BrowserEngine,
  tab: string,
  input: Record<string, unknown>,
): Promise<Step> {
  const action = input.action
  if (action !== 'type' && action !== 'choose' && action !== 'click' && action !== 'key')
    return { kind: 'free' }
  // no page in this work yet: the tool says so
  const page = await browser.tab(tab).catch(() => null)
  if (!page) return { kind: 'free' }
  const host = new URL(page.url()).host
  const n = typeof input.n === 'number' || typeof input.n === 'string' ? input.n : undefined
  const what = n === undefined ? '' : said(page, n)
  const at = n === undefined ? {} : { n }
  if (action === 'type')
    return {
      kind: 'act',
      host,
      words: `Type “${short(String(input.text ?? ''))}” ${what ? `into ${what}` : 'where the cursor is'}${input.enter ? ', then press Enter' : ''}`,
      ...at,
    }
  if (action === 'choose')
    return {
      kind: 'act',
      host,
      words: `Choose “${short(String(input.option ?? ''))}” in ${what || 'a list'}`,
      ...at,
    }
  if (action === 'click')
    return n === undefined || !what ? { kind: 'free' } : clickStep(host, what, dialogOf(page, n), n)
  return keyStep(host, String(input.keys ?? ''), await focused(page))
}

const agentName = (world: World, id: string) =>
  id === CHIEF ? CHIEF_CARD.name : (world.agents.get(id)?.name ?? id)

// What an Always for acting covers: this agent, on this site, as this person.
export const coveredBy = (agent: string, site: string, user: string): Covered => ({
  action: ACT_ON_SITE,
  schedule: null,
  module: null,
  place: { agent, site, user },
})
export const sentence = (world: World, agent: string, site: string) =>
  `${agentName(world, agent)} may act on ${site} as you without asking`

// A browse step put to the person: free steps pass; a deny rule on the site refuses; an Always or
// a yes that holds for this agent, site and work lets acting through; otherwise a card, with the
// page's picture and the step.
export async function judgeStep(
  world: World,
  browser: BrowserEngine,
  cur: TurnContext,
  user: User,
  actor: Actor,
  input: Record<string, unknown>,
): Promise<{ allow: true; card?: Card } | { allow: false; reason: string }> {
  const tab = tabOf(cur)
  const step = await stepOf(browser.as(user.id), tab, input)
  if (step.kind === 'free') return { allow: true }
  const agent = cur.agent ?? CHIEF
  const name = agentName(world, agent)
  const work = workOf(cur)
  const ctx = { actor, user: user.id, turn: cur.turn }
  const deny = world.rules.judge({
    effect: 'outward',
    tool: 'browse',
    to: [],
    site: step.host,
    table: null,
    module: null,
    schedule: null,
    own: false,
  }).deny
  if (deny) {
    world.rules.used(
      deny,
      `Refused: ${step.words} on ${step.host}. Your rule: ${deny.words}`,
      ctx,
      true,
    )
    return { allow: false, reason: refusedBy(deny) }
  }
  const hours = config.limits().yes_hours
  const each = step.kind === 'each'
  const tool = each ? PRESS : ACT
  const parts: Record<string, string> = each
    ? { agent, site: step.host, work, button: step.button }
    : { agent, site: step.host, work }
  if (!each) {
    const always = world.rules.covering(coveredBy(agent, step.host, user.id))
    if (always) {
      world.rules.used(always, `Allowed by your rule: ${step.words} on ${step.host}`, ctx)
      return { allow: true }
    }
  }
  const yes = world.cards.yesFor(tool, parts, hours, each)
  if (yes) return { allow: true, card: yes }
  if (world.cards.waitingFor(tool, parts)) return { allow: false, reason: WAITS }
  const page = await browser.as(user.id).tab(tab)
  const picture = world.files.keepPicture(await outlined(page, step.n))
  const task = taskOfTurn(cur.turn)
  const title = task ? world.tasks.get(task)?.title : null
  world.cards.open({
    kind: 'permission',
    gate: 'leaves_world',
    words: each
      ? `Let ${name} press ${step.button} on ${step.host}?`
      : `Let ${name} act on ${step.host} as you?`,
    detail: each
      ? `${step.words}. This cannot be taken back, so it asks every time.`
      : `${step.words}. Your yes lets ${name} type and act on ${step.host} for the rest of this ${task ? 'task' : 'request'}.`,
    options: [each ? 'Press it' : 'Let it act', 'Not now'],
    restsOn: title
      ? [`the task “${title}”`]
      : cur.message
        ? [`your message: “${cur.message}”`]
        : [],
    cannotUndo: `${step.host} keeps what is done there; Revert cannot undo it.`,
    call: { tool, input: { ...parts, step: step.words, picture } },
    actor,
    user: user.id,
    turn: cur.turn,
  })
  return { allow: false, reason: WAITS }
}

// The person's answer on an acting card counts toward Always for that agent on that site; with
// Always, the standing permission is given.
export function answered(world: World, card: Card, always: boolean, user: User): void {
  if (card.call?.tool !== ACT || (card.state !== 'yes' && card.state !== 'no')) return
  const { agent, site } = card.call.input as { agent: string; site: string }
  const covered = coveredBy(agent, site, user.id)
  const ctx = { actor: { kind: 'person', id: user.id } as Actor, user: user.id }
  world.rules.decided(covered, { yes: card.state === 'yes', changed: false, card: card.id }, ctx)
  if (always && card.state === 'yes')
    world.rules.grant(covered, sentence(world, agent, site), { ...ctx, card: card.id })
}

// What an acting card shows beside its words: the page's picture, and Always when it is offered.
export function actingView(
  world: World,
  card: Card,
): { picture: string | null; always: string | null } | null {
  if (card.call?.tool !== ACT && card.call?.tool !== PRESS) return null
  const i = card.call.input as { agent: string; site: string; picture?: string }
  const offered =
    card.call.tool === ACT &&
    card.state === 'waiting' &&
    !!card.user &&
    world.rules.offers(coveredBy(i.agent, i.site, card.user))
  return {
    picture: i.picture ?? null,
    always: offered ? `Always: ${sentence(world, i.agent, i.site)}` : null,
  }
}
