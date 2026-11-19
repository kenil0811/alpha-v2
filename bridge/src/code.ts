// What the Bridge runs on its computer, wherever it is unpacked: the connector child and each
// connector's code, beside it bundled (the zip, the app) or in the repository; and how a
// connector's process starts here.
import { execFileSync } from 'node:child_process'
import { existsSync, realpathSync, statSync } from 'node:fs'
import { homedir, hostname, tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { type HelperOptions, runHelper } from '@alpha/connector-sdk'
import type { Start } from './children.ts'

// Where the code it runs is: beside it in the zip, bundled; or in the repository.
const here = import.meta.dirname
const packed = existsSync(join(here, 'child.mjs'))
const root = join(here, '..', '..')
const CHILD = packed ? join(here, 'child.mjs') : join(root, 'core', 'src', 'connectors', 'child.ts')
const MAC = packed ? join(here, 'mac.mjs') : join(root, 'connectors', 'mac', 'src', 'index.ts')
const COMPUTER = packed
  ? join(here, 'computer.mjs')
  : join(root, 'connectors', 'computer', 'src', 'index.ts')
const ENTRIES: Record<string, string> = {
  folder: packed ? join(here, 'folder.mjs') : join(root, 'connectors', 'files', 'src', 'folder.ts'),
  // the Mac's Calendar and Contacts, one connector folder for both
  calendar: MAC,
  contacts: MAC,
  // what the computer says about its person's work, one connector folder for the three
  browsing: COMPUTER,
  apps: COMPUTER,
  'ai-work': COMPUTER,
}

// What this Bridge lends besides folders: on a Mac, Calendar and Contacts, through Alpha's helper.
export const LENDS_HERE = process.platform === 'darwin' ? ['calendar', 'contacts'] : []

// The readers it carries that its Alpha offers only where a plugin is on (interviews): ticked in
// the app only when the Alpha it is paired with says it offers them (welcome's offers).
export const READERS = ['browsing', 'apps', 'ai-work']

// Alpha's helper, carried beside the Bridge in the app (or built in the repository), run here for
// Calendar and Contacts, so macOS asks this computer's person.
const HELPER =
  process.env.ALPHA_HELPER_APP ??
  (packed
    ? join(root, 'Alpha Helper.app')
    : join(root, 'connector-sdk', 'helper', 'build', 'Alpha Helper.app'))
export const helper = (args: string[], options: Record<string, unknown>): Promise<unknown> => {
  if (process.platform !== 'darwin' || !existsSync(HELPER))
    return Promise.reject(new Error("Alpha's helper is not on this computer."))
  // the helper lives inside Alpha Bridge, so macOS names Alpha Bridge as asking
  return runHelper(HELPER, args, { ...(options as HelperOptions), asker: 'Alpha Bridge' })
}

// A connector's process: in Anthropic's sandbox on a Mac, reading only its code and the folders
// lent, reaching nothing; on Windows as it is, the signature on this Bridge being the wall.
const quote = (v: string) => `'${v.replace(/'/g, `'\\''`)}'`
let sandboxReady: Promise<typeof import('@anthropic-ai/sandbox-runtime').SandboxManager> | null =
  null
export const start: Start = async (connector, reads) => {
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

export function computerName(): string {
  if (process.platform !== 'darwin') return hostname()
  try {
    return execFileSync('scutil', ['--get', 'ComputerName'], { encoding: 'utf8' }).trim()
  } catch {
    return hostname()
  }
}

// A folder by its whole path, as it really is on this computer.
export function folderOf(given: string | undefined): string {
  if (!given) throw new Error('Say which folder: alpha-bridge lend <folder>.')
  const path = resolve(given)
  if (!existsSync(path) || !statSync(path).isDirectory())
    throw new Error(`There is no folder at ${path}.`)
  return realpathSync(path)
}
