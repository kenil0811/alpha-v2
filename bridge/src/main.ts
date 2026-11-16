// The alpha-bridge command, on a person's computer:
//   alpha-bridge pair <link>      pair this computer with the Alpha whose link it is (Your computers)
//   alpha-bridge lend <folder>    lend Alpha a folder here: what is put in it is read in Alpha
//   alpha-bridge unlend <folder>  stop lending it
//   alpha-bridge list             what this computer is paired with and what it lends
//   alpha-bridge run              connect and stay connected; Alpha reads only while this runs
// The key stays in this computer's Keychain or Credential Manager; the rest is in its own folder.
import { execFileSync } from 'node:child_process'
import { existsSync, realpathSync, statSync, unwatchFile, watchFile } from 'node:fs'
import { homedir, hostname, tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { Bridge, keyAccount, pair, VERSION } from './bridge.ts'
import type { Start } from './children.ts'
import { type Config, fileOf, homeOf, readConfig, writeConfig } from './config.ts'
import { storeOf } from './keys.ts'

// Where the code it runs is: beside it in the zip, bundled; or in the repository.
const here = import.meta.dirname
const packed = existsSync(join(here, 'child.mjs'))
const root = join(here, '..', '..')
const CHILD = packed ? join(here, 'child.mjs') : join(root, 'core', 'src', 'connectors', 'child.ts')
const ENTRIES: Record<string, string> = {
  folder: packed ? join(here, 'folder.mjs') : join(root, 'connectors', 'files', 'src', 'folder.ts'),
}

const say = (words: string) => console.log(words)
const stamp = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

// A connector's process: in Anthropic's sandbox on a Mac, reading only its code and the folders
// lent, reaching nothing; on Windows as it is, the signature on this Bridge being the wall.
const quote = (v: string) => `'${v.replace(/'/g, `'\\''`)}'`
let sandboxReady: Promise<typeof import('@anthropic-ai/sandbox-runtime').SandboxManager> | null =
  null
const start: Start = async (connector, reads) => {
  const entry = ENTRIES[connector]
  if (!entry) throw new Error(`This Bridge does not carry ${connector}.`)
  if (process.platform !== 'darwin')
    return { command: process.execPath, args: [CHILD, entry], shell: false }
  sandboxReady ??= import('@anthropic-ai/sandbox-runtime').then(async ({ SandboxManager }) => {
    await SandboxManager.initialize({
      network: { allowedDomains: [], deniedDomains: [], strictAllowlist: false },
      filesystem: { denyRead: [homedir()], allowRead: [root], allowWrite: [], denyWrite: [] },
    })
    return SandboxManager
  })
  const SandboxManager = await sandboxReady
  const command = [process.execPath, CHILD, entry].map(quote).join(' ')
  const wrapped = await SandboxManager.wrapWithSandbox(command, undefined, {
    filesystem: {
      denyRead: [homedir()],
      allowRead: [root, ...reads],
      allowWrite: [realpathSync(tmpdir())],
      denyWrite: [],
    },
  })
  return { command: wrapped, args: [], shell: true }
}

function computerName(): string {
  if (process.platform !== 'darwin') return hostname()
  try {
    return execFileSync('scutil', ['--get', 'ComputerName'], { encoding: 'utf8' }).trim()
  } catch {
    return hostname()
  }
}

function paired(home: string): Config {
  const c = readConfig(home)
  if (!c)
    throw new Error('This computer is not paired yet: alpha-bridge pair <the link from Alpha>.')
  return c
}

// A folder by its whole path, as it really is on this computer.
function folderOf(given: string | undefined): string {
  if (!given) throw new Error('Say which folder: alpha-bridge lend <folder>.')
  const path = resolve(given)
  if (!existsSync(path) || !statSync(path).isDirectory())
    throw new Error(`There is no folder at ${path}.`)
  return realpathSync(path)
}

async function main(args: string[]): Promise<void> {
  const home = homeOf()
  const [what, arg] = args
  if (what === 'pair') {
    if (!arg) throw new Error('Give the link: alpha-bridge pair <the link from Alpha>.')
    const keys = storeOf()
    const before = readConfig(home)
    const c = await pair(arg, keys, computerName())
    if (before && keyAccount(before.alpha) !== keyAccount(c.alpha))
      keys.forget(keyAccount(before.alpha))
    writeConfig(home, { ...c, lends: before?.alpha === c.alpha ? before.lends : [] })
    say(`Paired with ${new URL(c.alpha).host} as ${c.name}.`)
    say('Next: alpha-bridge lend <a folder>, then alpha-bridge run.')
    return
  }
  if (what === 'lend' || what === 'unlend') {
    const c = paired(home)
    const account = folderOf(arg)
    const others = c.lends.filter((l) => !(l.connector === 'folder' && l.account === account))
    writeConfig(home, {
      ...c,
      lends: what === 'lend' ? [...others, { connector: 'folder', account }] : others,
    })
    say(
      what === 'lend'
        ? `Lent ${account}. Alpha reads it while alpha-bridge run is going.`
        : `Stopped lending ${account}.`,
    )
    return
  }
  if (what === 'list') {
    const c = paired(home)
    say(`Paired with ${new URL(c.alpha).host} as ${c.name}.`)
    say(c.lends.length ? 'Lends:' : 'Lends nothing yet.')
    for (const l of c.lends) say(`  ${l.account}`)
    return
  }
  if (what === 'run') {
    paired(home)
    const bridge = new Bridge({
      config: () => paired(home),
      keys: storeOf(),
      start,
      said: (w) => say(`${stamp()}  ${w}`),
    })
    // a lend or an unlend made in another window reaches Alpha within seconds
    watchFile(fileOf(home), { interval: 2000 }, () => bridge.changed())
    const end = () => {
      unwatchFile(fileOf(home))
      bridge.stop()
      process.exit(0)
    }
    process.on('SIGINT', end)
    process.on('SIGTERM', end)
    say(`Alpha Bridge ${VERSION}. Leave this window open; Ctrl+C stops it.`)
    bridge.run()
    return
  }
  say(
    [
      `Alpha Bridge ${VERSION}`,
      '  alpha-bridge pair <link>      pair this computer (the link is in Alpha, Your computers)',
      '  alpha-bridge lend <folder>    lend Alpha a folder here',
      '  alpha-bridge unlend <folder>  stop lending it',
      '  alpha-bridge list             what this computer lends',
      '  alpha-bridge run              connect; Alpha reads only while this runs',
    ].join('\n'),
  )
}

main(process.argv.slice(2)).catch((err) => {
  console.error(err instanceof Error ? err.message : String(err))
  process.exit(1)
})
