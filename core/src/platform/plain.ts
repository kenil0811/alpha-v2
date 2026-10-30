// The plain platform: a computer the core knows nothing special about. It runs the core for the
// tests and the journeys runner, and says in words where the Mac does something it cannot. It
// is not a server port: that comes with the server shape (design §15).
import { readdirSync, rmSync, statSync } from 'node:fs'
import { userInfo } from 'node:os'
import { join } from 'node:path'
import { NoSecrets, type SecretStore } from '@alpha/connector-sdk'
import { Refused } from '../world/kinds.ts'
import type { Places, Platform } from './platform.ts'

export class PlainPlatform implements Platform {
  readonly name = 'plain' as const
  readonly can = { notify: false, keepAwake: false, settings: false }
  readonly notified: { title: string; words: string }[] = [] // what would have been shown

  secrets(_helper: string | null): { store: SecretStore; helper: string | null } {
    return {
      store: new NoSecrets(
        'Alpha has no secret store on this computer yet, so it cannot keep a password.',
      ),
      helper: null,
    }
  }

  notify(title: string, words: string): void {
    this.notified.push({ title, words })
  }

  keepAwake(_on: boolean): void {}

  openSettings(pane: string): void {
    throw new Refused(`This computer has no settings pane for ${pane} that Alpha can open.`)
  }

  personName(): string {
    return userInfo().username
  }

  region(): string | null {
    return null
  }

  discard(path: string): void {
    rmSync(path, { recursive: true, force: true })
  }

  // Windows' places, where they are: the Start menu, the taskbar's pins, Recent, and each browser
  // under AppData. Elsewhere none of these folders is there, and nothing is read.
  // ponytail: Arc on Windows sits under a per-install package name; add it when a client uses it.
  places(home: string): Places {
    const roaming = join(home, 'AppData', 'Roaming')
    const local = join(home, 'AppData', 'Local')
    const shortcuts = (dir: string, since = 0) => {
      try {
        return readdirSync(dir)
          .filter((n) => n.endsWith('.lnk') && statSync(join(dir, n)).mtimeMs >= since)
          .map((n) => join(dir, n.slice(0, -4)))
      } catch {
        return []
      }
    }
    const menu = join('Microsoft', 'Windows', 'Start Menu', 'Programs')
    return {
      apps: [join(process.env.ProgramData ?? 'C:\\ProgramData', menu), join(roaming, menu)],
      app: '.lnk',
      pinned: () =>
        shortcuts(
          join(roaming, 'Microsoft', 'Internet Explorer', 'Quick Launch', 'User Pinned', 'TaskBar'),
        ).map((p) => p.split(/[\\/]/).pop() ?? ''),
      pinnedIn: 'the taskbar',
      recent: (days) =>
        shortcuts(join(roaming, 'Microsoft', 'Windows', 'Recent'), Date.now() - days * 86_400_000),
      chromium: [
        ['Chrome', join(local, 'Google', 'Chrome', 'User Data')],
        ['Edge', join(local, 'Microsoft', 'Edge', 'User Data')],
        ['Brave', join(local, 'BraveSoftware', 'Brave-Browser', 'User Data')],
      ],
      firefox: [join(roaming, 'Mozilla', 'Firefox', 'Profiles')],
      safari: null,
      plist: null,
      access: null,
    }
  }
}
