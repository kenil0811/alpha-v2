// A number, an amount or a date Alpha calls stated is in the person's words (docs/rules.md, D5;
// Kenil's calls, 5 Nov): looked for in the message its value rests on. Numbers as written (40,
// 1,200, 12.5k, 1.2 million); dates as written (2026-11-05, 5 Nov, November 5, 5/11) or as the
// person's day words (today, tomorrow, yesterday, a weekday, this week, next week), on the day they
// wrote. One not found lands as assumed, Alpha's, so the person sees which to check. Text and
// choices are the person's words as Alpha put them, and are not looked for.
import { dayOf, dayPlus } from '../day.ts'
import { one } from '../db.ts'
import type { Provenance } from '../kinds.ts'
import type { Table } from '../shape/index.ts'
import type { RecordCtx } from './types.ts'

export const NOT_IN_WORDS = 'Alpha’s, not in your words'

const SCALE: Record<string, number> = {
  k: 1e3,
  thousand: 1e3,
  m: 1e6,
  mm: 1e6,
  million: 1e6,
  bn: 1e9,
  b: 1e9,
  billion: 1e9,
}

// Small numbers said as words: "log two eggs", "a dozen", "a coffee".
const SAID: Record<string, number> = Object.fromEntries(
  [
    'zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen',
    'fifteen sixteen seventeen eighteen nineteen twenty',
  ]
    .join(' ')
    .split(' ')
    .map((w, i) => [w, i]),
)
Object.assign(SAID, {
  a: 1,
  an: 1,
  couple: 2,
  dozen: 12,
  half: 0.5,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
  hundred: 100,
})

// Every number the words hold, as written and as scaled ("12.5k" is 12.5 and 12,500), and the
// small ones said as words.
export function numbersIn(words: string): number[] {
  const out: number[] = []
  for (const w of words.toLowerCase().match(/[a-z]+/g) ?? [])
    if (SAID[w] !== undefined) out.push(SAID[w] as number)
  for (const m of words.matchAll(
    /(\d[\d,]*(?:\.\d+)?|\.\d+)\s*(k|thousand|mm|m|million|bn|b|billion)?\b/gi,
  )) {
    const n = Number((m[1] as string).replace(/,/g, ''))
    if (!Number.isFinite(n)) continue
    out.push(n)
    const scale = m[2] ? SCALE[m[2].toLowerCase()] : undefined
    if (scale) out.push(n * scale)
  }
  return out
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
const weekdayOf = (day: string) => new Date(`${day}T12:00:00Z`).getUTCDay()

// Whether the words name this day, written or as a day word on the day they were written.
export function dateIn(words: string, day: string, writtenOn: string): boolean {
  const w = words.toLowerCase()
  if (w.includes(day)) return true
  const [, mm, dd] = day.split('-').map(Number) as [number, number, number]
  const month = MONTHS[mm - 1] as string
  const d = String(dd)
  if (new RegExp(`\\b${d}(st|nd|rd|th)?\\s+(of\\s+)?${month}`).test(w)) return true
  if (new RegExp(`\\b${month}[a-z]*\\.?\\s+${d}(st|nd|rd|th)?\\b`).test(w)) return true
  if (new RegExp(`\\b(${d}/${mm}|${mm}/${d})(/\\d{2,4})?\\b`).test(w)) return true
  const words_: [RegExp, number][] = [
    [/\btoday\b|\btonight\b/, 0],
    [/\bday after tomorrow\b/, 2],
    [/\btomorrow\b/, 1],
    [/\byesterday\b/, -1],
  ]
  for (const [re, n] of words_) if (re.test(w) && dayPlus(writtenOn, n) === day) return true
  // a weekday named: the coming one, or this week's
  const named = WEEKDAYS[weekdayOf(day)] as string
  const ahead = (Date.parse(day) - Date.parse(writtenOn)) / 86_400_000
  if (new RegExp(`\\b${named}\\b`).test(w) && ahead >= -6 && ahead <= 13) return true
  if (/\bthis week\b/.test(w) && ahead >= 0 && ahead <= 6) return true
  if (/\bnext week\b/.test(w) && ahead >= 1 && ahead <= 13) return true
  return false
}

// The value a field holds, in the person's words or not; a kind not checked is theirs.
function inWords(kind: string, value: unknown, words: string, writtenOn: string): boolean {
  if (value === null || value === undefined) return true
  if (kind === 'number') {
    const n = Number(value)
    return numbersIn(words).some((x) => Math.abs(x - n) < 1e-9 * Math.max(1, Math.abs(n)))
  }
  if (kind === 'money') {
    const n = Number((value as { amount?: unknown }).amount)
    return numbersIn(words).some((x) => Math.abs(x - n) < 1e-9 * Math.max(1, Math.abs(n)))
  }
  if (kind === 'date') return dateIn(words, String(value).slice(0, 10), writtenOn)
  return true
}

// Alpha's stated numbers, amounts and dates, each checked against the message it rests on; one
// not there becomes assumed. The person's own values, by hand or on a card, are theirs.
export function checkStated(
  db: Parameters<typeof one>[0],
  table: Table,
  vals: Record<string, unknown>,
  prov: Record<string, Provenance>,
  ctx: RecordCtx,
): void {
  if (ctx.actor.kind !== 'alpha') return
  for (const f of table.fields) {
    const p = prov[f.id]
    if (p?.kind !== 'stated' || p.source.message === undefined || !(f.id in vals)) continue
    if (!['number', 'money', 'date'].includes(f.kind)) continue
    const line = one<{ words: string; at: string }>(
      db,
      'SELECT words, at FROM journal WHERE id = ?',
      p.source.message,
    )
    if (line && inWords(f.kind, vals[f.id], line.words, dayOf(new Date(line.at)))) continue
    prov[f.id] = { kind: 'assumed', source: {}, basis: NOT_IN_WORDS, at: p.at }
  }
}
