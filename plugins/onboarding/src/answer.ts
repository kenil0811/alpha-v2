// The answer of the closer look (onboarding B, Kenil's yes 2 Nov), typed, then the walls in code.
// No cap of ours on how much comes back: what is checked is truth. Every item rests on what was
// read: the overview's ids (B17) or the session's tool calls (t3). A module or connector suggested
// is one Alpha can set up; a site or a file's name nothing read held is not let through (which
// keeps what the person left out, out); a line they dropped before is not proposed again.

const CITES = { type: 'array', items: { type: 'string' } } as const

export const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['about', 'routines', 'suggestions', 'questions'],
  properties: {
    about: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['line', 'from', 'sure'],
        properties: {
          line: { type: 'string' },
          from: CITES,
          sure: { type: 'string', enum: ['likely', 'guess'] },
        },
      },
    },
    routines: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['what', 'evidence', 'alpha', 'how', 'from'],
        properties: {
          what: { type: 'string' },
          evidence: { type: 'string' },
          alpha: { type: 'string', enum: ['yes', 'partly', 'no'] },
          how: { type: 'string' },
          from: CITES,
        },
      },
    },
    suggestions: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['kind', 'name', 'words', 'why', 'from'],
        properties: {
          kind: { type: 'string', enum: ['kit', 'connector', 'build', 'reminder'] },
          name: { type: ['string', 'null'] },
          words: { type: 'string' },
          why: { type: 'string' },
          from: CITES,
        },
      },
    },
    questions: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['question', 'why', 'from'],
        properties: {
          question: { type: 'string' },
          why: { type: 'string' },
          from: CITES,
        },
      },
    },
  },
} as const

export interface AboutLine {
  line: string
  from: string[]
  sure: 'likely' | 'guess'
}

export interface Routine {
  what: string
  evidence: string
  alpha: 'yes' | 'partly' | 'no'
  how: string
  from: string[]
}

export interface Suggestion {
  kind: 'kit' | 'connector' | 'build' | 'reminder'
  name: string | null
  words: string
  why: string
  from: string[]
}

export interface Question {
  question: string
  why: string
  from: string[]
}

export interface Checked {
  about: AboutLine[]
  routines: Routine[]
  suggestions: Suggestion[]
  questions: Question[]
  dropped: { what: string; why: string }[]
}

// The words of a line, to know it again: lower case, no punctuation.
export const sameAs = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

// What looks like a site or a file's name in some words (bizbuysell.com, LOI draft.docx).
const NAMED = /\b(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,24}\b/gi

const items = (x: unknown) =>
  (Array.isArray(x) ? x : []).filter(
    (i): i is Record<string, unknown> => typeof i === 'object' && i !== null,
  )
const str = (v: unknown) => (v === null || v === undefined ? '' : String(v).trim())

export function check(
  answer: unknown,
  read: { ids: string[]; text: string }, // what can be cited, and everything read
  can: { modules: string[]; connectors: string[] },
  before: string[], // lines Alpha proposed already, kept or dropped: never proposed again
): Checked {
  const a = (answer ?? {}) as Record<string, unknown>
  const known = new Set(read.ids)
  const text = read.text.toLowerCase()
  const seen = new Set(before.map(sameAs))
  const dropped: Checked['dropped'] = []
  const cited = (from: unknown) =>
    (Array.isArray(from) ? from : [])
      .map((x) => String(x).replace(/^\[|\]$/g, ''))
      .filter((x) => known.has(x))
  // a site or a name nothing read held: invented, or one the person left out
  const unknownName = (...words: string[]) =>
    words.flatMap((w) => w.match(NAMED) ?? []).find((n) => !text.includes(n.toLowerCase())) ?? null
  // why an item is left out, or none
  const wall = (from: string[], ...words: string[]) => {
    if (!from.length) return 'it cites nothing that was read'
    const odd = unknownName(...words)
    return odd ? `it names ${odd}, which nothing read holds` : null
  }

  const about: AboutLine[] = []
  for (const x of items(a.about)) {
    const line = str(x.line)
    if (!line) continue
    const from = cited(x.from)
    const why = wall(from, line) ?? (seen.has(sameAs(line)) ? 'it was proposed before' : null)
    if (why) dropped.push({ what: line, why })
    else {
      seen.add(sameAs(line))
      about.push({ line, from, sure: x.sure === 'likely' ? 'likely' : 'guess' })
    }
  }

  const routines: Routine[] = []
  for (const x of items(a.routines)) {
    const what = str(x.what)
    if (!what) continue
    const from = cited(x.from)
    const r: Routine = {
      what,
      evidence: str(x.evidence),
      alpha: x.alpha === 'yes' ? 'yes' : x.alpha === 'partly' ? 'partly' : 'no',
      how: str(x.how),
      from,
    }
    const why = wall(from, r.what, r.evidence, r.how)
    if (why) dropped.push({ what, why })
    else routines.push(r)
  }

  const suggestions: Suggestion[] = []
  const kinds = ['kit', 'connector', 'build', 'reminder'] as const
  for (const x of items(a.suggestions)) {
    const words = str(x.words)
    const kind = kinds.find((k) => k === x.kind)
    if (!words || !kind) continue
    const from = cited(x.from)
    const name = x.name === null || x.name === undefined ? null : String(x.name)
    const offered =
      kind === 'kit'
        ? can.modules.some((m) => m.toLowerCase() === name?.toLowerCase())
        : kind === 'connector'
          ? can.connectors.some((c) => c.toLowerCase() === name?.toLowerCase())
          : true
    const why = !from.length
      ? wall(from)
      : !offered
        ? `${name ?? 'it'} is not one Alpha can set up`
        : wall(from, words, str(x.why))
    if (why) dropped.push({ what: words, why })
    else suggestions.push({ kind, name, words, why: str(x.why), from })
  }

  const questions: Question[] = []
  for (const x of items(a.questions)) {
    const question = str(x.question)
    if (!question) continue
    const from = cited(x.from)
    const why = wall(from, question, str(x.why))
    if (why) dropped.push({ what: question, why })
    else questions.push({ question, why: str(x.why), from })
  }
  return { about, routines, suggestions, questions, dropped }
}

// The sources a line rests on, in words: "Browsing, File names". An overview id by its letter, a
// tool call by its tool.
const PARTS: Record<string, string> = {
  P: 'You',
  C: 'Calendar',
  K: 'Contacts',
  M: 'Mail',
  B: 'Browsing',
  A: 'Apps',
  F: 'File names',
  T: 'What Alpha can set up',
}
const TOOLS: Record<string, string> = {
  day: 'Your days',
  sites: 'Browsing',
  apps: 'Apps',
  files: 'File names',
  mail: 'Mail',
  calendar: 'Calendar',
  contacts: 'Contacts',
  search: 'Search',
}
export const fromWords = (ids: string[], tools: Record<string, string> = {}) =>
  [
    ...new Set(
      ids.map((id) => {
        const tool = tools[id]
        return tool ? (TOOLS[tool] ?? tool) : (PARTS[id.charAt(0)] ?? id)
      }),
    ),
  ].join(', ')
