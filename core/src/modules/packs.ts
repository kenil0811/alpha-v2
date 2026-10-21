// Kit packs (design §10): a kit's folder as one file, with each file's hash, so a kit can travel
// to a Mac with no repository on it. Packed with `pnpm kit pack <folder>`; on the Mac, a pack is
// kept unpacked in Alpha's folder (kits/<name>/<version>), so later updates have the kit's own
// files to compare with, and installed or updated as installing from a folder does: within its
// module's parent, agents paused, the ownership rule on update. Packs dropped in kits/inbox are
// installed when the core starts; Settings takes one from a file.
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join, relative } from 'node:path'
import { one } from '../world/db.ts'
import { Refused } from '../world/kinds.ts'
import type { WriteCtx } from '../world/shape.ts'
import type { World } from '../world/world.ts'
import { install, readKit, update } from './kits.ts'

export const PACK_SUFFIX = '.alphakit'

interface PackManifest {
  name: string
  version: string
  files: Record<string, string> // path in the kit: its SHA-256
}

const sha = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex')

function filesOf(root: string, dir = root, out: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name === '.git' || e.name === '.DS_Store' || e.name === 'node_modules') continue
    const p = join(dir, e.name)
    if (e.isDirectory()) filesOf(root, p, out)
    else if (e.isFile()) out.push(relative(root, p))
  }
  return out.sort()
}

// A kit's folder packed into one file: kit/ with its files, and PACK.json with their hashes.
export function pack(kitDir: string, outDir: string): string {
  const { manifest } = readKit(kitDir)
  const stage = mkdtempSync(join(tmpdir(), 'alpha-pack-'))
  try {
    const files: Record<string, string> = {}
    for (const f of filesOf(kitDir)) {
      const bytes = readFileSync(join(kitDir, f))
      files[f] = sha(bytes)
      mkdirSync(join(stage, 'kit', f, '..'), { recursive: true })
      writeFileSync(join(stage, 'kit', f), bytes)
    }
    const m: PackManifest = { name: manifest.name, version: manifest.version, files }
    writeFileSync(join(stage, 'PACK.json'), `${JSON.stringify(m, null, 2)}\n`)
    mkdirSync(outDir, { recursive: true })
    const slug = manifest.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')
    const out = join(outDir, `${slug}-${manifest.version}${PACK_SUFFIX}`)
    execFileSync('tar', ['-czf', out, '-C', stage, 'PACK.json', 'kit'])
    return out
  } finally {
    rmSync(stage, { recursive: true, force: true })
  }
}

// A pack opened and checked: every file there with the hash it was packed with, nothing more.
export function unpack(
  file: string,
  kitsDir: string,
): { name: string; version: string; dir: string } {
  const stage = mkdtempSync(join(tmpdir(), 'alpha-unpack-'))
  try {
    try {
      execFileSync('tar', ['-xzf', file, '-C', stage], { stdio: 'pipe' })
    } catch {
      throw new Refused('That file is not a kit pack.')
    }
    const mf = join(stage, 'PACK.json')
    if (!existsSync(mf)) throw new Refused('That file is not a kit pack: it has no PACK.json.')
    const m = JSON.parse(readFileSync(mf, 'utf8')) as PackManifest
    const kit = join(stage, 'kit')
    const there = existsSync(kit) ? filesOf(kit) : []
    const listed = Object.keys(m.files).sort()
    if (JSON.stringify(there) !== JSON.stringify(listed))
      throw new Refused(
        'That kit pack holds other files than it lists: it was changed after packing.',
      )
    for (const f of listed)
      if (sha(readFileSync(join(kit, f))) !== m.files[f])
        throw new Refused(`That kit pack's ${f} is not as it was packed.`)
    const slug = m.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')
    const dir = join(kitsDir, slug, m.version)
    rmSync(dir, { recursive: true, force: true })
    mkdirSync(join(dir, '..'), { recursive: true })
    renameSync(kit, dir)
    return { name: m.name, version: m.version, dir }
  } finally {
    rmSync(stage, { recursive: true, force: true })
  }
}

// A pack installed, or its module updated when it came from that kit before.
export async function installPack(
  world: World,
  file: string,
  kitsDir: string,
  ctx: WriteCtx,
): Promise<string> {
  const { name, version, dir } = unpack(file, kitsDir)
  const m = world.shape.module(name)
  const fromKit =
    m && one<{ version: string }>(world.db, 'SELECT version FROM kits WHERE module_id = ?', m.id)
  // the same kit again (every install refills the inbox): nothing to do
  if (m && fromKit && fromKit.version === version) return `${name} ${version} is already there.`
  if (m && fromKit) {
    const r = await update(world, name, dir, ctx)
    return `Updated ${name} to ${version}: ${r.replaced.length + r.added.length} files new or replaced, ${r.kept.length} of your changes kept.`
  }
  await install(world, dir, ctx)
  return `Installed ${name} ${version}, its agents paused.`
}

// The packs in kits/inbox, installed at start; each one moved to kits/inbox/done once in, or to
// kits/inbox/failed with the reason beside it.
export async function installInbox(
  world: World,
  kitsDir: string,
  ctx: WriteCtx,
): Promise<string[]> {
  const inbox = join(kitsDir, 'inbox')
  if (!existsSync(inbox)) return []
  const said: string[] = []
  for (const n of readdirSync(inbox)
    .filter((x) => x.endsWith(PACK_SUFFIX))
    .sort()) {
    const file = join(inbox, n)
    try {
      said.push(await installPack(world, file, kitsDir, ctx))
      mkdirSync(join(inbox, 'done'), { recursive: true })
      renameSync(file, join(inbox, 'done', n))
    } catch (err) {
      const why = err instanceof Error ? err.message : String(err)
      said.push(`${n} did not go in: ${why}`)
      mkdirSync(join(inbox, 'failed'), { recursive: true })
      renameSync(file, join(inbox, 'failed', n))
      writeFileSync(join(inbox, 'failed', `${n}.txt`), `${why}\n`)
    }
  }
  return said
}
