// The secret store (design §8): secrets live in the Mac's Keychain, through Alpha's helper, and
// never in the world. A connection holds only the reference.
import { runHelper } from './helper.ts'

export interface SecretStore {
  get(ref: string): Promise<string | null>
  set(ref: string, secret: string): Promise<void>
  delete(ref: string): Promise<void>
}

const SERVICE = 'Alpha'

export class MacKeychain implements SecretStore {
  private helper: string

  constructor(helperApp: string) {
    this.helper = helperApp
  }

  async get(ref: string): Promise<string | null> {
    const out = await runHelper(this.helper, ['keychain', 'get', SERVICE, ref], { raw: true })
    return typeof out === 'string' ? out : null
  }

  async set(ref: string, secret: string): Promise<void> {
    await runHelper(this.helper, ['keychain', 'set', SERVICE, ref], { stdin: secret })
  }

  async delete(ref: string): Promise<void> {
    await runHelper(this.helper, ['keychain', 'delete', SERVICE, ref])
  }
}

// For tests: never the Keychain.
export class MemorySecrets implements SecretStore {
  private map = new Map<string, string>()

  async get(ref: string) {
    return this.map.get(ref) ?? null
  }

  async set(ref: string, secret: string) {
    this.map.set(ref, secret)
  }

  async delete(ref: string) {
    this.map.delete(ref)
  }
}
