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
  whatAt,
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
export const HAND = 'browse.hand' // the card that asks the person onto a page the agent cannot pass
export const ACT_ON_SITE = 'act_on_site' // what Always covers: an agent, a site, a person

type Point = { x: number; y: number }
export type Step =
  | { kind: 'free' }
  | { kind: 'act'; host: string; words: string; n?: Ref; at?: Point }
  | { kind: 'each'; host: string; words: string; button: string; n?: Ref; at?: Point }

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
  if (action === 'click') {
    if (n !== undefined)
      return what ? clickStep(host, what, dialogOf(page, n), n) : { kind: 'free' }
    // a click by its position in the picture: judged by what is at that place
    if (typeof input.x !== 'number' || typeof input.y !== 'number') return { kind: 'free' }
    const point = { x: input.x, y: input.y }
    const there = await whatAt(page, point)
    const step = clickStep(host, there.what, there.dialog)
    return step.kind === 'free' ? step : { ...step, at: point }
  }
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
  // the person has taken the page over: nothing of the agent's reaches it until they hand it back
  if (input.action !== 'read' && browser.as(user.id).holding(tab, true))
    return { allow: false, reason: HELD }
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
  const picture = world.files.keepPicture(await outlined(page, step.n, step.at))
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

// What the model reads when its step met a page the person has taken over.
export const HELD =
  'The person has taken over this page in their window, so this step was not done. Do nothing more on the page now: end your turn in a line saying you wait for them. You carry on when they hand it back.'

// The agent asks the person onto a page it cannot pass by itself (a check that a person is there, a
// code on their phone, a choice that is theirs): a card whose button opens the live picture of the
// work's tab. The work on that page waits; it goes on when they hand the page back.
export async function handOver(
  world: World,
  browser: BrowserEngine,
  cur: TurnContext,
  user: User,
  actor: Actor,
  why: string,
): Promise<Card> {
  const agent = cur.agent ?? CHIEF
  const parts = { agent, work: workOf(cur) }
  const had = world.cards.waitingFor(HAND, parts)
  if (had) return had
  const page = await browser.as(user.id).tab(tabOf(cur))
  const site = new URL(page.url()).host
  const task = taskOfTurn(cur.turn)
  const title = task ? world.tasks.get(task)?.title : null
  return world.cards.open({
    kind: 'permission',
    gate: 'leaves_world',
    words: `${agentName(world, agent)} needs you on ${site}`,
    detail: `${why.trim().replace(/[.\s]+$/, '')}. Open the page to see it and take over; hand it back when you are done, and the work goes on.`,
    options: ['Open the page', 'Not now'],
    restsOn: title
      ? [`the task “${title}”`]
      : cur.message
        ? [`your message: “${cur.message}”`]
        : [],
    call: {
      tool: HAND,
      input: {
        ...parts,
        site,
        tab: tabOf(cur),
        picture: world.files.keepPicture(await outlined(page)),
      },
    },
    actor,
    user: user.id,
    turn: cur.turn,
  })
}

// How long the person had a page, in words.
const lasted = (ms: number) => (ms < 90_000 ? 'a minute' : `${Math.round(ms / 60_000)} minutes`)

// The person handed a page back: the record says only that they had it and for how long, never
// what they did there. The card that asked them onto it is answered, so its work goes on; else, if
// the agent's step waited on the page meanwhile, the agent is told to carry on.
export function handedBack(
  world: World,
  tab: string,
  site: string,
  had: { ms: number; waited: boolean },
  user: User,
): { card: Card | null; agent: string; work: string; text: string | null } {
  const agent = tab.slice(0, tab.indexOf('.'))
  const work = tab.slice(tab.indexOf('.') + 1)
  world.line({
    actor: { kind: 'person', id: user.id },
    kind: 'took_over',
    words: `You took over ${site} from ${agentName(world, agent)} for ${lasted(had.ms)}.`,
    data: { agent, site, ms: had.ms },
    user: user.id,
    agent: agent === CHIEF ? null : agent,
  })
  const text = `The person took over the page on ${site} for ${lasted(had.ms)} and has handed it back. What they did there is theirs and is not recorded. Look at the page as it is now (browse find, or picture) before any step, then carry on with what they asked, or say what is left.`
  return {
    card: world.cards.waitingFor(HAND, { agent, work }) ?? null,
    agent,
    work,
    text: had.waited ? text : null,
  }
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
): { picture: string | null; always: string | null; watch: string | null } | null {
  const tool = card.call?.tool
  if (tool !== ACT && tool !== PRESS && tool !== HAND) return null
  const i = card.call?.input as { agent: string; site: string; picture?: string; tab?: string }
  const offered =
    tool === ACT &&
    card.state === 'waiting' &&
    !!card.user &&
    world.rules.offers(coveredBy(i.agent, i.site, card.user))
  return {
    picture: i.picture ?? null,
    always: offered ? `Always: ${sentence(world, i.agent, i.site)}` : null,
    watch: tool === HAND && card.state === 'waiting' ? (i.tab ?? null) : null,
  }
}
