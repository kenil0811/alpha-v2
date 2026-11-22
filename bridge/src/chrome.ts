// Google Chrome on this computer, for the sites its person signs in to for Alpha (step 4 of the
// Bridge, 17 Nov): a profile of Chrome's own per site, in the Bridge's folder, never the person's
// everyday one. They sign in to a site in a normal window of that profile, with nothing driving it;
// afterwards Alpha drives it out of sight, Chrome started with its DevTools on a pipe that this
// Bridge carries over its one connection, so nothing on the computer listens. Chrome only (Kenil,
// 17 Nov): no Edge, no browser of the Bridge's own.
import { type ChildProcess, spawn } from 'node:child_process'
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import type { Readable, Writable } from 'node:stream'

// Where Chrome is here: ALPHA_BRIDGE_CHROME when set (a test), else where it installs itself.
export function chromeHere(env: NodeJS.ProcessEnv = process.env): string | null {
  if (env.ALPHA_BRIDGE_CHROME)
    return existsSync(env.ALPHA_BRIDGE_CHROME) ? env.ALPHA_BRIDGE_CHROME : null
  const places =
    process.platform === 'darwin'
      ? [
          '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
          join(
            homedir(),
            'Applications',
            'Google Chrome.app',
            'Contents',
            'MacOS',
            'Google Chrome',
          ),
        ]
      : process.platform === 'win32'
        ? [env.PROGRAMFILES, env['PROGRAMFILES(X86)'], env.LOCALAPPDATA]
            .filter((d): d is string => !!d)
            .map((d) => join(d, 'Google', 'Chrome', 'Application', 'chrome.exe'))
        : ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable']
  return places.find((p) => existsSync(p)) ?? null
}

export const NO_CHROME =
  'Google Chrome is not on this computer. Install it from google.com/chrome, then try again.'

// A site's own profile here: its name made safe for a folder.
export const profileOf = (home: string, site: string) =>
  join(home, 'browser', site.replace(/[^a-z0-9.-]/gi, '_'))

const QUIET = ['--no-first-run', '--no-default-browser-check']

// A sign-in as a small window of its own, as a site's own sign-in pop-up opens: no tabs and no
// toolbar, the site alone (Kenil, 22 Nov).
export const SIGN_IN_WINDOW = (url: string) => [`--app=${url}`, '--window-size=520,760']

// The site in a small window of its own profile, where the person signs in themselves; done when
// they close it. Alpha never sees what they type.
export function signInWindow(chrome: string, dir: string, url: string): Promise<void> {
  mkdirSync(dir, { recursive: true })
  const window = spawn(chrome, [`--user-data-dir=${dir}`, ...QUIET, ...SIGN_IN_WINDOW(url)], {
    stdio: 'ignore',
  })
  return new Promise((resolve, reject) => {
    window.on('exit', () => {
      writeFileSync(join(dir, '.signed-in'), new Date().toISOString())
      resolve()
    })
    window.on('error', (err) => reject(new Error(`Google Chrome did not open: ${err.message}`)))
  })
}

export function forget(dir: string): void {
  rmSync(dir, { recursive: true, force: true })
}

export interface Pipe {
  send(message: string): void
  close(): void
}

// The site's profile in Chrome out of sight, its DevTools on a pipe: each message Chrome says goes
// to heard, and ended says why it stopped (null: closed as asked).
export function openPipe(
  chrome: string,
  dir: string,
  heard: (message: string) => void,
  ended: (why: string | null) => void,
): Pipe {
  const proc: ChildProcess = spawn(
    chrome,
    [
      '--remote-debugging-pipe',
      `--user-data-dir=${dir}`,
      '--headless=new',
      ...QUIET,
      'about:blank',
    ],
    { stdio: ['ignore', 'ignore', 'ignore', 'pipe', 'pipe'] },
  )
  const down = proc.stdio[3] as Writable
  const up = proc.stdio[4] as Readable
  let asked = false
  let said = false
  let buf = ''
  up.on('data', (d: Buffer) => {
    said = true
    buf += d.toString('utf8')
    for (let i = buf.indexOf('\0'); i >= 0; i = buf.indexOf('\0')) {
      heard(buf.slice(0, i))
      buf = buf.slice(i + 1)
    }
  })
  // a profile held by the window the person signed in with: Chrome hands over to it and goes
  proc.on('exit', () =>
    ended(
      asked
        ? null
        : said
          ? 'Google Chrome stopped.'
          : 'Google Chrome is open with this site’s sign-in window. Close it, and Alpha goes on.',
    ),
  )
  proc.on('error', (err) => ended(`Google Chrome did not open: ${err.message}`))
  down.on('error', () => undefined)
  return {
    send: (message) => {
      if (!down.destroyed) down.write(`${message}\0`)
    },
    close: () => {
      asked = true
      proc.kill()
    },
  }
}
