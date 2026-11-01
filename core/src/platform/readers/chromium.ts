// The Chromium browsers' history (onboarding design §4): Chrome now, Edge, Brave and Arc later as
// rows of a list, the same file on every computer. The browser keeps it locked, so it is read from
// a copy with its -wal and -journal, removed after. Raw rows only: what is counted and what is
// left out is the connector's.
import { copyFileSync, existsSync, mkdtempSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'

export interface Visit {
  profile: string
  url: string
  title: string
  at: string // ISO
}

// Chromium's moments: microseconds since 1 January 1601, past what a JavaScript number holds.
const GAP_MS = 11_644_473_600_000n
export const fromChromium = (us: bigint): string =>
  new Date(Number(us / 1000n - GAP_MS)).toISOString()
export const toChromium = (at: string): bigint => (BigInt(Date.parse(at)) + GAP_MS) * 1000n

// The profiles in a Chromium browser's own folder (Default, Profile 1…) that keep a history.
export function profiles(root: string): string[] {
  if (!existsSync(root)) return []
  return readdirSync(root)
    .filter((n) => n === 'Default' || /^Profile \d+$/.test(n))
    .filter((n) => existsSync(join(root, n, 'History')))
    .sort()
}

// Every visit since a moment, in every profile, oldest first.
export function chromiumVisits(root: string, since: string): Visit[] {
  const out: Visit[] = []
  for (const profile of profiles(root)) {
    const dir = mkdtempSync(join(tmpdir(), 'alpha-history-'))
    try {
      for (const suffix of ['', '-wal', '-journal']) {
        const from = join(root, profile, `History${suffix}`)
        if (existsSync(from)) copyFileSync(from, join(dir, `History${suffix}`))
      }
      // the copy is Alpha's own, so a journal the browser left is rolled back in it
      const db = new DatabaseSync(join(dir, 'History'))
      try {
        const read = db.prepare(
          'SELECT u.url AS url, u.title AS title, v.visit_time AS t FROM visits v JOIN urls u ON u.id = v.url WHERE v.visit_time > ? ORDER BY v.visit_time',
        )
        read.setReadBigInts(true)
        const rows = read.all(toChromium(since)) as {
          url: string
          title: string | null
          t: bigint
        }[]
        for (const r of rows)
          out.push({ profile, url: r.url, title: r.title ?? '', at: fromChromium(r.t) })
      } finally {
        db.close()
      }
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  }
  return out
}
