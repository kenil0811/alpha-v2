// What the readers make of the computer, before anything leaves it: sites by the days they were
// opened (only those on two days or more), the person's own requests to AI tools (never the
// replies), and the apps with when they were last used.
import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { basename, join } from 'node:path'
import { cleanTitle, dayOf, siteOf, type Visit } from './history.ts'

const DAY = 86_400_000

export interface Site {
  site: string
  days: number
  last: string
  titles: string
  browsers: string
}

// Each site opened on two days or more, the most days first.
export function sitesOf(visits: Visit[], least = 2): Site[] {
  const by = new Map<
    string,
    { days: Set<string>; last: number; titles: Set<string>; b: Set<string> }
  >()
  for (const v of visits) {
    const site = siteOf(v.url)
    if (!site) continue
    const s = by.get(site) ?? { days: new Set(), last: 0, titles: new Set(), b: new Set() }
    s.days.add(dayOf(v.at))
    s.last = Math.max(s.last, v.at)
    const t = cleanTitle(v.title)
    if (t && s.titles.size < 3) s.titles.add(t)
    s.b.add(v.browser)
    by.set(site, s)
  }
  return [...by.entries()]
    .filter(([, s]) => s.days.size >= least)
    .map(([site, s]) => ({
      site,
      days: s.days.size,
      last: new Date(s.last).toISOString(),
      titles: [...s.titles].join('; '),
      browsers: [...s.b].sort().join(', '),
    }))
    .sort((a, b) => b.days - a.days || a.site.localeCompare(b.site))
}

export interface Request {
  key: string
  tool: 'Claude Code' | 'Codex' | 'ChatGPT' | 'claude.ai'
  request: string
  project: string
  at: string
}

// A request as it is kept: its first lines, no longer than a few sentences.
export const firstLines = (text: string) =>
  text.trim().split('\n').filter(Boolean).slice(0, 3).join(' ').replace(/\s+/g, ' ').slice(0, 280)

// What the AI tool wrote itself into the person's turn, never their words.
const NOT_THEIRS = /^(<command-|<local-command|<system-reminder|Caveat:|\[Request interrupted)/

// Every file under a folder that ends in .jsonl, changed in the days back.
function sessions(dir: string, since: number): string[] {
  if (!existsSync(dir)) return []
  const out: string[] = []
  const walk = (d: string, depth: number) => {
    let names: string[] = []
    try {
      names = readdirSync(d)
    } catch {
      return
    }
    for (const n of names) {
      const p = join(d, n)
      let st: ReturnType<typeof statSync>
      try {
        st = statSync(p)
      } catch {
        continue
      }
      if (st.isDirectory() && depth < 5) walk(p, depth + 1)
      else if (n.endsWith('.jsonl') && st.mtimeMs >= since) out.push(p)
    }
  }
  walk(dir, 0)
  return out
}

const lines = (file: string): Record<string, unknown>[] => {
  try {
    return readFileSync(file, 'utf8')
      .split('\n')
      .filter(Boolean)
      .flatMap((l) => {
        try {
          return [JSON.parse(l) as Record<string, unknown>]
        } catch {
          return []
        }
      })
  } catch {
    return []
  }
}

// The person's own requests in Claude Code, its sessions' typed prompts: never what came back, and
// never a session another program ran through it (Alpha's own agents among them).
export function claudeRequests(dir: string, days: number, now = Date.now()): Request[] {
  const since = now - days * DAY
  const out: Request[] = []
  for (const file of sessions(dir, since)) {
    for (const o of lines(file)) {
      if (o.type !== 'user' || o.isMeta || o.isSidechain) continue
      if (typeof o.entrypoint === 'string' && o.entrypoint.startsWith('sdk')) continue
      const m = o.message as { role?: string; content?: unknown } | undefined
      if (m?.role !== 'user') continue
      const text =
        typeof m.content === 'string'
          ? m.content
          : Array.isArray(m.content) &&
              m.content.every((p) => (p as { type?: string }).type === 'text')
            ? m.content.map((p) => (p as { text?: string }).text ?? '').join('\n')
            : ''
      const at = Date.parse(String(o.timestamp ?? ''))
      if (!text.trim() || NOT_THEIRS.test(text.trim()) || !(at >= since)) continue
      out.push({
        key: `claude:${String(o.uuid ?? `${basename(file)}:${at}`)}`,
        tool: 'Claude Code',
        request: firstLines(text),
        project: basename(String(o.cwd ?? '')),
        at: new Date(at).toISOString(),
      })
    }
  }
  return out
}

// The person's own requests in Codex: each session's user messages, with its folder.
export function codexRequests(dir: string, days: number, now = Date.now()): Request[] {
  const since = now - days * DAY
  const out: Request[] = []
  for (const file of sessions(dir, since)) {
    let project = ''
    let i = 0
    for (const o of lines(file)) {
      const p = (o.payload ?? {}) as Record<string, unknown>
      if (o.type === 'session_meta') project = basename(String(p.cwd ?? ''))
      if (o.type !== 'event_msg' || p.type !== 'user_message') continue
      const text = String(p.message ?? '')
      const at = Date.parse(String(o.timestamp ?? ''))
      if (!text.trim() || !(at >= since)) continue
      out.push({
        key: `codex:${basename(file)}:${i++}`,
        tool: 'Codex',
        request: firstLines(text),
        project,
        at: new Date(at).toISOString(),
      })
    }
  }
  return out
}

// ChatGPT's and claude.ai's conversations as the browsing history has them: each one's title (what
// was asked, usually) and the last day it was opened.
export function webConversations(visits: Visit[]): Request[] {
  const by = new Map<string, Request>()
  for (const v of visits) {
    const gpt = /^https:\/\/(?:chatgpt\.com|chat\.openai\.com)\/(?:g\/[^/]+\/)?c\/([\w-]+)/.exec(
      v.url,
    )
    const cl = /^https:\/\/claude\.ai\/chat\/([\w-]+)/.exec(v.url)
    const id = gpt?.[1] ?? cl?.[1]
    if (!id) continue
    const tool = gpt ? 'ChatGPT' : 'claude.ai'
    const title = v.title.replace(/\s*[-|–]\s*(ChatGPT|Claude)\s*$/i, '').trim()
    if (!title || /^(ChatGPT|Claude|New chat)$/i.test(title)) continue
    const key = `${tool}:${id}`
    const was = by.get(key)
    if (!was || Date.parse(was.at) < v.at)
      by.set(key, {
        key,
        tool,
        request: firstLines(title),
        project: '',
        at: new Date(v.at).toISOString(),
      })
  }
  return [...by.values()]
}

export interface App {
  app: string
  last: string | null
  times: number | null
}

// The apps on a Mac, with when each was last used and how often, as Spotlight keeps it.
export function macApps(dirs: string[]): App[] {
  const out: App[] = []
  for (const dir of dirs) {
    let names: string[] = []
    try {
      names = readdirSync(dir).filter((n) => n.endsWith('.app'))
    } catch {
      continue
    }
    for (const n of names) {
      const path = join(dir, n)
      let last: string | null = null
      let times: number | null = null
      try {
        const said = execFileSync(
          'mdls',
          ['-raw', '-name', 'kMDItemLastUsedDate', '-name', 'kMDItemUseCount', path],
          { encoding: 'utf8', timeout: 5000 },
        ).split('\0')
        const when = Date.parse(said[0]?.replace(' +0000', 'Z').replace(' ', 'T') ?? '')
        last = Number.isNaN(when) ? null : new Date(when).toISOString()
        const count = Number(said[1])
        times = Number.isFinite(count) ? count : null
      } catch {
        // Spotlight says nothing of it: installed, and no more
      }
      out.push({ app: n.replace(/\.app$/, ''), last, times })
    }
  }
  return out
}

// The apps installed on Windows, by their uninstall entries (Windows keeps no last use).
export function windowsApps(): App[] {
  const keys = [
    'HKLM\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall',
    'HKLM\\Software\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall',
    'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall',
  ]
  const names = new Set<string>()
  for (const k of keys) {
    try {
      const said = execFileSync('reg', ['query', k, '/s', '/v', 'DisplayName'], {
        encoding: 'utf8',
        timeout: 20_000,
        maxBuffer: 16 * 1024 * 1024,
      })
      for (const m of said.matchAll(/DisplayName\s+REG_SZ\s+(.+)/g))
        if (m[1]?.trim()) names.add(m[1].trim())
    } catch {
      // that part of the registry is not there
    }
  }
  return [...names].sort().map((app) => ({ app, last: null, times: null }))
}
