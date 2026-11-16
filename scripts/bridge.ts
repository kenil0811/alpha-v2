// The Bridge for people's computers, from this Mac. Run with `pnpm bridge pack`: one zip for each
// computer it runs on (a Mac with an Apple chip, Windows on x64), with Node inside so nothing else
// is installed, signed with Kenil's key (the zip's .sig beside it). Alpha hands out only a zip
// whose signature holds (core/src/api/routes/computers.ts). `pnpm server bridge` puts them on a
// server. Node comes from nodejs.org, checked against its published sums.
import { execFileSync } from 'node:child_process'
import { createHash, createPrivateKey, sign } from 'node:crypto'
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
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

// The Bridge, the connector child and the folder connector, each one file with what it needs; the
// SDK without its browser (bridge/pack/sdk.ts).
async function bundle(into: string): Promise<void> {
  const build = await rolldown({
    input: {
      bridge: join(ROOT, 'bridge', 'src', 'main.ts'),
      child: join(ROOT, 'core', 'src', 'connectors', 'child.ts'),
      folder: join(ROOT, 'connectors', 'files', 'src', 'folder.ts'),
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

const README = `Alpha Bridge ${VERSION}

Lends your Alpha a folder on this computer. Run it from this folder:

  alpha-bridge pair <link>      the link from Alpha: Intelligence, Connections, Your computers
  alpha-bridge lend <folder>    lend a folder; what you put in it is read in Alpha
  alpha-bridge run              leave it running; Alpha reads the folder only while it runs

alpha-bridge list says what it lends; alpha-bridge unlend <folder> stops lending one.
Its key stays in this computer's Keychain (Mac) or Credential Manager (Windows).
`

async function pack(): Promise<void> {
  if (process.platform !== 'darwin') throw new Error('The Bridge is packed on a Mac.')
  const work = join(OUT, 'work')
  rmSync(work, { recursive: true, force: true })
  const app = join(work, 'app')
  await bundle(join(app, 'src'))
  copyFileSync(join(ROOT, 'connectors', 'files', 'GUIDE.md'), join(app, 'GUIDE.md'))
  const key = signingKey()
  for (const p of PLATFORMS) {
    const dir = join(work, p.platform, 'alpha-bridge')
    mkdirSync(join(dir, 'node'), { recursive: true })
    run('cp', ['-R', app, join(dir, 'app')])
    const node = await nodeFor(p.node)
    const unpacked = join(work, `${p.platform}-node`)
    mkdirSync(unpacked, { recursive: true })
    if (p.platform.startsWith('win')) {
      const top = p.node.replace(/\.zip$/, '')
      run('unzip', ['-q', node, `${top}/node.exe`, `${top}/LICENSE`, '-d', unpacked])
      copyFileSync(join(unpacked, top, 'node.exe'), join(dir, 'node', 'node.exe'))
      copyFileSync(join(unpacked, top, 'LICENSE'), join(dir, 'node', 'LICENSE'))
      writeFileSync(
        join(dir, 'alpha-bridge.cmd'),
        '@echo off\r\n"%~dp0node\\node.exe" "%~dp0app\\src\\bridge.mjs" %*\r\n',
      )
      writeFileSync(join(dir, 'README.txt'), README.replace(/\n/g, '\r\n'))
    } else {
      const top = p.node.replace(/\.tar\.gz$/, '')
      run('tar', ['-xzf', node, '-C', unpacked, `${top}/bin/node`, `${top}/LICENSE`])
      mkdirSync(join(dir, 'node', 'bin'), { recursive: true })
      copyFileSync(join(unpacked, top, 'bin', 'node'), join(dir, 'node', 'bin', 'node'))
      chmodSync(join(dir, 'node', 'bin', 'node'), 0o755)
      copyFileSync(join(unpacked, top, 'LICENSE'), join(dir, 'node', 'LICENSE'))
      writeFileSync(
        join(dir, 'alpha-bridge'),
        '#!/bin/sh\nhere=$(cd "$(dirname "$0")" && pwd)\nexec "$here/node/bin/node" "$here/app/src/bridge.mjs" "$@"\n',
      )
      chmodSync(join(dir, 'alpha-bridge'), 0o755)
      writeFileSync(join(dir, 'README.txt'), README)
    }
    const zip = join(OUT, `alpha-bridge-${VERSION}-${p.platform}.zip`)
    rmSync(zip, { force: true })
    run('zip', ['-qrX', zip, 'alpha-bridge'], join(work, p.platform))
    const signature = sign(null, readFileSync(zip), createPrivateKey(key)).toString('base64')
    writeFileSync(`${zip}.sig`, signature)
    console.log(`Made ${zip.replace(`${ROOT}/`, '')}, signed.`)
  }
  rmSync(work, { recursive: true, force: true })
}

const [what] = process.argv.slice(2)
if (what === 'pack') await pack()
else {
  console.error('Say: pnpm bridge pack. The top of scripts/bridge.ts says what it does.')
  process.exit(1)
}
