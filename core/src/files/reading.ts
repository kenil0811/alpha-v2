// Reading a document into named values: the model at a marked judgement point. A
// kit's script names what it wants from a document (single values, and lists of rows such as a
// staff census); the model reads the document's pieces and answers each value with the pieces it
// read it from. A wall in code keeps a value only when it is found in the pieces it cites, so
// nothing is filed from nowhere: whatever fails comes back as not given, with the reason kept.
import type { Position } from '../world/files.ts'
import { Refused } from '../world/kinds.ts'
import type { Use } from '../world/spend.ts'

export type WantKind = 'text' | 'number' | 'money' | 'percent' | 'date' | 'choice'

export interface Want {
  kind: WantKind
  choices?: string[] // for a choice: the words it may take
  about?: string // what the value is, in the kit's words
}

export interface ReadSpec {
  about?: string // what the document is and what to look for
  values?: Record<string, Want>
  lists?: Record<string, { about?: string; fields: Record<string, Want> }>
}

export interface Found {
  value: string | number
  place: Position // the first piece it was read from
}

export interface ReadOut {
  values: Record<string, Found | null>
  lists: Record<string, Record<string, Found | null>[]>
  dropped: string[] // each value the wall turned away, and why
  tokens: number
}

export interface Piece {
  position: Position & { table?: number; column?: number }
  words: string
}

// What the model answers: per value, the value and the numbers of the pieces it was read from.
type Answer = { value: string | number | null; pieces: number[] }
type Answers = {
  values?: Record<string, Answer | null>
  lists?: Record<string, Record<string, Answer | null>[]>
}

// The pieces as the model reads them: numbered, with their place, in reading order.
export function piecesText(pieces: Piece[]): string {
  return pieces
    .map((p, i) => {
      const at = p.position.sheet
        ? `${p.position.sheet}!${p.position.cell ?? ''}`
        : p.position.page
          ? `page ${p.position.page}${p.position.table ? `, table ${p.position.table} row ${p.position.row} column ${p.position.column}` : ''}`
          : p.position.line
            ? `line ${p.position.line}`
            : ''
      return `[${i}] (${at}) ${p.words.replace(/\s+/g, ' ').trim()}`
    })
    .join('\n')
}

// A PDF's pieces in reading order: by page, then from the top of the page down (Docling's boxes
// count up from the bottom of the page), tables in their place among the text.
export function inReadingOrder(pieces: Piece[]): Piece[] {
  return [...pieces].sort((a, b) => {
    const pa = a.position.page ?? 0
    const pb = b.position.page ?? 0
    if (pa !== pb) return pa - pb
    const ta = a.position.box?.[1] ?? 0
    const tb = b.position.box?.[1] ?? 0
    return tb - ta
  })
}

// The JSON schema the model answers in, made from what the kit wants.
function schemaOf(spec: ReadSpec): Record<string, unknown> {
  const answer = (w: Want) => ({
    type: ['object', 'null'],
    properties: {
      value:
        w.kind === 'choice' && w.choices?.length
          ? { type: ['string', 'null'], enum: [...w.choices, null] }
          : {
              type: ['number', 'money', 'percent'].includes(w.kind)
                ? ['number', 'null']
                : ['string', 'null'],
            },
      pieces: { type: 'array', items: { type: 'integer' } },
    },
    required: ['value', 'pieces'],
    additionalProperties: false,
  })
  const object = (fields: Record<string, Want>) => ({
    type: 'object',
    properties: Object.fromEntries(Object.entries(fields).map(([k, w]) => [k, answer(w)])),
    required: Object.keys(fields),
    additionalProperties: false,
  })
  return {
    type: 'object',
    properties: {
      values: object(spec.values ?? {}),
      lists: {
        type: 'object',
        properties: Object.fromEntries(
          Object.entries(spec.lists ?? {}).map(([k, l]) => [
            k,
            { type: 'array', items: object(l.fields) },
          ]),
        ),
        required: Object.keys(spec.lists ?? {}),
        additionalProperties: false,
      },
    },
    required: ['values', 'lists'],
    additionalProperties: false,
  }
}

function wantsText(spec: ReadSpec): string {
  const line = (name: string, w: Want) =>
    `- ${name}: ${w.kind}${w.choices?.length ? ` (one of ${w.choices.join(', ')})` : ''}${w.about ? `. ${w.about}` : ''}`
  const parts: string[] = []
  if (spec.about) parts.push(spec.about)
  if (spec.values && Object.keys(spec.values).length)
    parts.push(['Values:', ...Object.entries(spec.values).map(([k, w]) => line(k, w))].join('\n'))
  for (const [name, l] of Object.entries(spec.lists ?? {}))
    parts.push(
      [
        `A list, ${name}: one entry per ${l.about ?? 'item'}, each with:`,
        ...Object.entries(l.fields).map(([k, w]) => line(k, w)),
      ].join('\n'),
    )
  return parts.join('\n\n')
}

// Numbers as a piece writes them: $1,234.56, (1,234) for a loss, 1.2M, 550k, 88%.
function numbersIn(words: string): number[] {
  const out: number[] = []
  const re = /(\()?-?\$?\s?(\d[\d,]*(?:\.\d+)?|\.\d+)\s?(k|m|mm|million|thousand|%)?(\))?/gi
  for (const m of words.matchAll(re)) {
    let n = Number((m[2] ?? '').replace(/,/g, ''))
    if (!Number.isFinite(n)) continue
    const unit = (m[3] ?? '').toLowerCase()
    if (unit === 'k' || unit === 'thousand') n *= 1_000
    if (unit === 'm' || unit === 'mm' || unit === 'million') n *= 1_000_000
    if (m[1] && m[4]) n = -n
    out.push(n)
  }
  return out
}

const near = (a: number, b: number) => Math.abs(a - b) <= Math.max(1, Math.abs(b) * 0.005)

const wordsOf = (s: string) => (s.toLowerCase().match(/[a-z0-9]{3,}/g) ?? []).filter(Boolean)

// The wall: a value stands only when the pieces it cites hold it. A number is found as written,
// in thousands or millions, or as a fraction for a percent; words are all found; a date's year
// is found; a choice is a judgement over the words, so only its pieces must be there.
export function holds(want: Want, value: string | number, cited: Piece[]): string | null {
  if (!cited.length) return 'it cites no piece of the document'
  const text = cited.map((p) => p.words).join(' ')
  if (want.kind === 'number' || want.kind === 'money' || want.kind === 'percent') {
    const v = Number(value)
    if (!Number.isFinite(v)) return `${value} is not a number`
    const found = numbersIn(text).some(
      (n) =>
        near(n, v) ||
        near(n * 1_000, v) ||
        near(n * 1_000_000, v) ||
        (want.kind === 'percent' && near(n * 100, v)) ||
        near(-n, v),
    )
    return found ? null : `${v} is not in the pieces it cites`
  }
  if (want.kind === 'choice')
    return want.choices?.includes(String(value)) ? null : `${value} is not one of its choices`
  if (want.kind === 'date') {
    // its year as written: 2026, or the short year of a date like 4.30.26 or Apr '26
    const year = String(value).match(/\d{4}/)?.[0]
    const short = year?.slice(2)
    const found =
      !!year &&
      (text.includes(year) ||
        [
          ...text.matchAll(/\b\d{1,2}[./-]\d{1,2}[./-](\d{2})\b|[a-z]{3,9}\.? ?['’](\d{2})\b/gi),
        ].some((m) => (m[1] ?? m[2]) === short))
    return found ? null : `${value}: its year is not in the pieces it cites`
  }
  const have = new Set(wordsOf(text))
  const words = wordsOf(String(value))
  if (!words.length)
    return text.toLowerCase().includes(String(value).toLowerCase().trim())
      ? null
      : `"${value}" is not in the pieces it cites`
  const missing = words.filter((w) => !have.has(w))
  return missing.length
    ? `"${value}": ${missing.slice(0, 3).join(', ')} not in the pieces it cites`
    : null
}

function kept(
  name: string,
  want: Want,
  a: Answer | null | undefined,
  pieces: Piece[],
  dropped: string[],
): Found | null {
  if (!a || a.value === null || a.value === '') return null
  const cited = (a.pieces ?? []).filter((i) => Number.isInteger(i) && i >= 0 && i < pieces.length)
  const why = holds(
    want,
    a.value,
    cited.map((i) => pieces[i] as Piece),
  )
  if (why) {
    dropped.push(`${name}: ${why}`)
    return null
  }
  // its place: the first piece that holds it alone (the cell with the figure, not its label)
  const own = cited.map((i) => pieces[i] as Piece)
  const first = own.find((p) => !holds(want, a.value as string | number, [p])) ?? (own[0] as Piece)
  const { table: _t, column: _c, ...place } = first.position
  return { value: a.value, place }
}

// What the model answered, through the wall.
export function throughWall(
  spec: ReadSpec,
  answers: Answers,
  pieces: Piece[],
): Omit<ReadOut, 'tokens'> {
  const dropped: string[] = []
  const values = Object.fromEntries(
    Object.entries(spec.values ?? {}).map(([k, w]) => [
      k,
      kept(k, w, answers.values?.[k], pieces, dropped),
    ]),
  )
  const lists = Object.fromEntries(
    Object.entries(spec.lists ?? {}).map(([name, l]) => [
      name,
      (answers.lists?.[name] ?? [])
        .map((entry, i) =>
          Object.fromEntries(
            Object.entries(l.fields).map(([k, w]) => [
              k,
              kept(`${name} ${i + 1} ${k}`, w, entry?.[k], pieces, dropped),
            ]),
          ),
        )
        .filter((e) => Object.values(e).some((v) => v !== null)),
    ]),
  )
  return { values, lists, dropped }
}

export type Ask = (
  prompt: string,
  schema: Record<string, unknown>,
) => Promise<{ answer: unknown; tokens: number; uses?: Use[] }>

// One document read into what the kit wants.
export async function readInto(spec: ReadSpec, pieces: Piece[], ask: Ask): Promise<ReadOut> {
  const wanted = Object.keys(spec.values ?? {}).length + Object.keys(spec.lists ?? {}).length
  if (!wanted) throw new Refused('Say which values to read: values, or lists of rows.')
  if (!pieces.length)
    return { values: {}, lists: {}, dropped: ['the document has no words to read'], tokens: 0 }
  const prompt = `What to read:\n${wantsText(spec)}\n\nThe document, piece by piece:\n${piecesText(pieces)}`
  const { answer, tokens } = await ask(prompt, schemaOf(spec))
  return { ...throughWall(spec, answer as Answers, pieces), tokens }
}
