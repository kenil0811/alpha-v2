// The Bridge as the app runs it (`alpha-bridge serve`): the same Bridge, told what to do and saying
// what it does in lines on its standard input and output, one JSON object a line. The app draws
// its icon and menu from what it says; the person's folder picker and every yes stay in the app.
//   app → Bridge: pair {link}, lend and unlend {path, or connector: calendar|contacts}, browser
//                 {on}, pause {minutes|null}, resume, signout, state
//   Bridge → app: state {paired, alpha, name, online, turnedAway, paused, browser, chrome, offers, lends
//                 [{connector, account}]}, did
//                 {at, words}, pick {connector}, problem {words}
// What it did is kept on the computer too (did.json, the last 200), so its person can check what
// Alpha asked without trusting the server.
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { createInterface } from 'node:readline'
import { Bridge, keyAccount, pair } from './bridge.ts'
import type { Start } from './children.ts'
import { chromeHere, NO_CHROME } from './chrome.ts'
import { computerName, folderOf, helper, LENDS_HERE, READERS } from './code.ts'
import { type Config, fileOf, readConfig, writeConfig } from './config.ts'
import type { KeyStore } from './keys.ts'

const KEPT = 200

export interface Did {
  at: string
  words: string
}

// Pairing, here or in the terminal: a new key for this Alpha, the old one forgotten when it was
// another's, and what was lent kept when it is the same Alpha.
export async function pairHere(home: string, keys: KeyStore, link: string): Promise<Config> {
  const before = readConfig(home)
  const hostOf = (u: string) => {
    try {
      return new URL(u.trim()).host
    } catch {
      return ''
    }
  }
  const same = before && hostOf(before.alpha) === hostOf(link)
  const c = await pair(link, keys, computerName(), same ? before.computer : undefined)
  if (before && keyAccount(before.alpha) !== keyAccount(c.alpha))
    keys.forget(keyAccount(before.alpha))
  const kept = { ...c, lends: before?.alpha === c.alpha ? before.lends : [] }
  writeConfig(home, kept)
  return kept
}

// A site signed in to here for Alpha, or signed out of: kept in the list, as a folder is.
export function siteHere(home: string, site: string, on: boolean): void {
  const c = readConfig(home)
  if (!c) return
  const others = c.lends.filter((l) => !(l.connector === 'browser' && l.account === site))
  writeConfig(home, {
    ...c,
    lends: on ? [...others, { connector: 'browser', account: site }] : others,
  })
}

// The Browser switch: Alpha works on the sites signed in to here only while it is on.
export function browserHere(home: string, on: boolean): string {
  const c = readConfig(home)
  if (!c) throw new Error('Pair this computer first.')
  if (on && !chromeHere()) throw new Error(NO_CHROME)
  writeConfig(home, { ...c, browser: on })
  return on
    ? 'Browser on: Alpha may sign in to sites here and work on them.'
    : 'Browser off: Alpha no longer works on sites here.'
}

// What each thing it lends is called, as its person reads it.
const NAMES: Record<string, string> = {
  calendar: 'Calendar',
  contacts: 'Contacts',
  browsing: 'Browsing',
  apps: 'Apps',
  'ai-work': 'AI work',
}

// A lend or an unlend on this computer: a folder by its path, or Calendar or Contacts on a Mac (by
// the name Alpha knows the computer by). What it says it did, in words.
export function lendHere(home: string, what: string | undefined, on: boolean): string {
  const c = readConfig(home)
  if (!c) throw new Error('Pair this computer first.')
  const kind = what && [...LENDS_HERE, ...READERS].includes(what) ? what : 'folder'
  const account = kind === 'folder' ? folderOf(what) : c.name
  const others = c.lends.filter((l) => !(l.connector === kind && l.account === account))
  writeConfig(home, { ...c, lends: on ? [...others, { connector: kind, account }] : others })
  const named = kind === 'folder' ? account : (NAMES[kind] ?? kind)
  return on ? `Lent ${named}.` : `Stopped lending ${named}.`
}

export function didOf(home: string): Did[] {
  const file = join(home, 'did.json')
  if (!existsSync(file)) return []
  try {
    return JSON.parse(readFileSync(file, 'utf8')) as Did[]
  } catch {
    return []
  }
}

export interface Io {
  input: NodeJS.ReadableStream
  write(line: string): void
  closed(): void // the app went: the Bridge goes with it
}

export async function serve(
  home: string,
  keys: KeyStore,
  start: Start,
  io: Io = {
    input: process.stdin,
    write: (l) => process.stdout.write(l),
    closed: () => process.exit(0),
  },
): Promise<void> {
  const say = (m: Record<string, unknown>) => io.write(`${JSON.stringify(m)}\n`)
  let did = didOf(home)
  const note = (words: string) => {
    const d = { at: new Date().toISOString(), words }
    did = [...did, d].slice(-KEPT)
    writeFileSync(join(home, 'did.json'), JSON.stringify(did), { mode: 0o600 })
    // the same, to read in a text editor from the app's menu (What it did…)
    const lines = did.map((x) => `${new Date(x.at).toLocaleString()}  ${x.words}`).reverse()
    writeFileSync(
      join(home, 'did.txt'),
      `What Alpha Bridge did, newest first\n\n${lines.join('\n')}\n`,
      {
        mode: 0o600,
      },
    )
    say({ t: 'did', ...d })
  }
  let bridge: Bridge | null = null
  const state = () => {
    const c = readConfig(home)
    say({
      t: 'state',
      paired: !!c,
      alpha: c?.alpha ?? null,
      name: c?.name ?? null,
      online: !!bridge?.online,
      turnedAway: bridge?.turnedAway ?? null,
      paused: bridge?.paused
        ? {
            until: bridge.paused.until,
            // as its person reads it, in this computer's own time
            words: bridge.paused.until
              ? `until ${new Date(bridge.paused.until).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
              : 'until you resume',
          }
        : null,
      lends: c?.lends ?? [],
      browser: c?.browser === true,
      offers: bridge?.offers ?? [],
    })
  }
  const begin = () => {
    if (bridge || !readConfig(home)) return
    bridge = new Bridge({
      config: () => readConfig(home) as Config,
      keys,
      start,
      said: note,
      pick: (connector) => say({ t: 'pick', connector }),
      moved: state,
      helper,
      home,
      lendSite: (site, on) => {
        siteHere(home, site, on)
        state()
      },
      lendReader: (connector, on) => {
        lendHere(home, connector, on)
        state()
      },
      lendsHere: LENDS_HERE,
      lendBrowser: (on) => {
        browserHere(home, on)
        state()
      },
    })
    bridge.run()
  }
  // a lend or an unlend here (a folder by its path, or Calendar or Contacts), then Alpha told
  const lending = (m: { connector?: string; path?: string }, on: boolean) => {
    const what = m.connector && m.connector !== 'folder' ? m.connector : m.path
    note(lendHere(home, typeof what === 'string' ? what : undefined, on))
    bridge?.changed()
  }
  const lines = createInterface({ input: io.input })
  lines.on('line', (text) => {
    void (async () => {
      let m: {
        t?: string
        link?: string
        path?: string
        connector?: string
        minutes?: number | null
        on?: boolean
      }
      try {
        m = JSON.parse(text)
      } catch {
        return
      }
      try {
        if (m.t === 'pair') {
          bridge?.stop()
          bridge = null
          const c = await pairHere(home, keys, String(m.link ?? ''))
          note(`Paired with ${new URL(c.alpha).host} as ${c.name}.`)
          begin()
        } else if (m.t === 'lend') lending(m, true)
        else if (m.t === 'unlend') lending(m, false)
        else if (m.t === 'browser') {
          note(browserHere(home, m.on === true))
          bridge?.changed()
        } else if (m.t === 'pause') bridge?.pauseFor(m.minutes ?? null)
        else if (m.t === 'resume') bridge?.resume()
        else if (m.t === 'signout') {
          const c = readConfig(home)
          await bridge?.signOut()
          bridge = null
          if (c) keys.forget(keyAccount(c.alpha))
          rmSync(fileOf(home), { force: true })
          note('Signed out: this computer is no longer paired.')
        }
        state()
      } catch (err) {
        say({ t: 'problem', words: err instanceof Error ? err.message : String(err) })
      }
    })()
  })
  lines.on('close', () => {
    bridge?.stop()
    io.closed()
  })
  state()
  for (const d of did.slice(-20)) say({ t: 'did', ...d })
  begin()
}
