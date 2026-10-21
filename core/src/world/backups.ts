// Backups of the world (design §4): once a day by SQLite's backup API, never a copy of the file;
// the last 7 days kept, and one a week for the 4 weeks before. The backups taken before a
// migration are kept apart and never pruned here.
import { mkdirSync, readdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { backup } from 'node:sqlite'
import type { Db } from './db.ts'

const DAILY = /^world-daily-(\d{4}-\d{2}-\d{2})\.sqlite$/

// The Monday of a day's week, as its key.
function weekOf(day: string): string {
  const d = new Date(`${day}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7))
  return d.toISOString().slice(0, 10)
}

// Which daily backups stay: the 7 newest days, then the newest of each of the 4 weeks before.
export function kept(days: string[]): Set<string> {
  const sorted = [...days].sort().reverse()
  const keep = new Set(sorted.slice(0, 7))
  const weeks = new Set<string>()
  for (const day of sorted.slice(7)) {
    const w = weekOf(day)
    if (weeks.has(w) || weeks.size >= 4) continue
    weeks.add(w)
    keep.add(day)
  }
  return keep
}

// Today's backup, when there is none yet; then the old ones pruned. Says the file it made.
export async function backupDaily(db: Db, dir: string, today = new Date()): Promise<string | null> {
  mkdirSync(dir, { recursive: true })
  const day = today.toISOString().slice(0, 10)
  const days = readdirSync(dir)
    .map((n) => DAILY.exec(n)?.[1])
    .filter((d): d is string => !!d)
  let made: string | null = null
  if (!days.includes(day)) {
    made = join(dir, `world-daily-${day}.sqlite`)
    await backup(db, made)
    days.push(day)
  }
  const keep = kept(days)
  for (const d of days)
    if (!keep.has(d)) rmSync(join(dir, `world-daily-${d}.sqlite`), { force: true })
  return made
}
