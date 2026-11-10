// Backups of the world: once a day by SQLite's backup API, never a copy of the file;
// the last 7 days kept, and one a week for the 4 weeks before. The backups taken before a
// migration are kept apart and never pruned here. Beside the world, the backup mirrors the
// modules and the files by hash, so a lost Mac keeps the whole business (item 17 of the
// problems list, 25 Oct): a file is copied once, since its hash never changes, at every tick;
// the modules are refreshed once a day, with the world.
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { join, relative } from 'node:path'
import { backup } from 'node:sqlite'
import { type Manifest, manifestOf } from './audit.ts'
import { dayOf, dayPlus, weekdayOf } from './day.ts'
import { type Db, json } from './db.ts'

const DAILY = /^world-daily-(\d{4}-\d{2}-\d{2})\.sqlite$/

// The Monday of a day's week, as its key.
function weekOf(day: string): string {
  return dayPlus(day, -weekdayOf(day))
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

// Where the world's files and modules live, mirrored beside the backups.
export interface Beside {
  files: string
  modules: string
}

function walk(root: string, dir = root, out: string[] = []): string[] {
  if (!existsSync(dir)) return out
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory()) walk(root, p, out)
    else if (e.isFile()) out.push(relative(root, p))
  }
  return out
}

// The files by hash copied once each (cheap, so at every tick), the modules refreshed whole
// (once a day, with the world). Says how many files came.
export function mirror(
  beside: Beside,
  dir: string,
  options: { modules?: boolean } = {},
): { files: number } {
  let files = 0
  const to = join(dir, 'files')
  for (const rel of walk(beside.files)) {
    const target = join(to, rel)
    if (existsSync(target)) continue
    mkdirSync(join(target, '..'), { recursive: true })
    cpSync(join(beside.files, rel), target)
    files += 1
  }
  if (options.modules !== false && existsSync(beside.modules)) {
    const modules = join(dir, 'modules')
    rmSync(modules, { recursive: true, force: true })
    cpSync(beside.modules, modules, { recursive: true })
  }
  return { files }
}

// What the daily backups recorded of the chain, each kept beside its day (rules A3).
export function readManifests(dir: string): Manifest[] {
  // a folder that cannot be read is the daily backup's to report, never a reason not to start
  if (!existsSync(dir) || !statSync(dir).isDirectory()) return []
  return readdirSync(dir)
    .filter((n) => /^world-daily-\d{4}-\d{2}-\d{2}\.json$/.test(n))
    .flatMap((n) => {
      try {
        return [JSON.parse(readFileSync(join(dir, n), 'utf8')) as Manifest]
      } catch {
        return []
      }
    })
}

// Today's backup, when there is none yet, with the modules and files mirrored beside it; then
// the old worlds pruned. Says the file it made.
export async function backupDaily(
  db: Db,
  dir: string,
  today = new Date(),
  beside: Beside | null = null,
): Promise<string | null> {
  mkdirSync(dir, { recursive: true })
  const day = dayOf(today) // the person's own day (Batch A, pick 4)
  const days = readdirSync(dir)
    .map((n) => DAILY.exec(n)?.[1])
    .filter((d): d is string => !!d)
  let made: string | null = null
  if (!days.includes(day)) {
    made = join(dir, `world-daily-${day}.sqlite`)
    await backup(db, made)
    days.push(day)
    // where the chain had got to, outside the world (rules A3); kept when the backup is pruned
    const manifest = manifestOf(db, day)
    if (manifest) writeFileSync(join(dir, `world-daily-${day}.json`), json(manifest))
  }
  // new files go beside the world at every tick; the modules once a day, with the world
  if (beside) mirror(beside, dir, { modules: made !== null })
  const keep = kept(days)
  for (const d of days)
    if (!keep.has(d)) rmSync(join(dir, `world-daily-${d}.sqlite`), { force: true })
  return made
}
