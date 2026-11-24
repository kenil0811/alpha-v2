// Set up Alpha's draft (the redesign of 22 Nov, calls 16 to 18): one question to the model, no
// tools, from what Get to know you read, the person's answers so far, the report as it stands and
// what they declined; it answers About you, the workflows with their steps, the blanks as a set,
// and a proposal for each workflow with no blanks left. Everything it says meets the walls in code
// (walls.ts, rules I1, I3, I4); counts and hours are worked out here (I2). It is asked again after
// each set of answers and each "Not this", in the background.
import type { Made, PluginHost, Row } from '@alpha/plugin-sdk'
import { config } from './config.ts'
import { keepStory, type Story, storyOf, type Who } from './know.ts'
import { minutesIn } from './propose.ts'
import { SOURCES } from './sources.ts'
import { type Readable, sameAs, wall } from './walls.ts'

const mine = (host: PluginHost, table: string, who: Who): Row[] =>
  host.own.rows(table).filter((r) => r.values.Person === who.name)

const str = { type: 'string' }
const strs = { type: 'array', items: str }
const maybe = (t: string) => ({ type: [t, 'null'] })
const SCHEMA = {
  type: 'object',
  required: ['about', 'workflows', 'questions'],
  properties: {
    about: {
      type: 'array',
      items: {
        type: 'object',
        required: ['line', 'for', 'rests_on'],
        properties: { line: str, for: { enum: ['me', 'everyone'] }, rests_on: strs },
      },
    },
    workflows: {
      type: 'array',
      items: {
        type: 'object',
        required: ['name', 'shows', 'means', 'rests_on', 'steps'],
        properties: {
          name: str,
          shows: str,
          means: str,
          times_rows: strs,
          times_estimate: maybe('number'),
          times_basis: maybe('string'),
          minutes_answer: maybe('string'),
          minutes_estimate: maybe('number'),
          minutes_basis: maybe('string'),
          rests_on: strs,
          steps: {
            type: 'array',
            items: {
              type: 'object',
              required: ['what', 'rests_on'],
              properties: {
                what: str,
                where: maybe('string'),
                tool: maybe('string'),
                who: maybe('string'),
                how_often: maybe('string'),
                stalls: maybe('boolean'),
                rests_on: strs,
              },
            },
          },
          proposal: {
            type: ['object', 'null'],
            required: ['kind', 'name', 'does', 'rests_on'],
            properties: {
              kind: { enum: ['module', 'agent', 'schedule', 'not worth building'] },
              name: str,
              does: str,
              target: maybe('string'),
              rests_on: strs,
            },
          },
        },
      },
    },
    questions: {
      type: 'array',
      items: {
        type: 'object',
        required: ['words', 'options', 'rests_on'],
        properties: { words: str, options: strs, workflow: maybe('string'), rests_on: strs },
      },
    },
  },
}

export interface Draft {
  about: { line: string; for: 'me' | 'everyone'; rests_on: string[] }[]
  workflows: {
    name: string
    shows: string
    means: string
    times_rows?: string[]
    times_estimate?: number | null
    times_basis?: string | null
    minutes_answer?: string | null
    minutes_estimate?: number | null
    minutes_basis?: string | null
    rests_on: string[]
    steps: {
      what: string
      where?: string | null
      tool?: string | null
      who?: string | null
      how_often?: string | null
      stalls?: boolean | null
      rests_on: string[]
    }[]
    proposal?: {
      kind: 'module' | 'agent' | 'schedule' | 'not worth building'
      name: string
      does: string
      target?: string | null
      rests_on: string[]
    } | null
  }[]
  questions: { words: string; options: string[]; workflow?: string | null; rests_on: string[] }[]
}

// What their lines may rest on now: the sources they allowed in Get to know you, the site's pages,
// their answers, and what they dropped or declined.
export function readableFor(host: PluginHost, who: Who, st: Story): Readable {
  const days = config.lookback_days
  const r: Readable = {
    cites: new Set(),
    skipped: new Set(),
    answers: new Map(),
    text: '',
    declined: new Set(),
  }
  const texts: string[] = []
  const on = new Map(st.found.map((f) => [f.key, f.on]))
  for (const s of SOURCES) {
    if (!on.has(s.key)) continue
    const found = s.read(host, who.id, days)
    for (const c of found.cites) (on.get(s.key) ? r.cites : r.skipped).add(c)
    if (on.get(s.key)) texts.push(found.text)
  }
  for (const p of st.site) {
    texts.push(new URL(p.url).host, p.text)
  }
  // who the work is for, in the owner's own words, or business or personal as About you says it:
  // theirs to cite, as an answer
  const own = forWords(host.workspace())
  if (own) {
    r.answers.set('workspace', own)
    texts.push(own)
  }
  for (const q of mine(host, 'Questions', who)) {
    const a = String(q.values.Answer ?? '').trim()
    if (a) {
      r.answers.set(q.id, a)
      texts.push(a)
    }
  }
  r.text = texts.join('\n').toLowerCase()
  for (const l of mine(host, 'About you', who))
    if (l.values.State === 'Dropped') r.declined.add(sameAs(String(l.values.Line ?? '')))
  const flows = new Set(mine(host, 'Workflows', who).map((w) => w.id))
  for (const p of host.own.rows('Proposals'))
    if (p.values.Answer === 'Not this' && flows.has(String(p.values.Workflow ?? ''))) {
      r.declined.add(sameAs(String(p.values['What it does'] ?? '')))
      r.declined.add(sameAs(String(p.values.Name ?? '')))
    }
  return r
}

// What the model is given: who, the workspace, every line it may cite, the answers, the report.
// Who the work is for, as the owner said it: their own words where they gave them (Your workspace,
// before 23 Nov), else business or personal from About you.
const forWords = (ws: ReturnType<PluginHost['workspace']>): string | null =>
  ws.for ?? (ws.use === 'personal' ? 'Personal work' : ws.use === 'business' ? 'A business' : null)

function promptOf(host: PluginHost, who: Who, st: Story): string {
  const days = config.lookback_days
  const ws = host.workspace()
  const on = new Set(st.found.filter((f) => f.on).map((f) => f.key))
  const out: string[] = [
    `Person: ${who.name}${who.owner ? ', the owner of this workspace' : ''}.`,
    ...(ws.name ? [`Workspace: ${ws.name}.`] : []),
    ...(forWords(ws)
      ? [`answer workspace: who the work is for, as the owner said it: “${forWords(ws)}”`]
      : []),
    '',
  ]
  if (st.since)
    out.push(
      '## Since the last interview',
      st.since,
      'This is a short interview: ask only about what changed, a few questions at most, and change the report only where it did.',
      '',
    )
  for (const s of SOURCES) {
    if (!on.has(s.key)) continue
    out.push(`## ${s.name}`, ...s.lines(host, who.id, days), '')
  }
  if (st.site.length) {
    out.push('## Their website')
    for (const p of st.site) out.push(`page ${p.url}: ${p.text.slice(0, 1500)}`)
    out.push('')
  }
  const questions = mine(host, 'Questions', who)
  if (questions.length) {
    out.push('## Asked before, and their answers')
    for (const q of questions)
      out.push(
        `answer ${q.id}: asked “${q.values.Question}”; ${q.values.Answer ? `they said “${q.values.Answer}”` : 'not answered yet'}`,
      )
    out.push('')
  }
  const about = mine(host, 'About you', who)
  if (about.length) {
    out.push('## About them, already proposed (never again)')
    for (const a of about) out.push(`- ${a.values.Line} (${a.values.State})`)
    out.push('')
  }
  const flows = mine(host, 'Workflows', who)
  if (flows.length) {
    out.push('## The report as it stands')
    for (const w of flows) {
      const props = host.own.rows('Proposals').filter((p) => p.values.Workflow === w.id)
      out.push(
        `Workflow “${w.values.Name}”: ${w.values['Times a month'] ?? '?'} a month, ${w.values['Minutes each'] ?? '?'} minutes each; ${w.values.Status}.`,
        ...props.map(
          (p) =>
            `  proposal “${p.values.Name ?? ''}” (${p.values.Kind}): ${String(p.values['What it does'] ?? '').replace(/\s+/g, ' ')}; answer: ${p.values.Answer ?? 'none'}`,
        ),
      )
    }
    out.push('')
  }
  return out.join('\n')
}

const round = (n: number) => Math.round(n * 10) / 10

// The numbers of a workflow: how often counted over the rows that are each one time, how long from
// their answer, hours a month worked out; or each estimated with its basis (rules I2).
function numbers(w: Draft['workflows'][number], r: Readable) {
  const values: Record<string, unknown> = {}
  const made: Record<string, Made> = {}
  let times: number | null = null
  const rows = [...new Set((w.times_rows ?? []).map((c) => c.trim()))].filter((c) => r.cites.has(c))
  if (rows.length) {
    times = round(rows.length / (config.lookback_days / 30))
    made['Times a month'] = {
      kind: 'computed',
      how: `${rows.length} times in the ${config.lookback_days} days read`,
    }
  } else if (w.times_estimate && w.times_basis?.trim()) {
    times = w.times_estimate
    made['Times a month'] = { kind: 'estimated', basis: w.times_basis.trim() }
  }
  let minutes: number | null = null
  const said = w.minutes_answer
    ? r.answers.get(w.minutes_answer.replace(/^answer\s+/, ''))
    : undefined
  const fromAnswer = said ? minutesIn(said) : null
  if (fromAnswer !== null && w.minutes_answer) {
    minutes = fromAnswer
    made['Minutes each'] = { kind: 'computed', how: `from their ${w.minutes_answer}` }
  } else if (w.minutes_estimate && w.minutes_basis?.trim()) {
    minutes = w.minutes_estimate
    made['Minutes each'] = { kind: 'estimated', basis: w.minutes_basis.trim() }
  }
  if (times !== null) values['Times a month'] = times
  if (minutes !== null) values['Minutes each'] = minutes
  if (times !== null && minutes !== null) {
    values['Hours a month'] = round((times * minutes) / 60)
    const est = [made['Times a month'], made['Minutes each']].filter((m) => m?.kind === 'estimated')
    made['Hours a month'] = est.length
      ? {
          kind: 'estimated',
          basis: `times a month by minutes each, ${est.map((m) => (m as { basis: string }).basis).join('; ')}`,
        }
      : { kind: 'computed', how: `${times} a month × ${minutes} minutes` }
  }
  return { values, made }
}

const KIND: Record<string, string> = {
  module: 'Module',
  agent: 'Agent',
  schedule: 'Schedule',
  'not worth building': 'Not worth building',
}

// What the model said, put into Your work under the walls; what a wall refused is left out.
export function apply(host: PluginHost, who: Who, d: Draft, r: Readable): string[] {
  const left: string[] = []
  const ok = (words: string[], rests: string[], what: string) => {
    const why = wall(words, rests, r)
    if (why) left.push(`${what}: ${why}`)
    return !why
  }
  const seen = new Set(mine(host, 'About you', who).map((a) => sameAs(String(a.values.Line ?? ''))))
  // an owner who works alone, or uses Alpha for personal work, keeps who the work is for as their
  // own (the 18 Nov plan, call 10)
  const ws = host.workspace()
  const alone = /^\s*just me\b/i.test(ws.for ?? '') || ws.use === 'personal'
  for (const a of d.about) if (alone && a.for === 'everyone') a.for = 'me'
  const lines = d.about.filter(
    (a) =>
      (a.for === 'me' || who.owner) &&
      !seen.has(sameAs(a.line)) &&
      ok([a.line], a.rests_on, `About you “${a.line}”`),
  )
  if (lines.length)
    host.own.add(
      'About you',
      lines.map((l) => ({
        values: {
          Line: l.line.trim(),
          Person: who.name,
          For: l.for === 'me' ? 'You' : 'Everyone here',
          State: 'Proposed',
          'Rests on': l.rests_on.join('\n'),
        },
        basis: `the Interviewer, from ${l.rests_on.join(', ')}`,
      })),
    )
  for (const w of d.workflows) {
    if (!ok([w.name, w.shows, w.means], w.rests_on, `Workflow “${w.name}”`)) continue
    const { values, made } = numbers(w, r)
    const before = mine(host, 'Workflows', who).find(
      (x) => sameAs(String(x.values.Name)) === sameAs(w.name),
    )
    const row = {
      Name: w.name.trim(),
      Person: who.name,
      'What the data shows': w.shows.trim(),
      'What it means': w.means.trim(),
      'Rests on': w.rests_on.join('\n'),
      ...values,
    }
    let id = before?.id
    if (before)
      host.own.change('Workflows', before.id, row, 'the Interviewer, as it learned more', made)
    else
      [id] = host.own.add('Workflows', [
        {
          values: { ...row, Status: 'Drafting' },
          basis: 'the Interviewer, from what it read',
          made,
        },
      ])
    if (!id) continue
    // its steps, once
    if (!host.own.rows('Steps').some((s) => s.values.Workflow === id)) {
      const steps = w.steps.filter((s) =>
        ok(
          [s.what, s.where ?? '', s.tool ?? '', s.who ?? '', s.how_often ?? ''],
          s.rests_on,
          `A step of “${w.name}”`,
        ),
      )
      if (steps.length)
        host.own.add(
          'Steps',
          steps.map((s, i) => ({
            values: {
              Workflow: id,
              Order: i + 1,
              'What happens': s.what.trim(),
              Where: s.where ?? null,
              Tool: s.tool ?? null,
              Who: s.who ?? null,
              'How often': s.how_often ?? null,
              'Stalls here':
                s.stalls === null || s.stalls === undefined ? null : s.stalls ? 'Yes' : 'No',
              'Rests on': s.rests_on.join('\n'),
            },
            basis: 'the Interviewer, from what it read',
          })),
        )
    }
    const p = w.proposal
    const props = host.own.rows('Proposals').filter((x) => x.values.Workflow === id)
    const open = props.some(
      (x) =>
        x.values.Answer === 'Waiting' ||
        x.values.Answer === 'Yes' ||
        x.values.Answer === 'Yes and also',
    )
    // one they declined, by its name or what it does, never comes back (rules I4)
    const declined = !!p && (r.declined.has(sameAs(p.name)) || r.declined.has(sameAs(p.does)))
    if (p && declined) left.push(`A proposal for “${w.name}”: the person declined it before`)
    if (
      p &&
      !open &&
      !declined &&
      ok([p.name, p.does, p.target ?? ''], p.rests_on, `A proposal for “${w.name}”`)
    ) {
      const worthless = p.kind === 'not worth building'
      host.own.add('Proposals', [
        {
          values: {
            Workflow: id,
            Name: p.name.trim(),
            Kind: KIND[p.kind] ?? 'Module',
            'What it does': p.does.trim(),
            Target: p.target ?? null,
            ...(worthless ? {} : { Answer: 'Waiting' }),
            'Rests on': p.rests_on.join('\n'),
          },
          basis: 'the Interviewer, from what it read and what they answered',
        },
      ])
      host.own.change(
        'Workflows',
        id,
        { Status: worthless ? 'Not worth building' : 'Played back' },
        worthless ? 'the Interviewer, with why' : 'played back in What I learned',
      )
    }
  }
  rank(host, who)
  const asked = new Set(
    mine(host, 'Questions', who).map((q) => sameAs(String(q.values.Question ?? ''))),
  )
  const questions = d.questions.filter(
    (q) =>
      !asked.has(sameAs(q.words)) &&
      ok([q.words, ...q.options], q.rests_on, `The question “${q.words}”`),
  )
  if (questions.length)
    host.own.add(
      'Questions',
      questions.map((q) => {
        const flow = q.workflow
          ? mine(host, 'Workflows', who).find(
              (x) => sameAs(String(x.values.Name)) === sameAs(q.workflow ?? ''),
            )
          : undefined
        return {
          values: {
            Question: q.words.trim(),
            Person: who.name,
            Options: q.options.join('\n'),
            ...(flow ? { Workflow: flow.id } : {}),
            'Rests on': q.rests_on.join('\n'),
          },
          basis: 'the Interviewer, a blank only they can fill',
        }
      }),
    )
  return left
}

// The report's order: by hours a month, the most first.
function rank(host: PluginHost, who: Who): void {
  const flows = mine(host, 'Workflows', who).sort(
    (a, b) => Number(b.values['Hours a month'] ?? 0) - Number(a.values['Hours a month'] ?? 0),
  )
  flows.forEach((f, i) => {
    if (f.values.Rank !== i + 1)
      host.own.change('Workflows', f.id, { Rank: i + 1 }, 'by hours a month', {
        Rank: { kind: 'computed', how: 'its place by hours a month' },
      })
  })
}

// The draft written again, in the background: once at a time, within the config's rounds.
export async function think(host: PluginHost, who: Who): Promise<void> {
  const st = storyOf(host, who.id)
  if (st.drafting) return
  if (st.rounds >= config.max_rounds) {
    keepStory(host, who.id, {
      problem: 'The draft stopped here: it was written as many times as it may be.',
    })
    return
  }
  keepStory(host, who.id, { drafting: true, problem: null })
  try {
    const answer = (await host.ask(
      config.draft,
      promptOf(host, who, st),
      SCHEMA,
    )) as Partial<Draft> | null
    if (!answer || !Array.isArray(answer.workflows)) throw new Error('The draft came back empty.')
    const draft: Draft = {
      about: answer.about ?? [],
      workflows: answer.workflows,
      questions: answer.questions ?? [],
    }
    const left = apply(host, who, draft, readableFor(host, who, storyOf(host, who.id)))
    host.journal(
      `Drafted an interview's report${left.length ? `, leaving out ${left.length} line(s) the walls refused` : ''}.`,
      { person: who.id },
    )
    keepStory(host, who.id, { drafting: false, rounds: st.rounds + 1 })
  } catch (err) {
    keepStory(host, who.id, {
      drafting: false,
      rounds: st.rounds + 1,
      problem: err instanceof Error ? err.message : String(err),
    })
  }
}
