// The browsers' history on the computer, read where it is, as a file that does not change while it
// is read (a running browser keeps it open; nothing is copied or written): which sites were opened
// on which days, and their pages' titles. Counted here; only what the readers make of it leaves the
// computer.
import { DatabaseSync } from 'node:sqlite'
import { pathToFileURL } from 'node:url'

export interface Visit {
  url: string
  title: string
  at: number // ms since 1970
  browser: string
}

// Chromium keeps times as microseconds since 1601.
const FROM_1601 = 11_644_473_600_000
const DAY = 86_400_000

export function visitsIn(
  files: { browser: string; file: string }[],
  days: number,
  now = Date.now(),
): Visit[] {
  // Chromium's times pass 2^53, so they are read and compared as big integers
  const since = BigInt(Math.floor(now - days * DAY + FROM_1601)) * 1000n
  const out: Visit[] = []
  for (const { browser, file } of files) {
    try {
      const at = pathToFileURL(file)
      at.search = 'immutable=1'
      const db = new DatabaseSync(at, { readOnly: true })
      try {
        const query = db.prepare(
          `SELECT u.url AS url, u.title AS title, v.visit_time AS t
             FROM visits v JOIN urls u ON u.id = v.url
            WHERE v.visit_time > ?`,
        )
        query.setReadBigInts(true)
        const rows = query.all(since) as { url: string; title: string | null; t: bigint }[]
        for (const r of rows)
          out.push({
            url: String(r.url),
            title: String(r.title ?? ''),
            at: Number(r.t / 1000n) - FROM_1601,
            browser,
          })
      } finally {
        db.close()
      }
    } catch {
      // a profile that cannot be read now (not a history, or not there any more) is left out
    }
  }
  return out
}

// A site's name as people say it: its host without www.; none for what is not a site on the web
// (the computer itself, the local network, a browser's own pages).
export function siteOf(url: string): string | null {
  let u: URL
  try {
    u = new URL(url)
  } catch {
    return null
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null
  const host = u.hostname.toLowerCase().replace(/^www\./, '')
  if (
    !host.includes('.') ||
    host.endsWith('.local') ||
    /^\d+\.\d+\.\d+\.\d+$/.test(host) ||
    host.startsWith('[')
  )
    return null
  return host
}

// A page's title with addresses, numbers and anything like an id taken out.
export function cleanTitle(title: string): string {
  return title
    .replace(/https?:\/\/\S+/gi, '')
    .replace(/\S+@\S+\.\S+/g, '')
    .replace(/[#\d][\d/.,:-]*/g, '')
    .replace(/\b[a-f0-9]{8,}\b/gi, '')
    .replace(/\s+/g, ' ')
    .replace(/^[\s\-–|:]+|[\s\-–|:]+$/g, '')
    .slice(0, 80)
}

// The computer's own day of a time, as its person counts days.
export const dayOf = (at: number) => {
  const d = new Date(at)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
