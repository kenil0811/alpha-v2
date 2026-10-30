// Research, a workspace skill of Alpha's (30 Oct; decision 13 kept: a skill, not a character).
// A bounded web look before a build that is not exact, or when the person asks: competitors (new
// startups too), open-source alternatives with their licence and activity, and common practice,
// as one short brief ranked by value (impact × reach ÷ effort, 1–5 each). The model plans the
// searches and writes the brief (config/research.md), each in a schema; code does the searching
// and reading through the browser engine (a person's pace, robots kept, stopping at a sign-in or
// a bot check), keeps to the bounds in limits.yaml, and keeps a line only when a source it cites
// resolves. Reading only: nothing is signed in to, sent or kept.
import type { BrowserEngine } from '@alpha/connector-sdk'
import { config } from '../config.ts'
import type { Ask } from '../files/reading.ts'

export interface Web {
  search(words: string): Promise<{ title: string; url: string }[]>
  open(url: string): Promise<{ url: string; title: string; text: string }>
  resolves(url: string): Promise<boolean>
}

export interface BriefLine {
  kind: 'competitor' | 'open_source' | 'practice'
  name: string
  line: string
  licence: string | null
  activity: string | null
  better: string | null
  worse: string | null
  use: 'learn' | 'reuse' | 'neither' | null
  impact: number
  reach: number
  effort: number
  value: number
  sources: string[]
}

export interface Brief {
  ask: string
  lines: BriefLine[]
  dropped: number // lines left out: no source of theirs resolved
  searches: number
  pages: number
  tokens: number
  words: string
}

const KINDS = ['competitor', 'open_source', 'practice'] as const
const USES = ['learn', 'reuse', 'neither'] as const
const score = (n: unknown) => Math.min(5, Math.max(1, Math.round(Number(n) || 1)))
const http = (u: string) => {
  try {
    return ['http:', 'https:'].includes(new URL(u).protocol)
  } catch {
    return false
  }
}

// The web as the browser engine reads it: a search is the results page of the search url in
// limits.yaml, its links to other sites the results; a page is opened as any reader's is; a
// source resolves when it answers with a status under 400.
export function webOf(engine: () => BrowserEngine): Web {
  return {
    async search(words) {
      const url = config.limits().research_search_url.replace('{q}', encodeURIComponent(words))
      const host = new URL(url).hostname.split('.').slice(-2).join('.')
      const page = await engine().open(url)
      const out: { title: string; url: string }[] = []
      for (const l of page.links) {
        let href = l.href
        try {
          // a search engine's own redirect carries the result in a parameter
          const u = new URL(href)
          href = u.searchParams.get('uddg') ?? u.searchParams.get('u') ?? href
          if (new URL(href).hostname.endsWith(host)) continue
        } catch {
          continue
        }
        if (l.text && http(href) && !out.some((o) => o.url === href))
          out.push({ title: l.text, url: href })
      }
      return out.slice(0, 10)
    },
    async open(url) {
      const p = await engine().open(url)
      return { url: p.url, title: p.title, text: p.text }
    },
    async resolves(url) {
      const go = (method: string) =>
        fetch(url, { method, redirect: 'follow', signal: AbortSignal.timeout(10_000) })
      try {
        const head = await go('HEAD')
        if (head.status < 400) return true
        return (await go('GET')).status < 400
      } catch {
        return false
      }
    },
  }
}

const PLAN = {
  type: 'object',
  properties: { searches: { type: 'array', items: { type: 'string' } } },
  required: ['searches'],
  additionalProperties: false,
}

const BRIEF = {
  type: 'object',
  properties: {
    lines: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          kind: { type: 'string', enum: [...KINDS] },
          name: { type: 'string' },
          line: { type: 'string' },
          licence: { type: 'string' },
          activity: { type: 'string' },
          better: { type: 'string' },
          worse: { type: 'string' },
          use: { type: 'string', enum: [...USES] },
          impact: { type: 'integer' },
          reach: { type: 'integer' },
          effort: { type: 'integer' },
          sources: { type: 'array', items: { type: 'string' } },
        },
        required: ['kind', 'name', 'line', 'impact', 'reach', 'effort', 'sources'],
        additionalProperties: false,
      },
    },
  },
  required: ['lines'],
  additionalProperties: false,
}

// One brief: plan, search, read, write, check. Past a bound it writes from what it has.
export async function research(
  ask: Ask,
  web: Web,
  q: { ask: string; about?: string | null },
  log: (words: string) => void = () => {},
  clock: () => number = Date.now,
): Promise<Brief> {
  const l = config.limits()
  const until = clock() + l.research_minutes * 60_000
  const late = () => clock() >= until
  let tokens = 0
  const about = q.about?.trim() ? `\nWhat Alpha knows of the business: ${q.about.trim()}` : ''
  const plan = await ask(
    `Step 1, plan. The ask: ${q.ask}${about}\nGive at most ${l.research_searches} web searches.`,
    PLAN,
  )
  tokens += plan.tokens
  const searches = ((plan.answer as { searches?: unknown[] })?.searches ?? [])
    .map((s) => String(s).trim())
    .filter(Boolean)
    .slice(0, l.research_searches)
  // results by search, then read round-robin so every search gets its best pages read
  const found: { title: string; url: string }[][] = []
  let searched = 0
  for (const s of searches) {
    if (late()) break
    searched += 1
    try {
      found.push(await web.search(s))
    } catch (err) {
      log(`The search “${s}” was not read: ${err instanceof Error ? err.message : String(err)}`)
    }
  }
  const queue: string[] = []
  for (let i = 0; found.some((r) => r[i]); i++)
    for (const r of found) {
      const u = r[i]?.url
      if (u && !queue.includes(u)) queue.push(u)
    }
  const pages: { url: string; title: string; text: string }[] = []
  for (const url of queue) {
    if (pages.length >= l.research_pages || late()) break
    try {
      const p = await web.open(url)
      pages.push({ ...p, text: p.text.slice(0, l.research_page_chars) })
    } catch (err) {
      // a sign-in, a bot check, robots: left, as any reader leaves it
      log(`${url} was not read: ${err instanceof Error ? err.message : String(err)}`)
    }
  }
  log(
    `Searched ${searched} time${searched === 1 ? '' : 's'} and read ${pages.length} page${pages.length === 1 ? '' : 's'}.`,
  )
  const written = await ask(
    [
      `Step 2, brief. The ask: ${q.ask}${about}`,
      pages.length
        ? `The pages read:\n${pages.map((p) => `### ${p.url}\n${p.title}\n${p.text}`).join('\n\n')}`
        : 'No page could be read.',
    ].join('\n\n'),
    BRIEF,
  )
  tokens += written.tokens
  const read = new Set(pages.map((p) => p.url))
  const checked = new Map<string, boolean>()
  const resolves = async (u: string): Promise<boolean> => {
    if (!http(u)) return false
    if (read.has(u)) return true
    if (!checked.has(u)) checked.set(u, await web.resolves(u))
    return checked.get(u) as boolean
  }
  const lines: BriefLine[] = []
  let dropped = 0
  for (const x of ((written.answer as { lines?: unknown[] })?.lines ?? []) as Record<
    string,
    unknown
  >[]) {
    const text = (k: string) => (typeof x[k] === 'string' && x[k] ? String(x[k]).trim() : null)
    const cited = [...new Set((Array.isArray(x.sources) ? x.sources : []).map(String))]
    const sources: string[] = []
    for (const u of cited) if (await resolves(u)) sources.push(u)
    // a wall: every line cited, by a source that resolves
    if (!sources.length || !text('line') || !text('name')) {
      dropped += 1
      continue
    }
    const kind = KINDS.find((k) => k === x.kind) ?? 'practice'
    const impact = score(x.impact)
    const reach = score(x.reach)
    const effort = score(x.effort)
    lines.push({
      kind,
      name: text('name') as string,
      line: text('line') as string,
      licence: text('licence'),
      activity: text('activity'),
      better: text('better'),
      worse: text('worse'),
      use: USES.find((u) => u === x.use) ?? null,
      impact,
      reach,
      effort,
      value: Math.round(((impact * reach) / effort) * 10) / 10,
      sources,
    })
  }
  lines.sort((a, b) => b.value - a.value || a.name.localeCompare(b.name))
  return {
    ask: q.ask,
    lines,
    dropped,
    searches: searched,
    pages: pages.length,
    tokens,
    words: briefWords(q.ask, lines, dropped),
  }
}

const KIND_WORDS = { competitor: 'Competitor', open_source: 'Open source', practice: 'Practice' }

// The brief as the person reads it: a line each, best value first, each with its sources.
export function briefWords(ask: string, lines: BriefLine[], dropped: number): string {
  if (!lines.length)
    return `Nothing found for “${ask}” that a source could back${dropped ? ` (${dropped} line${dropped === 1 ? '' : 's'} left out: no source resolved)` : ''}.`
  return [
    `Research on “${ask}”, by value (impact × reach ÷ effort):`,
    ...lines.map((b, i) => {
      const more = [
        b.licence && `licence ${b.licence}`,
        b.activity,
        b.better && `better: ${b.better}`,
        b.worse && `worse: ${b.worse}`,
        b.use === 'reuse' ? 'reuse it' : b.use === 'learn' ? 'learn from it' : null,
      ].filter(Boolean)
      return `${i + 1}. ${KIND_WORDS[b.kind]}, ${b.name}: ${b.line}${more.length ? ` (${more.join('; ')})` : ''}. Value ${b.value} (I${b.impact} R${b.reach} E${b.effort}). ${b.sources.join(' ')}`
    }),
    ...(dropped
      ? [`${dropped} line${dropped === 1 ? '' : 's'} left out: no source resolved.`]
      : []),
  ].join('\n')
}
