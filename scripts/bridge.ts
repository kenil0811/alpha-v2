// Alpha Bridge for people's computers, from this Mac: `pnpm bridge mac` makes the Mac app (its disk
// image, and the update the app takes in), `pnpm bridge windows` has GitHub's Windows machine make
// the Windows setup program from this branch and signs it here. Each carries Node and the bundled
// Bridge (`pnpm bridge resources <platform>`), so nothing else is installed; each is signed with
// Kenil's key (its .sig), and an update with the app's updater key too (its .updater.sig). Alpha
// hands out only what Kenil's signature holds (core/src/api/routes/computers.ts); `pnpm server
// bridge` puts them on a server. Node comes from nodejs.org, checked against its published sums.
import { execFileSync } from 'node:child_process'
import { createHash, createPrivateKey, sign } from 'node:crypto'
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { join } from 'node:path'
import { rolldown } from 'rolldown'

const ROOT = join(import.meta.dirname, '..')
const OUT = join(ROOT, '.data', 'bridge')
const CACHE = join(OUT, 'node')
const NODE = readFileSync(join(ROOT, '.nvmrc'), 'utf8').trim()
const VERSION = /VERSION = '([^']+)'/.exec(
  readFileSync(join(ROOT, 'bridge', 'src', 'bridge.ts'), 'utf8'),
)?.[1]
if (!VERSION) throw new Error('bridge/src/bridge.ts names no VERSION.')

const PLATFORMS = [
  { platform: 'darwin-arm64', node: `node-v${NODE}-darwin-arm64.tar.gz` },
  { platform: 'win-x64', node: `node-v${NODE}-win-x64.zip` },
] as const

const run = (cmd: string, args: string[], cwd = ROOT) =>
  execFileSync(cmd, args, { cwd, stdio: 'inherit' })
const sha = (file: string) => createHash('sha256').update(readFileSync(file)).digest('hex')

// Node's own build for a computer, downloaded once and checked against nodejs.org's sums.
async function nodeFor(name: string): Promise<string> {
  mkdirSync(CACHE, { recursive: true })
  const file = join(CACHE, name)
  const sums = await (await fetch(`https://nodejs.org/dist/v${NODE}/SHASUMS256.txt`)).text()
  const want = sums
    .split('\n')
    .find((l) => l.endsWith(`  ${name}`))
    ?.split(' ')[0]
  if (!want) throw new Error(`nodejs.org lists no ${name}.`)
  if (!existsSync(file) || sha(file) !== want) {
    const res = await fetch(`https://nodejs.org/dist/v${NODE}/${name}`)
    if (!res.ok) throw new Error(`nodejs.org did not give ${name} (${res.status}).`)
    writeFileSync(file, Buffer.from(await res.arrayBuffer()))
  }
  if (sha(file) !== want) throw new Error(`${name} is not what nodejs.org says it is.`)
  return file
}

// The Bridge, the connector child and the connectors it carries (a folder, the Mac's Calendar and
// Contacts, the computer's readers), each one file with what it needs; the SDK without its browser
// (bridge/pack/sdk.ts).
async function bundle(into: string): Promise<void> {
  const build = await rolldown({
    input: {
      bridge: join(ROOT, 'bridge', 'src', 'main.ts'),
      child: join(ROOT, 'core', 'src', 'connectors', 'child.ts'),
      folder: join(ROOT, 'connectors', 'files', 'src', 'folder.ts'),
      mac: join(ROOT, 'connectors', 'mac', 'src', 'index.ts'),
      computer: join(ROOT, 'connectors', 'computer', 'src', 'index.ts'),
    },
    platform: 'node',
    resolve: { alias: { '@alpha/connector-sdk': join(ROOT, 'bridge', 'pack', 'sdk.ts') } },
    cwd: join(ROOT, 'bridge'),
  })
  await build.write({
    dir: into,
    format: 'esm',
    entryFileNames: '[name].mjs',
    chunkFileNames: '[name]-[hash].mjs',
  })
  await build.close()
}

function signingKey(): string {
  const b64 = execFileSync(
    'security',
    ['find-generic-password', '-s', 'Alpha signing key', '-a', 'alpha', '-w'],
    { encoding: 'utf8' },
  ).trim()
  return Buffer.from(b64, 'base64').toString('utf8')
}

// The Bridge as the app carries it, in its resources: Node for that computer and the bundled
// Bridge (bridge/app/resources/bridge, which the app's build packs in).
async function resources(platform: (typeof PLATFORMS)[number]['platform']): Promise<string> {
  const p = PLATFORMS.find((x) => x.platform === platform)
  if (!p) throw new Error(`No Bridge is made for ${platform}.`)
  const dir = join(ROOT, 'bridge', 'app', 'resources', 'bridge')
  rmSync(dir, { recursive: true, force: true })
  mkdirSync(join(dir, 'node'), { recursive: true })
  await bundle(join(dir, 'app', 'src'))
  copyFileSync(join(ROOT, 'connectors', 'files', 'GUIDE.md'), join(dir, 'app', 'GUIDE.md'))
  for (const g of ['GUIDE-calendar.md', 'GUIDE-contacts.md'])
    copyFileSync(join(ROOT, 'connectors', 'mac', g), join(dir, 'app', g))
  copyFileSync(
    join(ROOT, 'connectors', 'computer', 'GUIDE-computer.md'),
    join(dir, 'app', 'GUIDE-computer.md'),
  )
  const node = await nodeFor(p.node)
  const unpacked = join(OUT, 'work', `${p.platform}-node`)
  rmSync(unpacked, { recursive: true, force: true })
  mkdirSync(unpacked, { recursive: true })
  if (platform.startsWith('win')) {
    const top = p.node.replace(/\.zip$/, '')
    // tar reads a zip too, on a Mac and on Windows
    run('tar', ['-xf', node, '-C', unpacked, `${top}/node.exe`, `${top}/LICENSE`])
    copyFileSync(join(unpacked, top, 'node.exe'), join(dir, 'node', 'node.exe'))
    copyFileSync(join(unpacked, top, 'LICENSE'), join(dir, 'node', 'LICENSE'))
  } else {
    const top = p.node.replace(/\.tar\.gz$/, '')
    run('tar', ['-xzf', node, '-C', unpacked, `${top}/bin/node`, `${top}/LICENSE`])
    mkdirSync(join(dir, 'node', 'bin'), { recursive: true })
    copyFileSync(join(unpacked, top, 'bin', 'node'), join(dir, 'node', 'bin', 'node'))
    chmodSync(join(dir, 'node', 'bin', 'node'), 0o755)
    copyFileSync(join(unpacked, top, 'LICENSE'), join(dir, 'node', 'LICENSE'))
    // Alpha's helper, for Calendar and Contacts: a plain command inside the Bridge, never an app
    // of its own, so macOS names Alpha Bridge as asking and lists one app
    run('sh', [join(ROOT, 'connector-sdk', 'helper', 'build.sh'), dir, 'tool'])
  }
  rmSync(unpacked, { recursive: true, force: true })
  return dir
}

// The private half of the app's updater key, from the Keychain, for Tauri's signer.
function updaterKey(): string {
  return execFileSync(
    'security',
    ['find-generic-password', '-s', 'Alpha Bridge updater key', '-a', 'alpha', '-w'],
    { encoding: 'utf8' },
  ).trim()
}

// A file kept in .data/bridge under its lasting name, signed with Kenil's key.
function keep(from: string, name: string, key: string): string {
  const to = join(OUT, name)
  if (from !== to) copyFileSync(from, to)
  writeFileSync(`${to}.sig`, sign(null, readFileSync(to), createPrivateKey(key)).toString('base64'))
  console.log(`Made .data/bridge/${name}, signed.`)
  return to
}

// The app on this Mac: its disk image, and the update the app takes in, with Tauri's signature.
async function mac(): Promise<void> {
  if (process.platform !== 'darwin') throw new Error('The Mac app is made on a Mac.')
  await resources('darwin-arm64')
  const app = join(ROOT, 'bridge', 'app')
  execFileSync(
    'cargo',
    ['tauri', 'build', '--bundles', 'app,dmg', '--config', JSON.stringify({ version: VERSION })],
    {
      cwd: app,
      stdio: 'inherit',
      // CI: the disk image without Finder's window dressing, which needs Finder driven by script
      env: {
        ...process.env,
        // the Mac's own xattr, before any other on the path (as `pnpm mac` does)
        PATH: `/usr/bin:${process.env.PATH ?? ''}`,
        CI: 'true',
        TAURI_SIGNING_PRIVATE_KEY: updaterKey(),
        TAURI_SIGNING_PRIVATE_KEY_PASSWORD: '',
      },
    },
  )
  const out = join(app, 'target', 'release', 'bundle')
  const key = signingKey()
  const dmg = readdirSync(join(out, 'dmg')).find((f) => f.endsWith('.dmg'))
  if (!dmg) throw new Error('The build made no disk image.')
  keep(join(out, 'dmg', dmg), `alpha-bridge-${VERSION}-darwin-arm64.dmg`, key)
  const update = keep(
    join(out, 'macos', 'Alpha Bridge.app.tar.gz'),
    `alpha-bridge-${VERSION}-darwin-arm64.app.tar.gz`,
    key,
  )
  copyFileSync(join(out, 'macos', 'Alpha Bridge.app.tar.gz.sig'), `${update}.updater.sig`)
}

// The Windows setup program, made on GitHub's Windows machine from this branch (a Mac cannot make
// it reliably), then signed here: Tauri's signature with the updater key, Kenil's beside it.
async function windows(): Promise<void> {
  // the newest build of this branch: a push of a bridge-* branch that changes the Bridge starts one
  const branch = execFileSync('git', ['branch', '--show-current'], {
    cwd: ROOT,
    encoding: 'utf8',
  }).trim()
  const id = execFileSync(
    'gh',
    [
      'run',
      'list',
      '--workflow',
      'bridge-windows.yml',
      '--branch',
      branch,
      '--limit',
      '1',
      '--json',
      'databaseId',
      '--jq',
      '.[0].databaseId',
    ],
    { cwd: ROOT, encoding: 'utf8' },
  ).trim()
  if (!id) throw new Error(`No Windows build of ${branch}: push it as a bridge-* branch first.`)
  console.log('Waiting for the Windows build on GitHub…')
  run('gh', ['run', 'watch', id, '--exit-status'])
  const got = join(OUT, 'work', 'windows')
  rmSync(got, { recursive: true, force: true })
  run('gh', ['run', 'download', id, '--name', 'alpha-bridge-setup', '--dir', got])
  const exe = readdirSync(got).find((f) => f.endsWith('-setup.exe'))
  if (!exe) throw new Error('The Windows build made no setup program.')
  const name = `alpha-bridge-${VERSION}-win-x64-setup.exe`
  const to = join(OUT, name)
  copyFileSync(join(got, exe), to)
  // Tauri's signer writes <file>.sig, where Kenil's goes: its own is moved to .updater.sig first
  execFileSync('cargo', ['tauri', 'signer', 'sign', '--password', '', to], {
    cwd: join(ROOT, 'bridge', 'app'),
    stdio: 'inherit',
    env: { ...process.env, TAURI_SIGNING_PRIVATE_KEY: updaterKey() },
  })
  renameSync(`${to}.sig`, `${to}.updater.sig`)
  keep(to, name, signingKey())
  rmSync(got, { recursive: true, force: true })
}

const [what, arg] = process.argv.slice(2)
if (what === 'mac') await mac()
else if (what === 'windows') await windows()
else if (what === 'resources' && (arg === 'darwin-arm64' || arg === 'win-x64'))
  console.log(`The Bridge for ${arg} is in ${await resources(arg)}.`)
else {
  console.error('Say: pnpm bridge mac|windows. The top of scripts/bridge.ts says what each does.')
  process.exit(1)
}
