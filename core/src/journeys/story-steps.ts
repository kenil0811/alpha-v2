// A journey's steps through Set up Alpha (the onboarding redesign of 22 Nov), pressed through the
// story's own routes as the window calls them, never through a chat: a chapter's act or its Skip,
// the chapters skipped up to one, and What I learned answered as the person answers it, by the
// first of the journey's answers that fits each question or playback. And its checks: where a
// person's story stands and what a chapter's screen says, read from those routes.
//
// The routes the journeys hold the build to (steps 2 to 5 of the plan build them):
//   GET  /api/story            { chapters: [{ key, title, state }], at, done, row }   the person's
//   GET  /api/story/<chapter>  the chapter's screen: { key, title, says, words, ... }
//   POST /api/story/<chapter>  its act (a body as the chapter takes it), then on to the next
//   POST /api/story/<chapter>/skip
//   GET  /api/story/learned    { drafting, question: { id, words, options } | null,   (also
//                                about: [{ id, line, decided }], playbacks: [{ id, words,   questions
//                                choices, decided }] }                                       and plate)
//   POST /api/story/learned    { about: { drop: [ids], keep: 'rest' } } | { read: { off } } | {}
//   POST /api/story/questions  { answer: { id, choice } } | {} to go on
//   POST /api/story/plate      { playback: { id, choice } } | {} to go on
// Steps, on one page: the owner's welcome, workspace, claude (only while
// no model is set), computer, connect, people, then learned, questions and plate (interviews on),
// done; a member's welcome, here, computer, connect, learned, questions, plate, done. A step
// pressed on with nothing on it is skipped, never done.
import { z } from 'zod'
import type { buildServer } from '../api/server.ts'
import { cardAgent } from '../modules/agent-marks.ts'
import type { User, World } from '../world/world.ts'
import { AS_WINDOW as HEADERS } from './headers.ts'

export const StoryPress = z.object({
  as: z.string().optional(), // a member by their name; none is the owner
  chapter: z.string().optional(), // the chapter whose act is pressed
  body: z.record(z.string(), z.unknown()).optional(), // what the person gives it
  skip: z.boolean().optional(), // its Skip instead
  refused: z.boolean().optional(), // the press is expected to be refused (Claude's Skip while no model is set)
  skip_to: z.string().optional(), // every chapter before this one skipped, in order
  // What I learned: the first answer whose pattern fits a question or a playback takes it; About
  // you's first so many lines dropped and the rest kept; with times, only the first so many
  answers: z
    .array(z.object({ match: z.string(), choice: z.string(), times: z.number().optional() }))
    .optional(),
  drop: z.number().optional(),
  otherwise: z.string().default('None of these'),
  at_most: z.number().default(40), // the runner's own bound, never the person's
})

// A member added by the owner, as Settings › People and the Your people chapter add one.
export const MemberAdd = z.object({ name: z.string(), email: z.string() })

export const StoryChecks = [
  // where the person's story stands: its chapters in order, where it is, done, the Home row
  z.object({
    story: z.object({
      as: z.string().optional(),
      chapters: z.array(z.string()).optional(),
      at: z.string().nullable().optional(),
      done: z.boolean().optional(),
      row: z.string().nullable().optional(), // Home's row: words in it, or null for none
    }),
  }),
  // what waits on the person in Needs you: so many cards, or so many from one agent
  z.object({ needs_you: z.object({ count: z.number(), from: z.string().optional() }) }),
  // what a chapter's screen says, and what it never says
  z.object({
    story_says: z.object({
      as: z.string().optional(),
      chapter: z.string(),
      matches: z.string().optional(),
      never: z.string().optional(),
    }),
  }),
] as const

type App = ReturnType<typeof buildServer>
export interface StoryHere {
  world: World
  owner: User
  app: (as?: string) => App // the window's routes as the owner, or as a member by name
  limit: number // how long the model's draft may take, as a step may
  fill: (s: string) => string // {site}, {claude} and the like, as the journey says them
}

interface StoryView {
  chapters: { key: string; title: string; state: string }[]
  at: string | null
  done: boolean
  row: string | null
}

const filled = (v: unknown, fill: (s: string) => string): unknown =>
  typeof v === 'string'
    ? fill(v)
    : Array.isArray(v)
      ? v.map((x) => filled(x, fill))
      : v && typeof v === 'object'
        ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, filled(x, fill)]))
        : v

async function get<T>(
  app: App,
  url: string,
): Promise<{ status: number; body: T | null; raw: string }> {
  const res = await app.inject({ url, headers: HEADERS })
  let body: T | null = null
  try {
    body = res.json() as T
  } catch {
    body = null
  }
  return { status: res.statusCode, body, raw: res.body }
}

async function post(app: App, url: string, payload: unknown) {
  const res = await app.inject({ method: 'POST', url, headers: HEADERS, payload: payload ?? {} })
  return { ok: res.statusCode < 400, status: res.statusCode, raw: res.body }
}

const problem = (raw: string) => {
  try {
    return (JSON.parse(raw) as { problem?: string }).problem ?? raw.slice(0, 200)
  } catch {
    return raw.slice(0, 200)
  }
}

// A chapter's act, its Skip, the chapters skipped up to one, or What I learned answered.
export async function storyStep(
  step: z.infer<typeof StoryPress>,
  h: StoryHere,
): Promise<{ ok: boolean; what: string }> {
  const app = h.app(step.as)
  const who = step.as ?? 'The owner'
  if (step.skip_to) {
    const skipped: string[] = []
    for (let n = 0; n < 12; n++) {
      const s = await get<StoryView>(app, '/api/story')
      if (!s.body || s.status >= 400)
        return { ok: false, what: `**${who} has no story to go through (${s.status}).**` }
      if (s.body.done || s.body.at === step.skip_to || !s.body.at) break
      const out = await post(app, `/api/story/${s.body.at}/skip`, {})
      if (!out.ok)
        return { ok: false, what: `**${s.body.at} could not be skipped: ${problem(out.raw)}.**` }
      skipped.push(s.body.at)
    }
    return {
      ok: true,
      what: `${who} skipped ${skipped.join(', ') || 'nothing'} to ${step.skip_to}`,
    }
  }
  if (!step.chapter) return { ok: false, what: '**A story step names no chapter.**' }
  if (
    ['learned', 'questions', 'plate'].includes(step.chapter) &&
    (step.answers || step.drop !== undefined)
  )
    return learned(step, app, h, who)
  const url = `/api/story/${step.chapter}${step.skip ? '/skip' : ''}`
  const out = await post(app, url, filled(step.body ?? {}, h.fill))
  if (step.refused)
    return out.ok
      ? { ok: false, what: `**${who}'s ${step.chapter} was let through, not refused.**` }
      : { ok: true, what: `${who}'s ${step.chapter} was refused: ${problem(out.raw)}` }
  // what the person gave is not written in the report: a Claude token passes through here
  return out.ok
    ? { ok: true, what: `${who} ${step.skip ? 'skipped' : 'went through'} ${step.chapter}` }
    : {
        ok: false,
        what: `**${who} could not go through ${step.chapter} (${out.status}: ${problem(out.raw)}).**`,
      }
}

interface Learned {
  drafting: boolean
  problem?: string | null // why the last draft did not come
  question: { id: string; words: string; options: string[] } | null
  about: { id: string; line: string; decided: boolean }[]
  playbacks: { id: string; words: string; choices: string[]; decided: boolean }[]
}

const pause = (ms: number) => new Promise((ok) => setTimeout(ok, ms))

// The interview's three steps, in order, as the person goes through them: About you's lines on
// What I learned, then each question as it comes on A few questions, then each playback on Off your
// plate, going on from each before the next (a step opens only once the one before is through).
async function learned(
  step: z.infer<typeof StoryPress>,
  app: App,
  h: StoryHere,
  who: string,
): Promise<{ ok: boolean; what: string }> {
  const used = new Map<number, number>()
  const said: string[] = []
  const pick = (words: string) => {
    const at = (step.answers ?? []).findIndex(
      (a, i) => new RegExp(a.match, 'i').test(words) && (a.times ?? Infinity) > (used.get(i) ?? 0),
    )
    if (at >= 0) used.set(at, (used.get(at) ?? 0) + 1)
    return h.fill(step.answers?.[at]?.choice ?? step.otherwise)
  }
  const by = Date.now() + h.limit
  let problemSeen: string | null = null
  // a step's screen once its draft is written
  const screen = async (key: string): Promise<Learned | string> => {
    for (;;) {
      const v = await get<Learned>(app, `/api/story/${key}`)
      if (!v.body || v.status >= 400) return `**${who} has no ${key} to go through (${v.status}).**`
      if (!v.body.drafting) {
        if (v.body.problem) problemSeen = v.body.problem
        return v.body
      }
      if (Date.now() > by) return '**The draft was still being written.**'
      await pause(2000)
    }
  }
  const on = async (key: string) => {
    const out = await post(app, `/api/story/${key}`, {})
    return out.ok ? null : `**could not go on from ${key}: ${problem(out.raw)}**`
  }
  // What I learned
  const l = await screen('learned')
  if (typeof l === 'string') return { ok: false, what: l }
  const open = l.about.filter((x) => !x.decided)
  if (open.length) {
    const drop = open.slice(0, step.drop ?? 0).map((x) => x.id)
    await post(app, '/api/story/learned', { about: { drop, keep: 'rest' } })
    said.push(`About you: dropped ${drop.length}, kept ${open.length - drop.length}`)
  }
  const stuck = await on('learned')
  if (stuck) return { ok: false, what: `${said.join('; ')}; ${stuck}` }
  // A few questions, one at a time
  for (let n = 0; n < step.at_most; n++) {
    const v = await screen('questions')
    if (typeof v === 'string') return { ok: false, what: v }
    const q = v.question
    if (!q) break
    const choice = pick(q.words)
    const out = await post(app, '/api/story/questions', { answer: { id: q.id, choice } })
    if (!out.ok) return { ok: false, what: `**the answer was refused: ${problem(out.raw)}**` }
    said.push(`“${q.words.slice(0, 80)}”: ${choice}`)
  }
  const stuck2 = await on('questions')
  if (stuck2) return { ok: false, what: `${said.join('; ')}; ${stuck2}` }
  // Off your plate, each playback
  for (let n = 0; n < step.at_most; n++) {
    const v = await screen('plate')
    if (typeof v === 'string') return { ok: false, what: v }
    const p = v.playbacks.find((x) => !x.decided)
    if (!p) break
    const choice = pick(p.words)
    const out = await post(app, '/api/story/plate', { playback: { id: p.id, choice } })
    if (!out.ok)
      return { ok: false, what: `**the playback's answer was refused: ${problem(out.raw)}**` }
    said.push(`“${p.words.slice(0, 80)}”: ${choice}`)
  }
  const stuck3 = await on('plate')
  if (stuck3) return { ok: false, what: `${said.join('; ')}; ${stuck3}` }
  const failed = problemSeen ? ` (**the draft: ${problemSeen}**)` : ''
  return {
    ok: !failed,
    what: `${who} went through What I learned: ${said.join('; ') || 'nothing to answer'}${failed}`,
  }
}

type Saw = { check: string; ok: boolean; saw: string }

// The story's checks, read from its routes.
export async function storyCheck(check: unknown, h: StoryHere): Promise<Saw | null> {
  const c = check as Record<string, unknown>
  if ('story' in c) {
    const want = c.story as {
      as?: string
      chapters?: string[]
      at?: string | null
      done?: boolean
      row?: string | null
    }
    const s = await get<StoryView>(h.app(want.as), '/api/story')
    const v = s.status < 400 ? s.body : null
    const keys = v?.chapters?.map((x) => x.key) ?? []
    const ok =
      !!v?.chapters &&
      (!want.chapters || JSON.stringify(keys) === JSON.stringify(want.chapters)) &&
      (want.at === undefined || v.at === want.at) &&
      (want.done === undefined || v.done === want.done) &&
      (want.row === undefined ||
        (want.row === null ? !v.row : !!v.row && new RegExp(want.row, 'i').test(v.row)))
    const parts = [
      want.chapters && `chapters ${want.chapters.join(', ')}`,
      want.at !== undefined && `at ${want.at ?? 'none'}`,
      want.done !== undefined && (want.done ? 'done' : 'not done'),
      want.row !== undefined && (want.row === null ? 'no Home row' : `Home row /${want.row}/`),
    ].filter(Boolean)
    return {
      check: `${want.as ?? 'the owner'}'s story: ${parts.join('; ')}`,
      ok,
      saw: v
        ? `${s.status}: ${keys.join(', ')}; at ${v.at}; ${v.done ? 'done' : 'not done'}; row ${v.row ?? 'none'}`
        : `${s.status}: ${s.raw.slice(0, 200)}`,
    }
  }
  if ('needs_you' in c) {
    const want = c.needs_you as { count: number; from?: string }
    const agent = want.from ? h.world.agents.byName(want.from)?.id : undefined
    const cards = h.world.cards
      .waiting(h.owner.id)
      .filter((x) => !want.from || cardAgent(x) === agent)
    return {
      check: `${want.count} card${want.count === 1 ? '' : 's'} in Needs you${want.from ? ` from ${want.from}` : ''}`,
      ok: cards.length === want.count,
      saw: cards.map((x) => x.words.slice(0, 80)).join('; ') || 'none',
    }
  }
  if ('story_says' in c) {
    const want = c.story_says as { as?: string; chapter: string; matches?: string; never?: string }
    const s = await get<unknown>(h.app(want.as), `/api/story/${want.chapter}`)
    const text = s.raw
    const ok =
      s.status < 400 &&
      (!want.matches || new RegExp(want.matches, 'i').test(text)) &&
      (!want.never || !new RegExp(want.never, 'i').test(text))
    return {
      check: `${want.as ?? 'the owner'}'s ${want.chapter} says${want.matches ? ` /${want.matches}/` : ''}${want.never ? `, never /${want.never}/` : ''}`,
      ok,
      saw: `${s.status}: ${text.slice(0, 300)}`,
    }
  }
  return null
}

// The person as the window's routes see them: the owner, or a member added by name.
export function personNamed(world: World, owner: User, as?: string): User {
  if (!as) return owner
  const u = world.users().find((x) => x.name === as)
  if (!u) throw new Error(`No one called ${as} is in this Alpha.`)
  return u
}
