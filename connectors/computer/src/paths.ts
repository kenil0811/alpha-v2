// Where the computer's readers read, on a Mac and on Windows: the browsers' profiles, the AI tools'
// session folders, the apps. The Bridge lets a reader's process read these and nothing else in the
// person's folder (its sandbox on a Mac), so a reader reaches only what it says it reads.
import { existsSync, readdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const mac = process.platform === 'darwin'
const win = process.platform === 'win32'
// the person's folder: ALPHA_COMPUTER_HOME stands in for it where a journey records a computer
const me = () => process.env.ALPHA_COMPUTER_HOME ?? homedir()

// The Chromium browsers' own folders, each holding its profiles (Default, Profile 1…).
export function browserRoots(env: NodeJS.ProcessEnv = process.env, home = me()): string[] {
  const roots = mac
    ? [
        'Google/Chrome',
        'Microsoft Edge',
        'BraveSoftware/Brave-Browser',
        'Arc/User Data',
        'Vivaldi',
        'Chromium',
      ].map((p) => join(home, 'Library', 'Application Support', p))
    : win
      ? [
          'Google/Chrome/User Data',
          'Microsoft/Edge/User Data',
          'BraveSoftware/Brave-Browser/User Data',
          'Vivaldi/User Data',
          'Chromium/User Data',
        ].map((p) => join(env.LOCALAPPDATA ?? join(home, 'AppData', 'Local'), p))
      : []
  return roots.filter((r) => existsSync(r))
}

// Each profile's history file under a browser's folder.
export function historyFiles(root: string): { browser: string; file: string }[] {
  let names: string[] = []
  try {
    names = readdirSync(root)
  } catch {
    return []
  }
  const browser = browserName(root)
  return names
    .filter((n) => n === 'Default' || /^Profile \d+$/.test(n))
    .map((n) => ({ browser, file: join(root, n, 'History') }))
    .filter((h) => existsSync(h.file))
}

const browserName = (root: string) =>
  /Edge/i.test(root)
    ? 'Edge'
    : /Brave/i.test(root)
      ? 'Brave'
      : /Arc/i.test(root)
        ? 'Arc'
        : /Vivaldi/i.test(root)
          ? 'Vivaldi'
          : /Chromium/i.test(root)
            ? 'Chromium'
            : 'Chrome'

// Claude Code's and Codex's session folders.
export const claudeDir = (home = me()) => join(home, '.claude', 'projects')
export const codexDir = (home = me()) => join(home, '.codex', 'sessions')

// The person's own apps folder (a Mac's /Applications needs no leave to read).
export const appDirs = (home = me()): string[] =>
  mac ? ['/Applications', join(home, 'Applications')].filter((d) => existsSync(d)) : []

// What a reader's process may read in the person's folder, by the reader's name.
export function readsOf(connector: string): string[] {
  if (connector === 'browsing') return browserRoots()
  if (connector === 'ai-work')
    return [claudeDir(), codexDir(), ...browserRoots()].filter((d) => existsSync(d))
  if (connector === 'apps') return appDirs().filter((d) => d.startsWith(me()))
  return []
}
