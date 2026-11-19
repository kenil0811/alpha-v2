// The walls every line the Interviewer proposes meets, in code (the onboarding plan, call 25; rules
// I1, I3, I4): it cites what was read or answered, and only that; it cites nothing the person
// skipped; it names no site or file nothing read held; it says "you said" only of their own words;
// and it is not one they declined. Rewritten from answer.ts on the reference branch.

// What a line may rest on, for one person at one moment.
export interface Readable {
  cites: Set<string> // row <id>, file <hash>, line <id> of the sources they allowed
  skipped: Set<string> // the same of the sources they skipped
  answers: Map<string, string> // card id to their answer, on the Interviewer's cards
  text: string // everything read and answered, lower case
  declined: Set<string> // the words of what they dropped or declined, as sameAs says them
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

// A citation as written: "row r_1", "answer c_2", "page https://…", "file ab12…", "line 40".
export const CITE = /^(row|answer|page|file|line)\s+(\S+)$/

// Why a line is refused, or none when it may stand.
export function wall(words: string[], restsOn: string[], r: Readable): string | null {
  const cites = restsOn.map((c) => c.trim()).filter(Boolean)
  if (!cites.length) return 'it cites nothing read or answered'
  for (const c of cites) {
    const m = CITE.exec(c)
    if (!m) return `“${c}” is not a citation: say row, answer, page, file or line, then its id`
    const [, kind, id] = m as unknown as [string, string, string]
    if (r.skipped.has(c)) return `it cites ${c}, from a source the person skipped`
    if (kind === 'answer') {
      if (!r.answers.has(id)) return `it cites ${c}, which is no answer of theirs`
    } else if (kind === 'page') {
      const host = /^https?:\/\/([^/]+)/i.exec(id)?.[1]?.toLowerCase()
      if (!host || !r.text.includes(host.replace(/^www\./, '')))
        return `it cites ${c}, a page of a site nothing read or answered holds`
    } else if (!r.cites.has(c)) return `it cites ${c}, which nothing read holds`
  }
  const all = words.join('\n')
  const odd = (all.match(NAMED) ?? []).find((n) => !r.text.includes(n.toLowerCase()))
  if (odd) return `it names ${odd}, which nothing read holds`
  const heard = cites
    .filter((c) => c.startsWith('answer '))
    .map((c) => r.answers.get(c.slice(7)) ?? '')
    .join('\n')
    .toLowerCase()
  for (const q of all.matchAll(/you (?:said|told me|wrote)[,:]?\s*[“"]([^”"]+)[”"]/gi))
    if (!heard.includes((q[1] ?? '').toLowerCase().trim()))
      return `it says you said “${q[1]}”, which is not in the answers it cites`
  if (/you (said|told me|wrote)\b/i.test(all) && !heard)
    return 'it says you said something, and cites no answer of theirs'
  if (r.declined.has(sameAs(all))) return 'the person dropped or declined it before'
  return null
}
