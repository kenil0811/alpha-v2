// The release (packaging, piece 2): Alpha as one self-contained app, staged from a clean copy of
// the repository, carrying its own Node and uv (each checked against its published SHA-256), its
// production packages (Claude Code comes inside the Agent SDK's package), the built window and
// the helper built for macOS 14 and signed; then a MANIFEST of every file's hash, and a smoke test
// that starts the core from the staged app with an empty home and only macOS's own PATH, installs
// a made-up kit and runs its agent in the sandbox. It refuses to finish if any of that fails.
//   pnpm release [version] [--working-tree] [--client <client repository>]
// --working-tree stages the files as they are now, committed or not (for trying a release before
// a commit); without it, HEAD. --client packs the kits the client's bundle.yaml lists, which
// install.sh hands to Alpha at first start. Out: .data/release/<version>/Alpha/ (Alpha.app,
// install.sh, INSTALL.md, kits/) and .data/release/Alpha-<version>[-<client>].tar.gz to send.
import { execFileSync, spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  chmodSync,
  copyFileSync,
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, relative } from 'node:path'
import { pack as packConnector } from '../core/src/connectors/discover.ts'
import { pack } from '../core/src/modules/packs.ts'

const ROOT = join(import.meta.dirname, '..')
const NODE = readFileSync(join(ROOT, '.nvmrc'), 'utf8').trim() // 26.12.0
const UV = '0.12.17'
const CACHE = join(ROOT, '.data', 'release-cache')
const args = process.argv.slice(2)
const workingTree = args.includes('--working-tree')
const clientAt = args.indexOf('--client')
const client = clientAt >= 0 ? args[clientAt + 1] : undefined
const sha = (cmd: string[]) => execFileSync('git', cmd, { cwd: ROOT }).toString().trim()
const version =
  args.find((a, i) => !a.startsWith('--') && (clientAt < 0 || i !== clientAt + 1)) ??
  `0.1.0-${sha(['rev-parse', '--short', 'HEAD'])}`

const say = (words: string) => console.log(`· ${words}`)
function clientReportTo(): string {
  if (!client) return '""'
  const bundle = readFileSync(join(process.env.INIT_CWD ?? ROOT, client, 'bundle.yaml'), 'utf8')
  const rt = /^report_to:\s*(\S+)/m.exec(bundle)?.[1] ?? ''
  return rt ? JSON.stringify(rt) : '""'
}
const run = (cmd: string, a: string[], cwd: string, env?: NodeJS.ProcessEnv) =>
  execFileSync(cmd, a, { cwd, stdio: 'inherit', ...(env ? { env } : {}) })
const hash = (file: string) => createHash('sha256').update(readFileSync(file)).digest('hex')

async function fetchChecked(url: string, sum: string, name: string): Promise<string> {
  mkdirSync(CACHE, { recursive: true })
  const file = join(CACHE, name)
  if (!existsSync(file) || hash(file) !== sum) {
    say(`Fetching ${url}`)
    const res = await fetch(url)
    if (!res.ok) throw new Error(`${url} answered ${res.status}`)
    writeFileSync(file, Buffer.from(await res.arrayBuffer()))
  }
  if (hash(file) !== sum) throw new Error(`${name} is not what was published: its SHA-256 differs.`)
  return file
}

async function publishedSum(url: string, name: string): Promise<string> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${url} answered ${res.status}`)
  const text = await res.text()
  const line = text.split('\n').find((l) => l.trim().endsWith(name)) ?? text.trim()
  const sum = line.trim().split(/\s+/)[0] ?? ''
  if (!/^[0-9a-f]{64}$/.test(sum)) throw new Error(`No SHA-256 for ${name} at ${url}.`)
  return sum
}

// 1. A clean copy of the repository: HEAD, or the working tree as it is now.
const release = join(ROOT, '.data', 'release', version)
const out = join(release, 'Alpha')
rmSync(release, { recursive: true, force: true })
const appDir = join(out, 'Alpha.app')
const app = join(appDir, 'Contents', 'Resources', 'app')
const build = mkdtempSync(join(tmpdir(), 'alpha-release-'))
say(`Staging ${workingTree ? 'the working tree' : 'HEAD'} as Alpha ${version}`)
const files = workingTree
  ? sha(['ls-files', '--cached', '--others', '--exclude-standard']).split('\n')
  : sha(['ls-tree', '-r', '--name-only', 'HEAD']).split('\n')
for (const f of files.filter(Boolean)) {
  const from = join(ROOT, f)
  if (!existsSync(from)) continue // removed in the working tree
  mkdirSync(dirname(join(build, f)), { recursive: true })
  if (workingTree) copyFileSync(from, join(build, f))
}
if (!workingTree) run('sh', ['-c', `git archive HEAD | tar -x -C "${build}"`], ROOT)

// 2. The window, built with the development packages in the build copy; then the Mac app around
// it (mac/: its window, the menu bar mark, notifications and the companion), which the payload
// goes inside. macOS's own xattr first: another on the PATH breaks the bundler.
say('Building the window')
run('pnpm', ['install', '--frozen-lockfile', '--prefer-offline'], build)
run('pnpm', ['--filter', '@alpha/window', 'build'], build)
say('Building the Mac app')
const appVersion = version.replace(/-.*$/, '')
run(
  'cargo',
  ['tauri', 'build', '--config', JSON.stringify({ version: appVersion })],
  join(build, 'mac'),
  {
    ...process.env,
    PATH: `/usr/bin:${process.env.PATH ?? ''}`,
    CARGO_TARGET_DIR: join(CACHE, 'mac-target'),
  },
)
mkdirSync(out, { recursive: true })
cpSync(join(CACHE, 'mac-target', 'release', 'bundle', 'macos', 'Alpha.app'), appDir, {
  recursive: true,
  verbatimSymlinks: true,
})

// 3. The payload: the code, the built window, and the production packages only.
say('Staging the payload')
mkdirSync(app, { recursive: true })
for (const f of ['package.json', 'pnpm-workspace.yaml', 'pnpm-lock.yaml', '.nvmrc'])
  copyFileSync(join(build, f), join(app, f))
for (const d of ['core', 'connector-sdk', 'connectors'])
  cpSync(join(build, d), join(app, d), {
    recursive: true,
    filter: (src) => !/\/(node_modules|build)(\/|$)/.test(src) && !src.endsWith('.test.ts'),
  })
// what install.sh puts in the install's alpha.yaml: the address a report is for, the client's
// bundle's say, or none in the generic release
writeFileSync(join(app, 'release.yaml'), `report_to: ${clientReportTo()}\n`)
mkdirSync(join(app, 'window'), { recursive: true })
copyFileSync(join(build, 'window', 'package.json'), join(app, 'window', 'package.json'))
cpSync(join(build, 'window', 'dist'), join(app, 'window', 'dist'), { recursive: true })
run('pnpm', ['install', '--prod', '--frozen-lockfile', '--prefer-offline', '--ignore-scripts'], app)
rmSync(build, { recursive: true, force: true })

// 4. Its own Node and uv, each checked against its published SHA-256.
const nodeName = `node-v${NODE}-darwin-arm64.tar.gz`
const nodeTar = await fetchChecked(
  `https://nodejs.org/dist/v${NODE}/${nodeName}`,
  await publishedSum(`https://nodejs.org/dist/v${NODE}/SHASUMS256.txt`, nodeName),
  nodeName,
)
const uvName = 'uv-aarch64-apple-darwin.tar.gz'
const uvBase = `https://github.com/astral-sh/uv/releases/download/${UV}`
const uvTar = await fetchChecked(
  `${uvBase}/${uvName}`,
  await publishedSum(`${uvBase}/${uvName}.sha256`, uvName),
  `uv-${UV}-${uvName}`,
)
mkdirSync(join(app, 'runtime'), { recursive: true })
const unpack = mkdtempSync(join(tmpdir(), 'alpha-runtime-'))
run('tar', ['-xzf', nodeTar, '-C', unpack], ROOT)
copyFileSync(
  join(unpack, `node-v${NODE}-darwin-arm64`, 'bin', 'node'),
  join(app, 'runtime', 'node'),
)
run('tar', ['-xzf', uvTar, '-C', unpack], ROOT)
copyFileSync(join(unpack, 'uv-aarch64-apple-darwin', 'uv'), join(app, 'runtime', 'uv'))
chmodSync(join(app, 'runtime', 'node'), 0o755)
chmodSync(join(app, 'runtime', 'uv'), 0o755)
rmSync(unpack, { recursive: true, force: true })

// 5. The helper, built for macOS 14 and signed with the constant certificate when this Mac has it.
say('Building the helper')
run('sh', [join(app, 'connector-sdk', 'helper', 'build.sh'), join(app, 'helper')], ROOT)

// 6. The alpha command and the app's own program, then the app's own words: its version, and the
// hash of every file in it.
mkdirSync(join(app, 'bin'), { recursive: true })
copyFileSync(join(ROOT, 'release', 'alpha'), join(app, 'bin', 'alpha'))
chmodSync(join(app, 'bin', 'alpha'), 0o755)
writeFileSync(join(app, 'VERSION'), `${version}\n`)
const manifest: string[] = []
const walk = (dir: string) => {
  for (const e of readdirSync(dir).sort()) {
    const p = join(dir, e)
    const st = lstatSync(p)
    if (st.isSymbolicLink()) manifest.push(`link ${relative(app, p)}`)
    else if (st.isDirectory()) walk(p)
    else manifest.push(`${hash(p)}  ${relative(app, p)}`)
  }
}
walk(app)
writeFileSync(join(app, 'MANIFEST'), `${manifest.join('\n')}\n`)
// the app's seal, again over everything now inside it: with the constant certificate when this
// Mac has it, else ad hoc (the helper inside keeps its own signature)
const identity = execFileSync('security', ['find-identity', '-v', '-p', 'codesigning'])
  .toString()
  .includes('"Alpha Code Signing"')
  ? 'Alpha Code Signing'
  : '-'
run('codesign', ['--force', '--sign', identity, appDir], ROOT)
run('codesign', ['--verify', appDir], ROOT)

// 7. The smoke test: the core from the staged app, with an empty home and macOS's own PATH only,
// answering, serving the window, installing a made-up kit and running its agent in the sandbox.
say('Smoke test: the staged app with an empty home and only the system PATH')
const smoke = mkdtempSync(join(tmpdir(), 'alpha-smoke-'))
const port = 4796
const env = {
  HOME: smoke,
  USER: process.env.USER ?? 'alpha',
  PATH: '/usr/bin:/bin:/usr/sbin:/sbin',
  TMPDIR: process.env.TMPDIR ?? '/tmp',
  ALPHA_HOME: join(smoke, 'Alpha'),
}
// the smoke test's install file, as install.sh would write it
mkdirSync(join(smoke, 'Alpha'), { recursive: true })
writeFileSync(
  join(smoke, 'Alpha', 'alpha.yaml'),
  [
    'owner: Smoke',
    `port: ${port}`,
    `helper: ${JSON.stringify(join(app, 'helper', 'Alpha Helper.app'))}`,
    `uv: ${JSON.stringify(join(app, 'runtime', 'uv'))}`,
    `logs: ${JSON.stringify(join(smoke, 'Logs'))}`,
    '',
  ].join('\n'),
)
const core = spawn(join(app, 'runtime', 'node'), [join(app, 'core', 'src', 'main.ts')], {
  cwd: smoke,
  env,
  stdio: ['ignore', 'pipe', 'pipe'],
})
let printed = ''
core.stdout.on('data', (b) => {
  printed += b
})
core.stderr.on('data', (b) => {
  printed += b
})
const fail = (why: string): never => {
  core.kill()
  console.error(`The smoke test failed: ${why}\n--- the core said:\n${printed.slice(-4000)}`)
  process.exit(1)
}
const base = `http://127.0.0.1:${port}`
let up = false
for (let i = 0; i < 60 && !up; i++) {
  await new Promise((r) => setTimeout(r, 1000))
  up = await fetch(`${base}/api/health`).then(
    (r) => r.ok,
    () => false,
  )
}
if (!up) fail('the core did not answer within a minute')
const token = readFileSync(join(smoke, 'Alpha', 'token'), 'utf8').trim()
const call = async (path: string, body?: unknown) => {
  const r = await fetch(`${base}${path}`, {
    method: body ? 'POST' : 'GET',
    headers: { 'x-alpha-token': token, 'content-type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  return { ok: r.ok, data: (await r.json().catch(() => ({}))) as Record<string, unknown> }
}
const page = await fetch(`${base}/?t=${token}`).then((r) => r.text())
if (!page.includes('<div id="root">')) fail('the window was not served')
const kit = await call('/api/kits', { folder: join(app, 'core', 'src', 'modules', 'test-kit') })
if (!kit.ok) fail(`a made-up kit did not install: ${JSON.stringify(kit.data)}`)
const view = await call(`/api/modules/${String(kit.data.module)}`)
const agent = (view.data.agents as { id: string; name: string }[] | undefined)?.find(
  (a) => a.name === 'Counter',
)
if (!agent) fail('the made-up kit has no Counter agent')
await call(`/api/agents/${agent?.id}/run`, {})
let ran = ''
for (let i = 0; i < 30 && !ran; i++) {
  await new Promise((r) => setTimeout(r, 1000))
  const runs = (await call('/api/activity')).data as unknown as { name: string; state: string }[]
  ran = runs.find((r) => r.name === 'Counter' && r.state !== 'running')?.state ?? ''
}
if (ran !== 'ok') fail(`the made-up kit's agent did not run in the sandbox (${ran || 'no run'})`)
if (!existsSync(join(smoke, 'Logs', 'core.log'))) fail('no log was written')
// the alpha command's own helpers: a backup and a report, from the staged app
execFileSync(
  join(app, 'runtime', 'node'),
  [join(app, 'core', 'src', 'cli.ts'), 'backup', join(smoke, 'b')],
  { env },
)
execFileSync(
  join(app, 'runtime', 'node'),
  [join(app, 'core', 'src', 'cli.ts'), 'report', join(smoke, 'report.txt')],
  { env },
)
if (!readFileSync(join(smoke, 'report.txt'), 'utf8').includes('module Bakery'))
  fail('the report did not say what is installed')
core.kill('SIGTERM')
await new Promise((r) => setTimeout(r, 1500))
rmSync(smoke, { recursive: true, force: true })
// 8. The disk image a person opens: the app (install.sh and the client's kits inside it, so the
// app installs itself on first open), a link to Applications to drag it onto, and the steps.
copyFileSync(join(ROOT, 'release', 'install.sh'), join(app, 'install.sh'))
chmodSync(join(app, 'install.sh'), 0o755)
copyFileSync(join(ROOT, 'release', 'INSTALL.md'), join(out, 'Read me.md'))
let clientName = ''
if (client) {
  const repo = join(process.env.INIT_CWD ?? ROOT, client)
  const bundle = readFileSync(join(repo, 'bundle.yaml'), 'utf8')
  clientName = /^name:\s*(\S+)/m.exec(bundle)?.[1] ?? ''
  const kits = [...bundle.matchAll(/^\s*-\s*(\S+)\s*$/gm)].map((m) => m[1] as string)
  if (!clientName || !kits.length) throw new Error(`${client}/bundle.yaml names no client or kits.`)
  const kitsDir = join(appDir, 'Contents', 'Resources', 'kits')
  for (const k of kits) say(`Packed ${relative(appDir, pack(join(repo, k), kitsDir))}`)
}
// the connectors that come with Alpha but are not loaded until the person adds one (LinkedIn):
// connectors-extra/*, each packed beside the kits; install.sh puts them in Alpha's
// connectors/available, where Settings › Connections offers them
const extra = join(ROOT, 'connectors-extra')
if (existsSync(extra))
  for (const name of readdirSync(extra).sort()) {
    const dir = join(extra, name)
    if (!existsSync(join(dir, 'package.json'))) continue
    const file = await packConnector(dir, join(appDir, 'Contents', 'Resources', 'connectors'))
    say(`Packed ${relative(appDir, file)}`)
  }
// the app's seal again, over install.sh, the kits and the connector packs now inside it
run('codesign', ['--force', '--sign', identity, appDir], ROOT)
symlinkSync('/Applications', join(out, 'Applications'))
const file = join(
  ROOT,
  '.data',
  'release',
  `Alpha-${version}${clientName ? `-${clientName}` : ''}.dmg`,
)
rmSync(file, { force: true })
run(
  'hdiutil',
  ['create', '-volname', 'Alpha', '-srcfolder', out, '-ov', '-format', 'UDZO', '-quiet', file],
  ROOT,
)
const size = execFileSync('du', ['-sh', file]).toString().split('\t')[0]
say(`Alpha ${version} passed its smoke test and is ready to send: ${file} (${size})`)
