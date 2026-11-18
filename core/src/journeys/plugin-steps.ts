// A journey's plugins and the person's steps on them: the plugins its Alpha has switched on, as
// alpha.yaml's plugins line names them (rules P1); a button on a plugin's screen pressed, or the
// screen read, through the plugin's own routes as the window calls them; and an interview answered
// card by card as the person answers it, by the first of the journey's answers that fits each card.
import { basename } from 'node:path'
import { z } from 'zod'
import type { CardView } from '../api/card-types.ts'
import type { buildServer } from '../api/server.ts'
import type { Engine } from '../engine/engine.ts'
import { cardAgent } from '../modules/agent-marks.ts'
import { loadPlugins, PLUGINS_DIR, type PluginDeps, Plugins } from '../plugins/plugins.ts'
import type { User, World } from '../world/world.ts'

export const PluginPress = z.object({
  name: z.string(),
  get: z.string().optional(), // a screen read: what Home shows of it, say
  post: z.string().optional(), // a button pressed: start, not-now, finish
  body: z.record(z.string(), z.unknown()).optional(),
})

export const Interview = z.object({
  agent: z.string(), // the agent whose cards are answered, in its own chat
  // the first answer whose card fits takes it: a choice, or the person's own words in the card's
  // box ({site} said as the made-up site); on a card of lines, the first so many dropped and the
  // rest kept (every line kept when no answer says); with times, only the first so many it fits
  answers: z.array(
    z.object({
      card: z.string(), // words on the card or its detail, as a pattern
      choice: z.string().optional(),
      drop: z.number().optional(),
      times: z.number().optional(),
    }),
  ),
  otherwise: z.string().default('None of these'),
  // the step ends at the first card that fits this, leaving it waiting for the next step
  until: z.string().optional(),
  // cards answered before the step gives up: an interview that never settles fails the journey
  // rather than running on (the runner's own bound, never the person's)
  at_most: z.number().default(60),
})

export interface Switched {
  plugins: Plugins
  problems: string[] // what kept a named plugin from loading, in words
}

// The plugins named, loaded and given their hosts; one not named does not load at all.
export async function switchOn(names: string[], deps: PluginDeps): Promise<Switched> {
  const plugins = new Plugins(deps)
  if (!names.length) return { plugins, problems: [] }
  const found = await loadPlugins(PLUGINS_DIR)
  const named = found.plugins.filter((l) => names.includes(l.plugin.name))
  const problems = found.failed
    .filter((f) => names.includes(basename(f.folder)))
    .map((f) => `The plugin in ${f.folder} did not load: ${f.why}`)
  for (const n of names)
    if (!named.some((l) => l.plugin.name === n) && !problems.some((p) => p.includes(`/${n}`)))
      problems.push(`There is no plugin called ${n} in plugins/ to switch on.`)
  for (const f of await plugins.register(named))
    problems.push(`The plugin in ${f.folder} did not register: ${f.why}`)
  return { plugins, problems }
}

const HEADERS = { host: '127.0.0.1:4700', 'x-alpha-token': 'journey' }
type App = ReturnType<typeof buildServer>

// A button pressed or a screen read. A button that is not there fails the journey; a screen that
// is not there is said, and judged by the step's checks (an Alpha without the plugin has none).
export async function press(
  app: App,
  step: z.infer<typeof PluginPress>,
): Promise<{ ok: boolean; what: string }> {
  const path = (step.post ?? step.get ?? '').replace(/^\//, '')
  const url = `/api/plugins/${step.name}/${path}`
  const res = await app.inject({
    method: step.post ? 'POST' : 'GET',
    url,
    headers: HEADERS,
    ...(step.post ? { payload: step.body ?? {} } : {}),
  })
  const there = res.statusCode < 400
  if (step.post)
    return there
      ? { ok: true, what: `Pressed ${path} on ${step.name}'s screen` }
      : {
          ok: false,
          what: `**${step.name} has no ${path} to press (${res.statusCode}: ${problemOf(res.body)}).**`,
        }
  return {
    ok: true,
    what: there
      ? `Opened ${step.name}'s ${path}: ${res.body.slice(0, 300)}`
      : `Opened ${step.name}'s ${path}: not there (${res.statusCode})`,
  }
}

const problemOf = (body: string) => {
  try {
    return (JSON.parse(body) as { problem?: string; message?: string }).problem ?? body
  } catch {
    return body.slice(0, 200)
  }
}

export interface InterviewHere {
  world: World
  user: User
  engine: Engine
  app: () => App
  limit: number // how long one answer's turn may take, as a step may
  site: string | null
}

// Each card the agent raises, answered as it comes, until it raises none after its turn.
export async function interview(
  step: z.infer<typeof Interview>,
  h: InterviewHere,
): Promise<{ ok: boolean; what: string }> {
  const agent = h.world.agents.byName(step.agent)
  if (!agent)
    return { ok: false, what: `**There is no agent ${step.agent} to be interviewed by.**` }
  const used = new Map<number, number>()
  const said: string[] = []
  const words = (w: string) => (h.site ? w.replaceAll('{site}', h.site) : w)
  for (let n = 0; n < step.at_most; n++) {
    await settle(h)
    const card = h.world.cards.waiting(h.user.id).find((c) => cardAgent(c) === agent.id)
    if (!card) {
      const answered = `Answered ${n} card${n === 1 ? '' : 's'} from ${step.agent}`
      return { ok: true, what: said.length ? `${answered}: ${said.join('; ')}` : answered }
    }
    const text = `${card.words}\n${card.detail ?? ''}`
    if (step.until && new RegExp(step.until, 'i').test(text)) {
      said.push(`stopped at “${card.words}”, left waiting`)
      return {
        ok: true,
        what: `Answered ${n} card${n === 1 ? '' : 's'} from ${step.agent}: ${said.join('; ')}`,
      }
    }
    const at = step.answers.findIndex(
      (a, i) => new RegExp(a.card, 'i').test(text) && (a.times ?? Infinity) > (used.get(i) ?? 0),
    )
    const answer = step.answers[at]
    if (at >= 0) used.set(at, (used.get(at) ?? 0) + 1)
    const shown = card.words.length > 90 ? `${card.words.slice(0, 89)}…` : card.words
    const done = turnEnds(h)
    if (answer?.drop !== undefined || card.kind === 'review') {
      const out = await lines(h.app(), card.id, answer?.drop ?? 0)
      if (!out.ok) return { ok: false, what: `${said.join('; ')}; **${out.what}**` }
      said.push(`“${shown}”: ${out.what}`)
    } else {
      const choice = words(answer?.choice ?? step.otherwise)
      h.engine.answer(h.user, card.id, choice, false)
      said.push(`“${shown}”: ${choice}`)
    }
    if (!(await done))
      return { ok: false, what: `${said.join('; ')}; **the turn did not finish.**` }
  }
  return {
    ok: false,
    what: `${said.join('; ')}; **${step.agent} was still asking after ${step.at_most} cards.**`,
  }
}

const pause = (ms: number) => new Promise((ok) => setTimeout(ok, ms))

// The agent's turn, and the asks it made of others, ended.
async function settle(h: InterviewHere): Promise<void> {
  for (let w = 0; w < 3000 && h.engine.working(h.user); w++) await pause(200)
}

// The turn an answer started has ended: the engine said so, or nothing has been working for a few
// seconds (an answer on a card of lines may start none); false once it has run past the limit.
export function turnEnds(h: Pick<InterviewHere, 'engine' | 'user' | 'limit'>): Promise<boolean> {
  return new Promise((resolve) => {
    let quiet = 0
    const by = Date.now() + h.limit
    const end = (ok: boolean) => {
      clearInterval(tick)
      h.engine.events.off('event', on)
      resolve(ok)
    }
    const on = (e: { type: string; user: string }) => {
      if (e.type === 'idle' && e.user === h.user.id) end(true)
    }
    const tick = setInterval(() => {
      quiet = h.engine.working(h.user) ? 0 : quiet + 1
      if (quiet >= 6) end(true)
      else if (Date.now() > by) end(false)
    }, 500)
    h.engine.events.on('event', on)
  })
}

// A card of lines, each kept or dropped as the person does: the first so many dropped, the rest
// kept, through the card's own route.
async function lines(app: App, card: string, drop: number): Promise<{ ok: boolean; what: string }> {
  const shown = await app.inject({ url: `/api/cards/${card}`, headers: HEADERS })
  const view = shown.json() as CardView
  const review = view.review
  if (shown.statusCode !== 200 || !review)
    return { ok: false, what: 'The card has no lines to keep or drop.' }
  const keep = review.choices[0] ?? 'Keep'
  const dropAs = review.choices.find((c) => /drop/i.test(c))
  if (!dropAs) return { ok: false, what: `The card's lines offer no Drop: ${review.choices}.` }
  const dropped = review.rows.slice(0, drop)
  const post = (rows: string[] | 'rest', value: string) =>
    app.inject({
      method: 'POST',
      url: `/api/cards/${card}/rows`,
      headers: HEADERS,
      payload: { rows, value },
    })
  if (dropped.length)
    await post(
      dropped.map((r) => r.id),
      dropAs,
    )
  await post('rest', keep)
  const names = (rs: { name: string }[]) => rs.map((r) => `“${r.name}”`).join(', ')
  return {
    ok: true,
    what: `dropped ${names(dropped) || 'none'}, kept ${names(review.rows.slice(drop)) || 'none'}`,
  }
}
