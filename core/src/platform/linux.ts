// A server: one firm's Alpha on a Linux machine of its own. Nobody is at its screen, so there is
// nothing to notify or keep awake. Secrets are in one encrypted file beside the world, whose key
// systemd hands the service after opening it with a key tied to this machine, so a copy of the
// disk or a backup opens nothing.
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
import { existsSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { userInfo } from 'node:os'
import { join } from 'node:path'
import { NoSecrets, type SecretStore } from '@alpha/connector-sdk'
import { Refused } from '../world/kinds.ts'
import type { Platform } from './platform.ts'

interface Sealed {
  iv: string
  tag: string
  data: string
}

export class FileSecrets implements SecretStore {
  private file: string
  private key: Buffer
  private writing: Promise<unknown> = Promise.resolve()

  constructor(file: string, key: Buffer) {
    if (key.length !== 32) throw new Error('The secrets key is not 32 bytes.')
    this.file = file
    this.key = key
  }

  private read(): Record<string, string> {
    if (!existsSync(this.file)) return {}
    const s = JSON.parse(readFileSync(this.file, 'utf8')) as Sealed
    const d = createDecipheriv('aes-256-gcm', this.key, Buffer.from(s.iv, 'base64'))
    d.setAuthTag(Buffer.from(s.tag, 'base64'))
    const out = Buffer.concat([d.update(Buffer.from(s.data, 'base64')), d.final()])
    return JSON.parse(out.toString('utf8')) as Record<string, string>
  }

  private write(all: Record<string, string>): void {
    const iv = randomBytes(12)
    const c = createCipheriv('aes-256-gcm', this.key, iv)
    const data = Buffer.concat([c.update(JSON.stringify(all), 'utf8'), c.final()])
    const sealed: Sealed = {
      iv: iv.toString('base64'),
      tag: c.getAuthTag().toString('base64'),
      data: data.toString('base64'),
    }
    const next = `${this.file}.new`
    writeFileSync(next, JSON.stringify(sealed), { mode: 0o600 })
    renameSync(next, this.file)
  }

  // One change at a time, each reading what the last one wrote.
  private change(fn: (all: Record<string, string>) => void): Promise<void> {
    const done = this.writing.then(() => {
      const all = this.read()
      fn(all)
      this.write(all)
    })
    this.writing = done.catch(() => undefined)
    return done
  }

  async get(ref: string): Promise<string | null> {
    return this.read()[ref] ?? null
  }

  set(ref: string, secret: string): Promise<void> {
    return this.change((all) => {
      all[ref] = secret
    })
  }

  delete(ref: string): Promise<void> {
    return this.change((all) => {
      delete all[ref]
    })
  }
}

export class LinuxPlatform implements Platform {
  readonly name = 'linux' as const
  readonly can = { notify: false, keepAwake: false, settings: false }

  secrets(_helper: string | null): { store: SecretStore; helper: string | null } {
    const dir = process.env.CREDENTIALS_DIRECTORY
    const home = process.env.ALPHA_HOME
    const keyFile = dir ? join(dir, 'alpha-secrets') : null
    if (!keyFile || !home || !existsSync(keyFile))
      return {
        store: new NoSecrets('This server has no key for its secrets, so it cannot keep one.'),
        helper: null,
      }
    return {
      store: new FileSecrets(
        join(home, 'secrets.enc'),
        Buffer.from(readFileSync(keyFile, 'utf8').trim(), 'base64'),
      ),
      helper: null,
    }
  }

  notify(_title: string, _words: string): void {}

  keepAwake(_on: boolean): void {}

  openSettings(pane: string): void {
    throw new Refused(`A server has no settings pane for ${pane} that Alpha can open.`)
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
