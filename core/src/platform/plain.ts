// The plain platform: a computer the core knows nothing special about. It runs the core for the
// tests and the journeys runner, and says in words where the Mac does something it cannot. It
// is not a server port: that comes with the server shape.
import { rmSync } from 'node:fs'
import { userInfo } from 'node:os'
import { NoSecrets, type SecretStore } from '@alpha/connector-sdk'
import { Refused } from '../world/kinds.ts'
import type { Platform } from './platform.ts'

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

  openLink(_url: string): boolean {
    return false
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
}
