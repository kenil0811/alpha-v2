// The propose tool (the onboarding plan, calls 8, 25 to 33; rules I1 to I4): the one way the
// Interviewer puts anything to the person, each line under the walls (walls.ts). About you lines
// go on one card to keep or drop; workflows, their steps and proposals land in Your work, a
// proposal played back on its own card. Counts and hours are worked out here, never taken from
// the model; an estimate is kept as one, with what it rests on.
import { type Made, type PluginHost, Refusal, type Turn, tool } from '@alpha/plugin-sdk'
import { z } from 'zod'
import { config } from './config.ts'
import { flowOf, ofPerson, readable, sync } from './state.ts'
import { wall } from './walls.ts'

const Cites = z
  .array(z.string())
  .describe(
    'what it rests on, one to a line: row <id>, answer <card id>, page <address>, file <hash> or line <id>',
  )
const Estimate = z.object({ estimate: z.number().positive(), basis: z.string().min(1) })

const PLAYBACK = ["Yes, that's it", 'Yes, and also', 'Not this']

// The answers a set of citations names.
const answersIn = (cites: string[]) =>
  cites.filter((c) => c.startsWith('answer ')).map((c) => c.slice(7).trim())

const round = (n: number) => Math.round(n * 10) / 10

// The minutes their answer gives: "About 45 minutes each", "an hour".
export function minutesIn(answer: string): number | null {
  const m = /(\d+(?:\.\d+)?)\s*(minutes?|mins?|hours?|hrs?)\b/i.exec(answer)
  if (m) return Number(m[1]) * (/^h/i.test(m[2] ?? '') ? 60 : 1)
  if (/\ban hour\b/i.test(answer)) return 60
  if (/\bhalf an hour\b/i.test(answer)) return 30
  return null
}

function refuse(why: string): never {
  throw new Refusal(`Not proposed: ${why}.`)
}

export const proposeTool = (host: PluginHost) =>
  tool({
    name: 'propose',
    description: [
      'Put what you learned to the person: one of about (lines about them for How to work, on one card to keep or drop), workflow (a piece of work they repeat), step (one step of a workflow) or proposal (what Alpha would build for a workflow, played back on its own card, or not worth building and why).',
      'Everything cites what it rests on. A line that cites nothing, cites a skipped source, names what nothing read holds, says "you said" of words they never wrote, or repeats what they declined is refused.',
      'A workflow says how often it happens with the rows that are each one time (counted here over the months read), or an estimate with its basis; and how long each time with the card whose answer says it, or an estimate with its basis. Hours a month is worked out here.',
    ].join('\n'),
    input: {
      about: z
        .object({
          lines: z.array(z.object({ line: z.string(), rests_on: Cites })).min(1),
          for: z
            .enum(['me', 'everyone'])
            .describe(
              'me: For you; everyone: For everyone here, the owner’s alone (who the work is for)',
            ),
        })
        .optional(),
      workflow: z
        .object({
          id: z.string().optional().describe('the workflow’s row, to change one already proposed'),
          name: z.string(),
          shows: z.string().describe('what the data shows'),
          means: z.string().describe('what it means for them'),
          times: z.union([z.object({ rows: z.array(z.string()).min(1) }), Estimate]),
          minutes: z.union([z.object({ answer: z.string() }), Estimate]).optional(),
          rests_on: Cites,
        })
        .optional(),
      step: z
        .object({
          workflow: z.string().describe('its row id or its name'),
          order: z.number().int().positive(),
          what: z.string(),
          where: z.string().optional(),
          tool: z.string().optional(),
          who: z.string().optional(),
          how_often: z.string().optional(),
          stalls: z.boolean().optional(),
          rests_on: Cites,
        })
        .optional(),
      proposal: z
        .object({
          workflow: z.string().describe('its row id or its name'),
          kind: z.enum(['module', 'agent', 'schedule', 'not worth building']),
          name: z
            .string()
            .describe('what it would be called, or why it is not worth building in a few words'),
          does: z
            .string()
            .describe(
              'what it would do, in three to five short lines; or why it is not worth building',
            ),
          target: z.string().optional(),
          rests_on: Cites,
        })
        .optional(),
    },
    run: async (input, turn) => {
      sync(host, turn)
      const given = (['about', 'workflow', 'step', 'proposal'] as const).filter((k) => input[k])
      if (given.length !== 1) refuse('give one of about, workflow, step or proposal')
      if (input.about) return about(host, turn, input.about)
      if (input.workflow) return workflow(host, turn, input.workflow)
      if (input.step) return step(host, turn, input.step)
      return proposal(host, turn, input.proposal as NonNullable<typeof input.proposal>)
    },
  })

function about(
  host: PluginHost,
  turn: Turn,
  a: { lines: { line: string; rests_on: string[] }[]; for: 'me' | 'everyone' },
): string {
  if (a.for === 'everyone' && !turn.owner) refuse('only the owner keeps lines for everyone here')
  const r = readable(
    host,
    turn,
    a.lines.flatMap((l) => answersIn(l.rests_on)),
  )
  const out: string[] = []
  const kept: { line: string; rests_on: string[] }[] = []
  for (const l of a.lines) {
    const why = wall([l.line], l.rests_on, r)
    if (why) out.push(`Left out “${l.line}”: ${why}.`)
    else kept.push(l)
  }
  if (!kept.length) refuse(out.join(' '))
  const rows = host.own.add(
    'About you',
    kept.map((l) => ({
      values: {
        Line: l.line.trim(),
        Person: turn.name,
        For: a.for === 'me' ? 'You' : 'Everyone here',
        State: 'Proposed',
        'Rests on': l.rests_on.join('\n'),
      },
      basis: `the Interviewer, from ${l.rests_on.join(', ')}`,
    })),
  )
  const card = host.howToWork(turn, {
    words:
      a.for === 'me'
        ? 'About you: keep these in How to work?'
        : 'Who the work is for: keep these for everyone here?',
    table: 'About you',
    rows,
    line: 'Line',
    choice: 'State',
    keep: 'Kept',
    drop: 'Dropped',
    for: a.for,
    heading: a.for === 'me' ? 'About you' : 'Who the work is for',
  })
  return [
    `Put ${rows.length} line(s) to them on card ${card}; what they keep goes to How to work.`,
    ...out,
  ].join('\n')
}

function workflow(
  host: PluginHost,
  turn: Turn,
  w: {
    id?: string | undefined
    name: string
    shows: string
    means: string
    times: { rows: string[] } | { estimate: number; basis: string }
    minutes?: { answer: string } | { estimate: number; basis: string } | undefined
    rests_on: string[]
  },
): string {
  const asked = answersIn(w.rests_on)
  const minutesCard = w.minutes && 'answer' in w.minutes ? w.minutes.answer : null
  const r = readable(host, turn, minutesCard ? [...asked, minutesCard] : asked)
  const why = wall([w.name, w.shows, w.means], w.rests_on, r)
  if (why) refuse(why)
  const made: Record<string, Made> = {}
  const values: Record<string, unknown> = {
    Name: w.name.trim(),
    Person: turn.name,
    'What the data shows': w.shows.trim(),
    'What it means': w.means.trim(),
    'Rests on': w.rests_on.join('\n'),
  }
  // how often: the rows that are each one time, counted over the months read
  let times: number
  if ('rows' in w.times) {
    const bad = w.times.rows.find((c) => !r.cites.has(c.trim()))
    if (bad) refuse(`${bad} is not a row read from a source they allowed`)
    const months = config.lookback_days / 30
    times = round(new Set(w.times.rows.map((c) => c.trim())).size / months)
    made['Times a month'] = {
      kind: 'computed',
      how: `${w.times.rows.length} times in the ${config.lookback_days} days read`,
    }
  } else {
    times = w.times.estimate
    made['Times a month'] = { kind: 'estimated', basis: w.times.basis }
  }
  values['Times a month'] = times
  // how long each time: their answer, or an estimate
  let minutes: number | null = null
  if (w.minutes && 'answer' in w.minutes) {
    const a = r.answers.get(w.minutes.answer)
    if (a === undefined) refuse(`card ${w.minutes.answer} has no answer of theirs`)
    minutes = minutesIn(a)
    if (minutes === null)
      refuse(
        `their answer on card ${w.minutes.answer} gives no minutes: ask, or estimate it with its basis`,
      )
    made['Minutes each'] = {
      kind: 'computed',
      how: `from their answer on card ${w.minutes.answer}`,
    }
  } else if (w.minutes) {
    minutes = w.minutes.estimate
    made['Minutes each'] = { kind: 'estimated', basis: w.minutes.basis }
  }
  if (minutes !== null) {
    values['Minutes each'] = minutes
    const hours = round((times * minutes) / 60)
    values['Hours a month'] = hours
    const estimated = [made['Times a month'], made['Minutes each']].filter(
      (m) => m?.kind === 'estimated',
    )
    made['Hours a month'] = estimated.length
      ? {
          kind: 'estimated',
          basis: `times a month by minutes each, ${estimated.map((m) => (m as { basis: string }).basis).join('; ')}`,
        }
      : { kind: 'computed', how: `${times} a month × ${minutes} minutes` }
  }
  const before = w.id ? flowOf(host, turn, w.id) : flowOf(host, turn, w.name)
  if (before)
    host.own.change('Workflows', before.id, values, 'the Interviewer, as it learned more', made)
  else
    host.own.add('Workflows', [
      {
        values: { ...values, Status: 'Drafting' },
        basis: 'the Interviewer, from what it read',
        made,
      },
    ])
  rank(host, turn)
  const id = before?.id ?? flowOf(host, turn, w.name)?.id
  return `Workflow ${id}: ${w.name}, ${times} a month${minutes !== null ? `, ${minutes} minutes each, ${values['Hours a month']} hours a month` : '; how long each time is still a blank'}.`
}

// The report's order: by hours a month, the most first, where the person has not moved one.
function rank(host: PluginHost, turn: Turn): void {
  const flows = ofPerson(host, 'Workflows', turn).sort(
    (a, b) => Number(b.values['Hours a month'] ?? 0) - Number(a.values['Hours a month'] ?? 0),
  )
  flows.forEach((f, i) => {
    if (f.values.Rank !== i + 1)
      host.own.change('Workflows', f.id, { Rank: i + 1 }, 'by hours a month', {
        Rank: { kind: 'computed', how: 'its place by hours a month' },
      })
  })
}

function step(
  host: PluginHost,
  turn: Turn,
  s: {
    workflow: string
    order: number
    what: string
    where?: string | undefined
    tool?: string | undefined
    who?: string | undefined
    how_often?: string | undefined
    stalls?: boolean | undefined
    rests_on: string[]
  },
): string {
  const flow = flowOf(host, turn, s.workflow)
  if (!flow) refuse(`there is no workflow of theirs called ${s.workflow}: propose it first`)
  const r = readable(host, turn, answersIn(s.rests_on))
  const why = wall(
    [s.what, s.where ?? '', s.tool ?? '', s.who ?? '', s.how_often ?? ''],
    s.rests_on,
    r,
  )
  if (why) refuse(why)
  const [id] = host.own.add('Steps', [
    {
      values: {
        Workflow: flow.id,
        Order: s.order,
        'What happens': s.what.trim(),
        Where: s.where ?? null,
        Tool: s.tool ?? null,
        Who: s.who ?? null,
        'How often': s.how_often ?? null,
        'Stalls here': s.stalls === undefined ? null : s.stalls ? 'Yes' : 'No',
        'Rests on': s.rests_on.join('\n'),
      },
      basis: 'the Interviewer, from what it read',
    },
  ])
  return `Step ${id} of ${flow.values.Name}.`
}

function proposal(
  host: PluginHost,
  turn: Turn,
  p: {
    workflow: string
    kind: 'module' | 'agent' | 'schedule' | 'not worth building'
    name: string
    does: string
    target?: string | undefined
    rests_on: string[]
  },
): string {
  const flow = flowOf(host, turn, p.workflow)
  if (!flow) refuse(`there is no workflow of theirs called ${p.workflow}: propose it first`)
  const r = readable(host, turn, answersIn(p.rests_on))
  const why = wall([p.does], p.rests_on, r) ?? wall([p.name, p.target ?? ''], p.rests_on, r)
  if (why) refuse(why)
  const waiting = host.own
    .rows('Proposals')
    .find((x) => x.values.Workflow === flow.id && x.values.Answer === 'Waiting')
  if (waiting) refuse(`the playback for ${flow.values.Name} waits on their answer`)
  const values = {
    Workflow: flow.id,
    Kind:
      p.kind === 'not worth building'
        ? 'Not worth building'
        : p.kind[0]?.toUpperCase() + p.kind.slice(1),
    'What it does': p.does.trim(),
    Target: p.target ?? null,
    'Rests on': p.rests_on.join('\n'),
  }
  if (p.kind === 'not worth building') {
    host.own.add('Proposals', [{ values, basis: 'the Interviewer, from what it read' }])
    host.own.change(
      'Workflows',
      flow.id,
      { Status: 'Not worth building' },
      'the Interviewer, with why',
    )
    return `${flow.values.Name} closes as not worth building.`
  }
  const card = host.question(turn, {
    words:
      `We'd build ${p.name.trim()} for ${String(flow.values.Name)}. Does that meet your need?`.slice(
        0,
        140,
      ),
    detail: [
      `We'd build ${p.name.trim()} that does:`,
      p.does.trim(),
      ...(p.target ? [`Target: ${p.target}`] : []),
    ].join('\n\n'),
    options: PLAYBACK,
  })
  host.own.add('Proposals', [
    { values: { ...values, Answer: 'Waiting', Card: card }, basis: 'the Interviewer, played back' },
  ])
  host.own.change('Workflows', flow.id, { Status: 'Played back' }, `played back on card ${card}`)
  return `Played back on card ${card}; their answer comes as a message.`
}
