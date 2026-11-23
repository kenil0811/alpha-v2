// Safari's history on a Mac (Vikas, 23 Nov; proposed): ~/Library/Safari/History.db, read where it
// is, read-only and as a file that does not change while it is read, as the Chromium browsers'
// are. macOS lets it be read only with Full Disk Access for Alpha Bridge, which the person turns
// on in System Settings after saying yes to Alpha's offer; whether it is on is seen by trying.
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { pathToFileURL } from 'node:url'
import type { Visit } from './history.ts'

// Safari keeps times as seconds since 2001.
const FROM_2001 = 978_307_200_000
const DAY = 86_400_000

export const safariDir = (home: string) => join(home, 'Library', 'Safari')
export const safariHistory = (home: string) => join(safariDir(home), 'History.db')

export const NO_ACCESS =
  'Alpha Bridge cannot read Safari’s history yet: turn on Alpha Bridge in System Settings › Privacy & Security › Full Disk Access.'

const open = (file: string) => {
  const at = pathToFileURL(file)
  at.search = 'immutable=1'
  return new DatabaseSync(at, { readOnly: true })
}

// Whether the history can be read here: none when it can, else why not, in words.
export function safariBlocked(file: string): string | null {
  try {
    const db = open(file)
    try {
      db.prepare('SELECT 1 FROM history_visits LIMIT 1').get()
    } finally {
      db.close()
    }
    return null
  } catch {
    return NO_ACCESS
  }
}

export function safariVisits(file: string, days: number, now = Date.now()): Visit[] {
  const db = open(file)
  try {
    const rows = db
      .prepare(
        `SELECT i.url AS url, v.title AS title, v.visit_time AS t
           FROM history_visits v JOIN history_items i ON i.id = v.history_item
          WHERE v.visit_time > ?`,
      )
      .all((now - days * DAY - FROM_2001) / 1000) as {
      url: string
      title: string | null
      t: number
    }[]
    return rows.map((r) => ({
      url: String(r.url),
      title: String(r.title ?? ''),
      at: Math.round(r.t * 1000 + FROM_2001),
      browser: 'Safari',
    }))
  } finally {
    db.close()
  }
}
