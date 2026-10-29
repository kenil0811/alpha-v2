// Connectors found in their folders (decision 10): a connector is a folder with a package.json
// whose entry exports `connector` (or `connectors`, several from one helper), written against the
// SDK. The core loads two sets at start: the standard set, the packages under the repository's
// connectors/ that the release ships; and the added set, every folder under Alpha's own
// connectors/ beside the kits, each put there from a pack or a folder in Settings. A folder that
// does not load is said and left out, never fatal. `pnpm connector check` runs the same check;
// `pnpm connector pack` makes the .alphaconnector file a folder travels as.
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join, relative } from 'node:path'
import { pathToFileURL } from 'node:url'
import { type Connector, checkConnector } from '@alpha/connector-sdk'
import { Refused } from '../world/kinds.ts'
import { ConnectorProcess, type Described, isRemote, remoteConnectors } from './process.ts'

export const PACK_SUFFIX = '.alphaconnector'
// The repository's connectors, shipped with every release.
export const STANDARD_DIR = join(import.meta.dirname, '..', '..', '..', 'connectors')

export interface Loaded {
  connectors: Connector[]
  failed: { folder: string; why: string }[] // said on Home, left out
}

// The packages a connector folder shares with the core, so one copy of each runs: linked into an
// added folder when it is unpacked, left out of its pack.
const SHARED = ['@alpha/connector-sdk', 'zod']

function entryOf(dir: string): string {
  const file = join(dir, 'package.json')
  if (!existsSync(file)) throw new Error('it has no package.json')
  const pkg = JSON.parse(readFileSync(file, 'utf8')) as {
    main?: string
    exports?: string | Record<string, string | Record<string, string>>
  }
  const dot = typeof pkg.exports === 'string' ? pkg.exports : pkg.exports?.['.']
  const entry =
    typeof dot === 'string'
      ? dot
      : dot && typeof dot === 'object'
        ? (dot.import ?? dot.default)
        : pkg.main
  if (!entry) throw new Error('its package.json names no entry (exports["."] or main)')
  return join(dir, entry)
}

// The connectors one folder exports, checked; throws in plain words when it is not one. Its code
// runs in its own process (step 2, part 1): the core holds what that process says of it.
export async function loadConnector(dir: string, taken: string[] = []): Promise<Connector[]> {
  return named(await startConnector(dir), taken)
}

type Started = { proc: ConnectorProcess; described: Described[] } | { failed: unknown }

async function startConnector(dir: string): Promise<Started> {
  const entry = entryOf(dir)
  if (!existsSync(entry))
    return { failed: new Error(`its entry ${relative(dir, entry)} is not there`) }
  const proc = new ConnectorProcess(entry)
  try {
    return { proc, described: await proc.start() }
  } catch (err) {
    proc.close()
    return { failed: err }
  }
}

// A started folder's connectors, unless one's name is taken already.
function named(s: Started, taken: string[]): Connector[] {
  if ('failed' in s) throw s.failed
  const twice = s.described.find((d) => taken.includes(d.manifest.name))
  if (twice) {
    s.proc.close()
    throw new Error(`a connector called ${twice.manifest.name} is loaded already`)
  }
  return remoteConnectors(s.proc, s.described)
}

// Every folder directly under dir that is a connector, in name order.
export async function loadSet(dir: string, taken: string[] = []): Promise<Loaded> {
  const out: Loaded = { connectors: [], failed: [] }
  if (!existsSync(dir)) return out
  const names = () => [...taken, ...out.connectors.map((c) => c.manifest.name)]
  const folders = readdirSync(dir)
    .sort()
    .map((name) => ({ name, folder: join(dir, name) }))
    .filter(
      ({ name, folder }) =>
        !name.startsWith('.') &&
        name !== 'available' &&
        lstatSync(folder).isDirectory() &&
        existsSync(join(folder, 'package.json')),
    )
  // their processes start together; a name is judged in folder order, as before
  const started = folders.map(({ folder }) => ({ folder, s: startConnector(folder) }))
  for (const { folder, s } of started) {
    try {
      out.connectors.push(...named(await s, names()))
    } catch (err) {
      out.failed.push({ folder, why: err instanceof Error ? err.message : String(err) })
    }
  }
  return out
}

// What is wrong with a folder, for `pnpm connector check`: none means it loads.
export async function checkFolder(dir: string): Promise<string[]> {
  try {
    const entry = entryOf(dir)
    if (!existsSync(entry)) return [`Its entry ${relative(dir, entry)} is not there.`]
    const mod = (await import(pathToFileURL(entry).href)) as Record<string, unknown>
    const found = Array.isArray(mod.connectors)
      ? mod.connectors
      : mod.connector !== undefined
        ? [mod.connector]
        : []
    if (!found.length) return ['Its entry exports no connector (export const connector).']
    const taken: string[] = []
    const out: string[] = []
    for (const x of found) {
      out.push(...checkConnector(x, taken))
      const name = (x as { manifest?: { name?: unknown } })?.manifest?.name
      if (typeof name === 'string') taken.push(name)
    }
    return out
  } catch (err) {
    return [err instanceof Error ? err.message : String(err)]
  }
}

interface PackManifest {
  name: string // the first connector's, the folder's name under Alpha's connectors/
  title: string
  version: string
  names: string[] // every connector in it
  files: Record<string, string> // path in the folder: its SHA-256
}

const sha = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex')

// The files a connector folder travels with: its own, and its packages as real files; not the
// shared ones, not pnpm's store (a folder installed with pnpm is asked for npm's flat layout).
function filesOf(root: string, dir = root, out: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    // nothing hidden travels (.git, .tsbuild, .DS_Store), nor a build folder
    if (e.name.startsWith('.') || e.name === 'build') continue
    // what only the repository's checks use: Node loads the folder as it is
    if (e.name.endsWith('.tsbuildinfo') || /^tsconfig(\..+)?\.json$/.test(e.name)) continue
    if (e.name.endsWith('.test.ts') || e.name.endsWith('.test.js')) continue
    const p = join(dir, e.name)
    const rel = relative(root, p)
    if (rel.startsWith('node_modules')) {
      if (rel === 'node_modules/.pnpm')
        throw new Refused(
          'Its packages are installed with pnpm, as links into a store: install them with npm first, so they are real folders that can travel.',
        )
      if (rel === 'node_modules/.bin' || SHARED.some((s) => rel === `node_modules/${s}`)) continue
      if (rel === 'node_modules/@alpha' || rel === 'node_modules/@types') continue // not at run time
    }
    const st = lstatSync(p)
    if (st.isSymbolicLink() && !rel.startsWith('node_modules'))
      throw new Refused(`${rel} is a link; a connector folder holds its files themselves.`)
    if (st.isSymbolicLink() && !existsSync(p)) continue // a link to nothing
    const target = st.isSymbolicLink() ? statSync(p) : st
    if (target.isDirectory()) filesOf(root, p, out)
    else if (target.isFile()) out.push(rel)
  }
  return out.sort()
}

// A connector's folder packed into one file: connector/ with its files, and PACK.json with their
// hashes. It loads first, so a folder that is not a connector is refused in words.
export async function pack(dir: string, outDir: string): Promise<string> {
  const problems = await checkFolder(dir)
  if (problems.length) throw new Refused(`That folder is not a connector: ${problems.join('; ')}`)
  const loaded = await loadConnector(dir)
  const first = loaded[0] as Connector
  if (isRemote(first)) first.remote.process.close()
  const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')) as { version?: string }
  const version = pkg.version ?? '0.0.0'
  const stage = mkdtempSync(join(tmpdir(), 'alpha-cpack-'))
  try {
    const files: Record<string, string> = {}
    for (const f of filesOf(dir)) {
      const bytes = readFileSync(join(dir, f))
      files[f] = sha(bytes)
      mkdirSync(dirname(join(stage, 'connector', f)), { recursive: true })
      writeFileSync(join(stage, 'connector', f), bytes)
    }
    const m: PackManifest = {
      name: first.manifest.name,
      title: first.manifest.title,
      version,
      names: loaded.map((c) => c.manifest.name),
      files,
    }
    writeFileSync(join(stage, 'PACK.json'), `${JSON.stringify(m, null, 2)}\n`)
    mkdirSync(outDir, { recursive: true })
    const out = join(outDir, `${m.name}-${version}${PACK_SUFFIX}`)
    execFileSync('tar', ['-czf', out, '-C', stage, 'PACK.json', 'connector'])
    return out
  } finally {
    rmSync(stage, { recursive: true, force: true })
  }
}

// What a pack says of itself, without opening it fully.
export function peek(file: string): { name: string; title: string; version: string } {
  const stage = mkdtempSync(join(tmpdir(), 'alpha-cpeek-'))
  try {
    try {
      execFileSync('tar', ['-xzf', file, '-C', stage, 'PACK.json'], { stdio: 'pipe' })
    } catch {
      throw new Refused('That file is not a connector pack.')
    }
    const m = JSON.parse(readFileSync(join(stage, 'PACK.json'), 'utf8')) as PackManifest
    return { name: m.name, title: m.title, version: m.version }
  } finally {
    rmSync(stage, { recursive: true, force: true })
  }
}

// A pack opened and checked into Alpha's connectors/<name>: every file there with the hash it
// was packed with, nothing more; then the shared packages linked to the core's own copies.
export function unpack(file: string, connectorsDir: string): { name: string; dir: string } {
  const stage = mkdtempSync(join(tmpdir(), 'alpha-cunpack-'))
  try {
    try {
      execFileSync('tar', ['-xzf', file, '-C', stage], { stdio: 'pipe' })
    } catch {
      throw new Refused('That file is not a connector pack.')
    }
    const mf = join(stage, 'PACK.json')
    if (!existsSync(mf))
      throw new Refused('That file is not a connector pack: it has no PACK.json.')
    const m = JSON.parse(readFileSync(mf, 'utf8')) as PackManifest
    const folder = join(stage, 'connector')
    const there = existsSync(folder) ? filesOf(folder) : []
    const listed = Object.keys(m.files).sort()
    if (JSON.stringify(there) !== JSON.stringify(listed))
      throw new Refused('That pack holds other files than it lists: it was changed after packing.')
    for (const f of listed)
      if (sha(readFileSync(join(folder, f))) !== m.files[f])
        throw new Refused(`That pack's ${f} is not as it was packed.`)
    if (!/^[a-z][a-z0-9-]{0,39}$/.test(m.name)) throw new Refused('That pack names no connector.')
    const dir = join(connectorsDir, m.name)
    rmSync(dir, { recursive: true, force: true })
    mkdirSync(connectorsDir, { recursive: true })
    renameSync(folder, dir)
    linkShared(dir)
    return { name: m.name, dir }
  } finally {
    rmSync(stage, { recursive: true, force: true })
  }
}

// A folder added from Settings travels the same way: packed, then unpacked into Alpha's
// connectors/, so what is loaded is always a copy Alpha keeps.
export async function addFolder(
  dir: string,
  connectorsDir: string,
): Promise<{ name: string; dir: string }> {
  const stage = mkdtempSync(join(tmpdir(), 'alpha-cadd-'))
  try {
    return unpack(await pack(dir, stage), connectorsDir)
  } finally {
    rmSync(stage, { recursive: true, force: true })
  }
}

// The shared packages, linked to the core's own copies, so one SDK and one zod run (a second copy
// would be another Problem class, and the gates would not know its failures).
export function linkShared(dir: string): void {
  const require = createRequire(import.meta.url)
  for (const name of SHARED) {
    const at = join(dir, 'node_modules', name)
    rmSync(at, { recursive: true, force: true })
    mkdirSync(dirname(at), { recursive: true })
    symlinkSync(packageDir(require.resolve(name), name), at)
  }
}

// The real folder of a package, from a file it resolves to: Node keeps one module per real
// path, so a link to it runs the core's own copy.
function packageDir(file: string, name: string): string {
  let dir = dirname(realpathSync(file))
  for (;;) {
    const pkg = join(dir, 'package.json')
    if (existsSync(pkg) && JSON.parse(readFileSync(pkg, 'utf8')).name === name) return dir
    const up = dirname(dir)
    if (up === dir) throw new Error(`The package ${name} was not found beside ${file}.`)
    dir = up
  }
}

// The packs that came with the release and are not loaded until the person adds one (LinkedIn):
// Alpha's connectors/available.
export function available(
  connectorsDir: string,
): { file: string; name: string; title: string; version: string }[] {
  const dir = join(connectorsDir, 'available')
  if (!existsSync(dir)) return []
  const packs = readdirSync(dir)
    .filter((n) => n.endsWith(PACK_SUFFIX))
    .sort()
    .flatMap((n) => {
      try {
        return [{ file: join(dir, n), ...peek(join(dir, n)) }]
      } catch {
        return []
      }
    })
  // a release that brings a newer one leaves the older beside it: each is offered at its newest
  return packs.filter((p) => !packs.some((q) => q.name === p.name && newer(q.version, p.version)))
}

// Whether version a (1.2.0) is after b.
function newer(a: string, b: string): boolean {
  const x = a.split('.').map(Number)
  const y = b.split('.').map(Number)
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const d = (x[i] || 0) - (y[i] || 0)
    if (d) return d > 0
  }
  return false
}

// An added connector that came with Alpha (one of its packs in available/, an @alpha package)
// updated to the newest the release brought, as Alpha's own kits are: its connections stay, as
// they are the world's. A folder of the person's own of that name is left as it is.
export function updateOwn(
  connectorsDir: string,
): { name: string; title: string; version: string }[] {
  const out: { name: string; title: string; version: string }[] = []
  for (const p of available(connectorsDir)) {
    const file = join(connectorsDir, p.name, 'package.json')
    if (!existsSync(file)) continue
    const pkg = JSON.parse(readFileSync(file, 'utf8')) as { name?: string; version?: string }
    if (!pkg.name?.startsWith('@alpha/connector-') || !newer(p.version, pkg.version ?? '0.0.0'))
      continue
    unpack(p.file, connectorsDir)
    out.push({ name: p.name, title: p.title, version: p.version })
  }
  return out
}

// A folder of Alpha's connectors/ removed for good, when nothing is connected through it.
export function removeFolder(connectorsDir: string, name: string): void {
  const dir = join(connectorsDir, name)
  if (!existsSync(dir)) throw new Refused(`There is no added connector called ${name}.`)
  rmSync(dir, { recursive: true, force: true })
}
