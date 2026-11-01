// The person's own data, from within Alpha (decision 12, step 4; the decisions doc's section 2):
// what the world holds and weighs, a backup now, going back to one, taking the data as one
// archive in the open format (docs/data.md), bringing it in on a fresh install, a copy of the
// newest backup in a folder of theirs, and removing it all on their word. The `alpha` command
// calls the same code with the core stopped.
import { execFileSync } from 'node:child_process'
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { backup, DatabaseSync } from 'node:sqlite'
import type { SecretStore } from '@alpha/connector-sdk'
import type { BackupView, DataPageView } from './api/types.ts'
import { KEY_REF } from './engine/route.ts'
import type { Install } from './install.ts'
import type { Platform } from './platform/index.ts'
import { exportLines } from './world/audit.ts'
import { type Beside, mirror } from './world/backups.ts'
import { dayOf } from './world/day.ts'
import { one } from './world/db.ts'
import { Refused } from './world/kinds.ts'
import type { TenantPaths, World } from './world/world.ts'

export type { BackupView, DataPageView } from './api/types.ts'

const NAMES = {
  daily: /^world-daily-(\d{4}-\d{2}-\d{2})\.sqlite$/,
  now: /^world-now-(.+)\.sqlite$/,
  before: /^world-before-(.+)\.sqlite$/,
  migration: /^world-(.+)-v\d+\.sqlite$/,
}

function sizeOf(path: string): { size: number; count: number } {
  if (!existsSync(path)) return { size: 0, count: 0 }
  const st = statSync(path)
  if (!st.isDirectory()) return { size: st.size, count: 1 }
  let size = 0
  let count = 0
  for (const e of readdirSync(path)) {
    const s = sizeOf(join(path, e))
    size += s.size
    count += s.count
  }
  return { size, count }
}

const stamp = (d = new Date()) => d.toISOString().replace(/[:.]/g, '-').replace('T', '-')

export function listBackups(dir: string): BackupView[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .flatMap((name): BackupView[] => {
      const kind = (Object.keys(NAMES) as (keyof typeof NAMES)[]).find((k) => NAMES[k].test(name))
      if (!kind) return []
      const st = statSync(join(dir, name))
      return [{ name, at: st.mtime.toISOString(), size: st.size, kind }]
    })
    .sort((a, b) => b.at.localeCompare(a.at))
}

// Where Take my data puts its archive: the Desktop where there is one.
export function exportsDir(): string {
  const desk = join(homedir(), 'Desktop')
  return existsSync(desk) ? desk : homedir()
}

export function dataView(world: World, install: Install): DataPageView {
  const p = world.paths
  const worldSize = ['', '-wal'].reduce(
    (n, s) => n + (existsSync(p.world + s) ? statSync(p.world + s).size : 0),
    0,
  )
  return {
    world: {
      size: worldSize,
      rows: one<{ n: number }>(world.db, 'SELECT count(*) AS n FROM records')?.n ?? 0,
      lines: world.lastLineId(),
      version: one<{ user_version: number }>(world.db, 'PRAGMA user_version')?.user_version ?? 0,
    },
    files: sizeOf(p.files),
    modules: { size: sizeOf(p.modules).size },
    backups: listBackups(p.backups),
    copyTo: install.backupsCopy,
    exportsTo: exportsDir(),
  }
}

// A backup now, by the backup API, named for the moment; a journal line.
export async function backupNow(
  world: World,
  by: { user: string },
  kind: 'now' | 'before' = 'now',
): Promise<BackupView> {
  mkdirSync(world.paths.backups, { recursive: true })
  const name = `world-${kind}-${stamp()}.sqlite`
  const file = join(world.paths.backups, name)
  await backup(world.db, file)
  world.line({
    actor: { kind: 'person', id: by.user },
    kind: 'backup',
    words: kind === 'now' ? 'Backed up the world.' : 'Backed up the world before going back.',
    data: { file: name },
    user: by.user,
  })
  const st = statSync(file)
  return { name, at: st.mtime.toISOString(), size: st.size, kind }
}

// A backup put back as the world, with the world closed: by the backup API, never a copy.
export async function restoreWorld(paths: TenantPaths, file: string): Promise<void> {
  if (!existsSync(file)) throw new Refused('That backup is not there.')
  const from = new DatabaseSync(file, { readOnly: true })
  try {
    for (const s of ['-wal', '-shm']) rmSync(paths.world + s, { force: true })
    await backup(from, paths.world)
  } finally {
    from.close()
  }
}

// What the core says at its next start, after a restore or a bring-in: a journal line in the
// world that came back.
const AFTER = 'after-restart.json'
export function markRestart(paths: TenantPaths, words: string): void {
  writeFileSync(join(paths.dir, AFTER), JSON.stringify({ words }))
}
export function takeRestartNote(dir: string): string | null {
  const f = join(dir, AFTER)
  if (!existsSync(f)) return null
  const words = (JSON.parse(readFileSync(f, 'utf8')) as { words: string }).words
  rmSync(f, { force: true })
  return words
}

// The person's data as one archive in the open format: the world by the backup API (its trash
// left out), the files by hash, the module folders, the instructions, the connectors they added,
// and alpha.yaml.
export async function takeData(world: World, home: string, dest = exportsDir()): Promise<string> {
  const p = world.paths
  const stage = mkdtempSync(join(tmpdir(), 'alpha-data-'))
  try {
    const root = join(stage, 'alpha-data')
    mkdirSync(root, { recursive: true })
    await backup(world.db, join(root, 'world.sqlite'))
    // the trash stays behind (docs/data.md): the archive holds what is there
    const copy = new DatabaseSync(join(root, 'world.sqlite'))
    try {
      copy.exec('DELETE FROM removed_rows; VACUUM')
    } finally {
      copy.close()
    }
    for (const [from, to] of [
      [p.files, 'files'],
      [p.modules, 'modules'],
      [p.instructions, 'instructions'],
    ] as const)
      if (existsSync(from)) cpSync(from, join(root, to), { recursive: true, dereference: true })
    const connectors = join(home, 'connectors')
    if (existsSync(connectors))
      for (const n of readdirSync(connectors))
        if (n !== 'available' && statSync(join(connectors, n)).isDirectory())
          cpSync(join(connectors, n), join(root, 'connectors', n), {
            recursive: true,
            dereference: false,
            verbatimSymlinks: true,
          })
    if (existsSync(join(home, 'alpha.yaml')))
      cpSync(join(home, 'alpha.yaml'), join(root, 'alpha.yaml'))
    // the journal with its chain, which `pnpm journal verify` checks anywhere (step 2, part 3)
    writeFileSync(join(root, 'journal.jsonl'), exportLines(world.db))
    writeFileSync(
      join(root, 'README.md'),
      '# Alpha data\n\nworld.sqlite is the world (SQLite); files/ its files by hash; modules/ the module folders; instructions/ the standing instructions; connectors/ the connectors added; journal.jsonl the journal with its hash chain, checked with `pnpm journal verify journal.jsonl`. See docs/data.md in Alpha.\n',
    )
    mkdirSync(dest, { recursive: true })
    const out = join(dest, `alpha-data-${dayOf()}.tar.gz`)
    execFileSync('tar', ['-czf', out, '-C', stage, 'alpha-data'])
    return out
  } finally {
    rmSync(stage, { recursive: true, force: true })
  }
}

// An archive opened and checked, staged for bringing in: refused on a world that already holds
// rows (Go back is for that), or on a file that is not one.
export function prepareBring(world: World, archive: string): { stage: string; root: string } {
  if (!existsSync(archive)) throw new Refused('That file is not there.')
  const rows = one<{ n: number }>(world.db, 'SELECT count(*) AS n FROM records')?.n ?? 0
  if (rows > 0)
    throw new Refused(
      'This world already holds rows: Bring data in is for a fresh install. To return to a backup, use Go back.',
    )
  const stage = mkdtempSync(join(tmpdir(), 'alpha-bring-'))
  try {
    execFileSync('tar', ['-xzf', archive, '-C', stage], { stdio: 'pipe' })
  } catch {
    rmSync(stage, { recursive: true, force: true })
    throw new Refused('That file is not an Alpha data archive.')
  }
  const root = join(stage, 'alpha-data')
  if (!existsSync(join(root, 'world.sqlite'))) {
    rmSync(stage, { recursive: true, force: true })
    throw new Refused('That archive holds no world.')
  }
  return { stage, root }
}

// The staged archive put in place, with the world closed.
export async function applyBring(
  paths: TenantPaths,
  home: string,
  staged: { stage: string; root: string },
): Promise<void> {
  try {
    await restoreWorld(paths, join(staged.root, 'world.sqlite'))
    for (const [from, to] of [
      ['files', paths.files],
      ['modules', paths.modules],
      ['instructions', paths.instructions],
    ] as const) {
      const src = join(staged.root, from)
      if (!existsSync(src)) continue
      rmSync(to, { recursive: true, force: true })
      cpSync(src, to, { recursive: true })
    }
    const conns = join(staged.root, 'connectors')
    if (existsSync(conns))
      for (const n of readdirSync(conns)) {
        const to = join(home, 'connectors', n)
        rmSync(to, { recursive: true, force: true })
        mkdirSync(join(home, 'connectors'), { recursive: true })
        cpSync(join(conns, n), to, { recursive: true, verbatimSymlinks: true })
      }
  } finally {
    rmSync(staged.stage, { recursive: true, force: true })
  }
}

// The newest backup copied to the person's folder (iCloud Drive, a disk), once a day, the last
// seven copies kept there.
export function copyNewestBackup(
  backupsDir: string,
  folder: string,
  beside: Beside | null = null,
): string | null {
  // the newest by the day in its name, which is what a daily backup is named for
  const newest = listBackups(backupsDir)
    .filter((b) => b.kind === 'daily')
    .sort((a, b) => b.name.localeCompare(a.name))[0]
  if (!newest) return null
  mkdirSync(folder, { recursive: true })
  const out = join(folder, `alpha-${newest.name}`)
  if (existsSync(out) && statSync(out).size === newest.size) return null
  cpSync(join(backupsDir, newest.name), out)
  // the modules and the files go with it, so the folder is the whole business
  if (beside) mirror(beside, folder)
  const copies = readdirSync(folder)
    .filter((n) => /^alpha-world-daily-\d{4}-\d{2}-\d{2}\.sqlite$/.test(n))
    .sort()
    .reverse()
  for (const n of copies.slice(7)) rmSync(join(folder, n), { force: true })
  return out
}

// The person's data removed for good, on their word: the secrets first, then everything theirs
// discarded (the worlds, the files, the kits, the connectors they added, their browser sign-ins,
// the install file and the token); the readers' downloads stay, since they are Alpha's. The world
// is closed before this runs; the core starts again as on a first open.
export async function removeData(
  home: string,
  secretRefs: string[],
  secrets: SecretStore,
  platform: Platform,
): Promise<string[]> {
  for (const ref of [...secretRefs, KEY_REF]) await secrets.delete(ref).catch(() => undefined)
  const gone: string[] = []
  for (const n of ['tenants', 'kits', 'connectors', 'browser-profiles', 'alpha.yaml', 'token']) {
    const p = join(home, n)
    if (!existsSync(p)) continue
    platform.discard(p)
    gone.push(basename(p))
  }
  return gone
}
