// Set up Alpha's three steps of the interview (the redesign of 22 Nov, calls 17 to 19; split in
// three on one page, proposed, Vikas 23 Nov): What I learned, About you's lines each approved or
// declined; A few questions, the blanks one at a time with no wait between, their answers going back
// together; and Off your plate, the work by hours a month, the first few with their playback and
// Build it. Nothing lands in How to work without the person's approval, here; a declined line and
// a declined proposal never come back (rules I4). A step with nothing in it says why, and going
// on from it is a skip, never done.
import { type PluginHost, Refusal, type Row } from '@alpha/plugin-sdk'
import { z } from 'zod'
import { think } from './draft.ts'
import { keepStory, ReadBody, readThenDraft, startReading, storyOf, type Who } from './know.ts'

export type Step = 'learned' | 'questions' | 'plate'
// the work offered on Off your plate, the most hours first
const OFFERED = 3

const mine = (host: PluginHost, table: string, who: Who): Row[] =>
  host.own.rows(table).filter((r) => r.values.Person === who.name)

export const PLAYBACK = ["Yes, that's it", 'Yes, and also', 'Not this']
const answerOf = (a: string) =>
  /^yes,?\s*that/i.test(a) ? 'Yes' : /^yes/i.test(a) ? 'Yes and also' : 'Not this'

const lines = (v: unknown) =>
  String(v ?? '')
    .split('\n')
    .map((x) => x.trim())
    .filter(Boolean)

export function learnedScreen(host: PluginHost, who: Who, step: Step = 'learned') {
  // what is connected is read, in the background, as soon as these steps are drawn
  startReading(host, who)
  const st = storyOf(host, who.id)
  const busy = st.drafting || st.reading
  const read = st.found.some((f) => f.on)
  const questions = mine(host, 'Questions', who)
  const open = questions.filter((q) => !String(q.values.Answer ?? '').trim())
  const next = open[0]
  const flows = mine(host, 'Workflows', who).sort(
    (a, b) => Number(a.values.Rank ?? 99) - Number(b.values.Rank ?? 99),
  )
  const props = host.own.rows('Proposals')
  const about = mine(host, 'About you', who)
  // what each step says where it has nothing, plainly: never an empty step
  const empty = busy
    ? null
    : !read
      ? 'Nothing is connected yet, so I have nothing to learn from. Connect your mail or calendar above, and this fills in by itself.'
      : step === 'learned' && !about.length
        ? 'I didn’t learn anything worth saving from what I read.'
        : step === 'questions' && !questions.length
          ? 'Nothing to ask: what I read was enough.'
          : null
  return {
    says: {
      learned: 'Here’s what I learned about you. Approve what’s right.',
      questions: 'A few questions only you can answer.',
      plate: 'Here’s what I could take off your plate.',
    }[step],
    empty,
    drafting: busy,
    problem: st.problem,
    // what was read, as Get to know you showed it, while the draft is written
    found: st.found
      .filter((f) => f.on)
      .map((f) => ({ name: f.name, words: f.words.split('\n')[0] ?? '' })),
    question: next
      ? {
          id: next.id,
          words: String(next.values.Question ?? ''),
          options: [...lines(next.values.Options), 'None of these'],
          rests: lines(next.values['Rests on']),
          at: questions.length - open.length + 1,
          of: questions.length,
        }
      : null,
    about: about.map((a) => ({
      id: a.id,
      line: String(a.values.Line ?? ''),
      for: a.values.For === 'Everyone here' ? 'everyone' : 'me',
      rests: lines(a.values['Rests on']),
      state: String(a.values.State ?? 'Proposed'),
      decided: a.values.State !== 'Proposed',
    })),
    workflows: (step === 'plate' ? flows.slice(0, OFFERED) : flows).map((w) => {
      const made = props.filter((p) => p.values.Workflow === w.id)
      return {
        id: w.id,
        name: String(w.values.Name ?? ''),
        shows: String(w.values['What the data shows'] ?? ''),
        hours: (w.values['Hours a month'] as number | null | undefined) ?? null,
        status: String(w.values.Status ?? ''),
        proposals: made.map((p) => p.id),
      }
    }),
    playbacks: props
      .filter(
        (p) =>
          flows.some((w) => w.id === p.values.Workflow) && p.values.Kind !== 'Not worth building',
      )
      .map((p) => {
        const flow = flows.find((w) => w.id === p.values.Workflow)
        return {
          id: p.id,
          workflow: String(flow?.values.Name ?? ''),
          name: String(p.values.Name ?? ''),
          kind: String(p.values.Kind ?? ''),
          words: `We'd build ${p.values.Name} for ${flow?.values.Name ?? 'this'}. Does that meet your need?`,
          does: String(p.values['What it does'] ?? ''),
          target: (p.values.Target as string | null | undefined) ?? null,
          choices: PLAYBACK,
          answer: (p.values.Answer as string | null | undefined) ?? null,
          decided: p.values.Answer !== 'Waiting',
        }
      }),
  }
}

export const LearnedBody = z.object({
  answer: z.object({ id: z.string(), choice: z.string().trim().min(1).max(2000) }).optional(),
  about: z
    .object({
      keep: z.union([z.array(z.string()), z.literal('rest')]).optional(),
      drop: z.array(z.string()).default([]),
      edit: z.record(z.string(), z.string().trim().min(1).max(500)).default({}),
    })
    .optional(),
  playback: z.object({ id: z.string(), choice: z.string().trim().min(1).max(2000) }).optional(),
  retry: z.boolean().optional(), // write the draft again, after one that did not come
  read: ReadBody.optional(), // read what is connected again now, then draft
  built: z.boolean().optional(), // Off your plate: something sent to the Module builder from it
})

// What the person did on the screen; {} goes on.
export async function learnedAct(
  host: PluginHost,
  who: Who,
  body: z.infer<typeof LearnedBody>,
  step: Step = 'learned',
): Promise<{ on: boolean; nothing?: boolean }> {
  if (body.read) {
    await readThenDraft(host, who, body.read.off)
    return { on: false }
  }
  if (body.answer) {
    const { id, choice } = body.answer
    const q = mine(host, 'Questions', who).find((x) => x.id === id)
    if (!q) throw new Refusal('That question is not yours to answer.')
    host.own.set('Questions', q.id, { Answer: choice })
    // the set answered: its answers go back together (call 17)
    if (mine(host, 'Questions', who).every((x) => String(x.values.Answer ?? '').trim()))
      void think(host, who)
    return { on: false }
  }
  if (body.about) {
    const { drop, edit } = body.about
    const open = mine(host, 'About you', who).filter((a) => a.values.State === 'Proposed')
    const keep =
      body.about.keep === 'rest'
        ? open.filter((a) => !drop.includes(a.id)).map((a) => a.id)
        : (body.about.keep ?? [])
    const kept: { words: string; for: 'me' | 'everyone'; heading: string }[] = []
    for (const a of open) {
      if (drop.includes(a.id)) host.own.set('About you', a.id, { State: 'Dropped' })
      else if (keep.includes(a.id)) {
        const words = edit[a.id] ?? String(a.values.Line ?? '')
        host.own.set('About you', a.id, { ...(edit[a.id] ? { Line: words } : {}), State: 'Kept' })
        const everyone = a.values.For === 'Everyone here'
        kept.push({
          words,
          for: everyone ? 'everyone' : 'me',
          heading: everyone ? 'Who the work is for' : 'About you',
        })
      }
    }
    // the person's Keep, pressed here: written to How to work as theirs
    if (kept.length) host.keep(who.id, kept)
    return { on: false }
  }
  if (body.retry) {
    void think(host, who)
    return { on: false }
  }
  if (body.playback) {
    const { id, choice } = body.playback
    const p = host.own.rows('Proposals').find((x) => x.id === id)
    const flow = p && mine(host, 'Workflows', who).find((w) => w.id === p.values.Workflow)
    if (!p || !flow) throw new Refusal('That playback is not yours to answer.')
    if (p.values.Answer !== 'Waiting') throw new Refusal('That playback has its answer already.')
    const answer = answerOf(choice)
    host.own.set('Proposals', p.id, { Answer: answer })
    host.own.change(
      'Workflows',
      flow.id,
      { Status: answer === 'Not this' ? 'Asking' : 'Agreed' },
      `their answer in What I learned: ${choice}`,
    )
    // Not this reopens the questions on that workflow until it can be restated (call 18)
    if (answer === 'Not this') void think(host, who)
    return { on: false }
  }
  // gone through: a short interview's news is spent
  if (storyOf(host, who.id).since) keepStory(host, who.id, { since: null })
  // a step with nothing in it is skipped, never done
  const flows = new Set(mine(host, 'Workflows', who).map((w) => w.id))
  const has = {
    learned: () => mine(host, 'About you', who).length > 0,
    questions: () => mine(host, 'Questions', who).length > 0,
    plate: () =>
      !!body.built ||
      host.own.rows('Proposals').some((p) => flows.has(String(p.values.Workflow ?? ''))),
  }[step]
  return has() ? { on: true } : { on: true, nothing: true }
}
