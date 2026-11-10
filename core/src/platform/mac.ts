// The Mac: the Keychain through Alpha's helper app, macOS's own notifications, caffeinate,
// System Settings, the user's full name and the region.
import { type ChildProcess, execFile, execFileSync, spawn } from 'node:child_process'
import { existsSync, mkdirSync, renameSync } from 'node:fs'
import { homedir, userInfo } from 'node:os'
import { basename, join } from 'node:path'
import { MacKeychain, NoSecrets } from '@alpha/connector-sdk'
import type { Platform } from './platform.ts'

// Where the helper's source is, for a development run that builds it.
const HELPER_SRC = join(import.meta.dirname, '..', '..', '..', 'connector-sdk', 'helper')

export class MacPlatform implements Platform {
  readonly name = 'mac' as const
  readonly can = { notify: true, keepAwake: true, settings: true }
  private awake: ChildProcess | null = null

  // The shipped app carries the helper built and signed (alpha.yaml names it); in development it
  // is built when its source changed. Without it no password is kept, and connecting an account
  // says why.
  secrets(helper: string | null) {
    if (helper && existsSync(join(helper, 'Contents', 'MacOS', 'alpha-helper')))
      return { store: new MacKeychain(helper), helper }
    try {
      execFileSync('/bin/sh', [join(HELPER_SRC, 'build.sh')], { stdio: 'inherit' })
      const built = join(HELPER_SRC, 'build', 'Alpha Helper.app')
      return { store: new MacKeychain(built), helper: built }
    } catch {
      console.error(
        "Alpha's helper is not there and did not build: no password can be kept until it is.",
      )
      return {
        store: new NoSecrets(
          "Alpha's helper is not running on this Mac, so Alpha cannot keep a password safely. Reinstall Alpha, or send a report.",
        ),
        helper: null,
      }
    }
  }

  notify(title: string, words: string): void {
    const q = (s: string) => s.replace(/["\\]/g, '\\$&')
    execFile(
      '/usr/bin/osascript',
      ['-e', `display notification "${q(words)}" with title "Alpha" subtitle "${q(title)}"`],
      () => undefined,
    )
  }

  // macOS's own caffeinate, for as long as the core runs; on battery or with the lid closed the
  // Mac sleeps, and catches up on waking.
  keepAwake(on: boolean): void {
    this.awake?.kill()
    this.awake = null
    if (!on) return
    this.awake = spawn('/usr/bin/caffeinate', ['-s', '-w', String(process.pid)], {
      stdio: 'ignore',
    })
    this.awake.unref()
  }

  // System Settings at the pane where the person turns Alpha on (Privacy & Security › <pane>):
  // the one switch macOS keeps outside Alpha after a no.
  openSettings(pane: string): void {
    execFile(
      '/usr/bin/open',
      [`x-apple.systempreferences:com.apple.preference.security?Privacy_${pane}`],
      () => undefined,
    )
  }

  // The person's default browser, with macOS's own open: only a web address.
  openLink(url: string): boolean {
    if (!/^https:\/\//.test(url)) return false
    execFile('/usr/bin/open', [url], () => undefined)
    return true
  }

  // The Mac's own name for its user ("Sam Ortiz"), else the account name.
  personName(): string {
    try {
      const n = execFileSync('/usr/bin/id', ['-F'], { encoding: 'utf8' }).trim()
      if (n) return n
    } catch {
      // the account name below
    }
    return userInfo().username
  }

  // To the Trash, under a name that says what and when, so nothing is gone for good by Alpha.
  discard(path: string): void {
    const trash = join(homedir(), '.Trash')
    mkdirSync(trash, { recursive: true })
    const when = new Date().toISOString().slice(0, 16).replace('T', ' ').replace(':', '.')
    // the same folder sent twice in a minute gets a number, never a clash
    let to = join(trash, `Alpha ${basename(path)} ${when}`)
    for (let n = 2; existsSync(to); n++) to = join(trash, `Alpha ${basename(path)} ${when} (${n})`)
    renameSync(path, to)
  }

  // The Mac's region (en_SG → SG), else none.
  region(): string | null {
    try {
      const locale = execFileSync('/usr/bin/defaults', ['read', '-g', 'AppleLocale'], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      }).trim()
      const region = locale.replace('_', '-').split('-')[1]?.split('@')[0]?.toUpperCase()
      return region && /^[A-Z]{2}$/.test(region) ? region : null
    } catch {
      return null
    }
  }
}
