// The web addresses an agent was shown in its conversation, and the sites the person named in it.
// A link copied as shown carries none of the person's data, since whoever wrote it had not seen
// it; an address the agent writes itself might (docs/rules.md L1). Shown means in the person's
// message or in what came in from outside (a page, a search, a connector's read), and never an
// address that was first in something the agent wrote, so nothing it writes can come back as
// shown. Kept for a desk's session.
import { onList } from '../modules/runs/reach.ts'

// plain links, an href's value, and a Markdown link's target
const PLAIN = /https?:\/\/[^\s<>"'`\\)\]}|]+/gi
const HREF = /href\s*=\s*["']([^"']+)["']/gi
const MARKDOWN = /\]\(([^)\s]+)\)/g
// a site's name said bare ("example.com"), not inside an email address or a longer word
const SITE = /(?<![@\w.-])((?:[a-z0-9-]+\.)+[a-z]{2,})(?::\d+)?(?![\w-])/gi

// an address as matched: the site's name in small letters (the URL does that), no #part
export function addressOf(url: string, base?: string): string | null {
  try {
    const u = new URL(url, base)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
    u.hash = ''
    return u.href
  } catch {
    return null
  }
}

export function hostOf(url: string): string | null {
  try {
    return new URL(url).host.toLowerCase()
  } catch {
    return null
  }
}

export class ShownLinks {
  private links = new Set<string>()
  private sites = new Set<string>()
  private written = new Set<string>()

  // a new session starts with nothing shown
  clear(): void {
    this.links.clear()
    this.sites.clear()
    this.written.clear()
  }

  // every address in what came in; one written short counts as the address it points to on the
  // page it came from
  add(text: string, base?: string): void {
    for (const a of addresses(text, base)) if (!this.written.has(a)) this.links.add(a)
  }

  // every address in what the agent wrote into a call: never shown, whatever echoes it back
  wrote(text: string): void {
    for (const a of addresses(text)) this.written.add(a)
  }

  // the person's own message: its links, and the sites it names, for the rest of the session
  said(text: string): void {
    this.add(text)
    for (const m of text.matchAll(PLAIN)) {
      const host = hostOf(m[0])
      if (host) this.sites.add(host)
    }
    for (const m of text.matchAll(SITE)) this.sites.add((m[0] as string).toLowerCase())
  }

  shown(url: string): boolean {
    const a = addressOf(url)
    return !!a && this.links.has(a)
  }

  named(host: string): boolean {
    return onList([...this.sites], host)
  }
}

function addresses(text: string, base?: string): string[] {
  const trim = (s: string) => s.replace(/[.,;:!?'"]+$/, '')
  return [
    ...[...text.matchAll(PLAIN)].map((m) => addressOf(trim(m[0]))),
    ...[...text.matchAll(HREF)].map((m) => addressOf(m[1] as string, base)),
    ...[...text.matchAll(MARKDOWN)].map((m) => addressOf(trim(m[1] as string), base)),
  ].filter((a): a is string => !!a)
}
