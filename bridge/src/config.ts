// What the Bridge keeps on its computer, in one file of its own: the Alpha it is paired with, the
// name Alpha knows it by, and what it lends. The list here is the truth: Alpha learns it from the
// Bridge and never adds to it (docs/rules.md, B2). Its key is never in this file (keys.ts).
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

export interface Lend {
  connector: string // folder, calendar, contacts, or browser (a site signed in to here)
  account: string // the folder's whole path on this computer
}

export interface Config {
  alpha: string // the Alpha's address (https://…)
  computer: string // the id Alpha gave this computer
  name: string // the name Alpha knows it by
  lends: Lend[] // folders, Calendar, Contacts, and each site signed in to here (browser)
  browser?: boolean // the Browser switch: off until its person turns it on
}

// The Bridge's own folder on this computer: ALPHA_BRIDGE_HOME when set (a test, the journeys).
export function homeOf(env: NodeJS.ProcessEnv = process.env): string {
  if (env.ALPHA_BRIDGE_HOME) return env.ALPHA_BRIDGE_HOME
  if (process.platform === 'darwin')
    return join(homedir(), 'Library', 'Application Support', 'Alpha Bridge')
  if (process.platform === 'win32')
    return join(env.APPDATA ?? join(homedir(), 'AppData', 'Roaming'), 'Alpha Bridge')
  return join(homedir(), '.alpha-bridge')
}

export const fileOf = (home: string) => join(home, 'bridge.json')

export function readConfig(home: string): Config | null {
  const file = fileOf(home)
  if (!existsSync(file)) return null
  const c = JSON.parse(readFileSync(file, 'utf8')) as Config
  return { ...c, lends: c.lends ?? [] }
}

// Written whole, then moved into place, so a reader never sees half of it.
export function writeConfig(home: string, c: Config): void {
  mkdirSync(home, { recursive: true })
  const file = fileOf(home)
  writeFileSync(`${file}.new`, `${JSON.stringify(c, null, 2)}\n`, { mode: 0o600 })
  renameSync(`${file}.new`, file)
}

// What it lends now: its sites only while the Browser switch is on.
export const lentNow = (c: Config | null): Lend[] =>
  (c?.lends ?? []).filter((l) => l.connector !== 'browser' || c?.browser === true)

// Whether this computer lends a connector's account now.
export const lends = (c: Config | null, connector: string, account: string) =>
  lentNow(c).some((l) => l.connector === connector && l.account === account)
