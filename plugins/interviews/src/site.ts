// The workspace's own website, read in the background once the owner allows it in Get to know
// you (the redesign's call 20): its front page and the public pages it links to on the same site,
// as plain words, each citable as page <address>. Nothing behind a sign-in, nothing elsewhere.
import type { Found } from './sources.ts'

const PAGES = 7 // the front page and the six it links to first
const WORDS = 4000 // of each page, for the draft

// A page's words: no scripts, styles or tags, its spaces folded.
export const wordsOf = (html: string) =>
  html
    .replace(/<(script|style|noscript)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#39;|&rsquo;/g, '’')
    .replace(/\s+/g, ' ')
    .trim()

// The pages a page links to on the same site, in the order they come, once each.
export function linksIn(html: string, base: URL): URL[] {
  const out: URL[] = []
  for (const m of html.matchAll(/<a\b[^>]*\bhref\s*=\s*["']([^"'#]+)["']/gi)) {
    try {
      const u = new URL(m[1] ?? '', base)
      u.hash = ''
      if (u.host !== base.host || !/^https?:$/.test(u.protocol)) continue
      if (/\.(pdf|jpe?g|png|gif|svg|zip|docx?|xlsx?)$/i.test(u.pathname)) continue
      if (!out.some((x) => x.href === u.href) && u.href !== base.href) out.push(u)
    } catch {
      // not an address
    }
  }
  return out
}

async function page(url: URL): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; Alpha)' },
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok || !/html/i.test(res.headers.get('content-type') ?? '')) return null
    return await res.text()
  } catch {
    return null
  }
}

export interface SitePages {
  pages: { url: string; text: string }[]
}

// The site's pages as Get to know you found them, with what may be cited from them.
export async function readSite(address: string): Promise<SitePages & { found: Found }> {
  const front = new URL(address)
  const first = await page(front)
  if (first === null)
    return {
      pages: [],
      found: {
        words: `${front.host} did not answer, so nothing was read from it.`,
        cites: [],
        text: '',
      },
    }
  const pages = [{ url: front.href, text: wordsOf(first).slice(0, WORDS) }]
  for (const u of linksIn(first, front).slice(0, PAGES - 1)) {
    const html = await page(u)
    if (html !== null) pages.push({ url: u.href, text: wordsOf(html).slice(0, WORDS) })
  }
  return {
    pages,
    found: {
      words: `${pages.length} page${pages.length === 1 ? '' : 's'} of ${front.host}: ${pages
        .map((p) => new URL(p.url).pathname)
        .join(', ')}.`,
      cites: pages.map((p) => `page ${p.url}`),
      text: [front.host, ...pages.map((p) => p.text)].join('\n'),
    },
  }
}
