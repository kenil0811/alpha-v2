// Kenil's signing key and his signature on packs: `pnpm sign --new-key [--offline <file>]` makes
// the key once, its private half in this Mac's Keychain (and, when asked, one copy in a file to
// keep offline), its public half in config/signing-key.pub, which every release carries;
// `pnpm sign <pack>` signs a kit or a connector pack with it.
import { execFileSync } from 'node:child_process'
import { generateKeyPairSync } from 'node:crypto'
import { existsSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { KEY_FILE, signPack } from './signing.ts'

const SERVICE = 'Alpha signing key'
const ACCOUNT = 'alpha'

// The private key from the Keychain (kept base64, as one line), or none.
export function keychainKey(): string | null {
  try {
    const b64 = execFileSync(
      'security',
      ['find-generic-password', '-s', SERVICE, '-a', ACCOUNT, '-w'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
    ).trim()
    return b64 ? Buffer.from(b64, 'base64').toString('utf8') : null
  } catch {
    return null
  }
}

function newKey(offline: string | null): void {
  if (keychainKey())
    throw new Error(`A signing key is in the Keychain already ("${SERVICE}"); nothing changed.`)
  const k = generateKeyPairSync('ed25519')
  const privatePem = k.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString()
  const publicPem = k.publicKey.export({ type: 'spki', format: 'pem' }).toString()
  execFileSync('security', [
    'add-generic-password',
    '-s',
    SERVICE,
    '-a',
    ACCOUNT,
    '-w',
    Buffer.from(privatePem).toString('base64'),
  ])
  if (offline) writeFileSync(offline, privatePem, { mode: 0o600, flag: 'wx' })
  writeFileSync(KEY_FILE, publicPem)
  console.log(`Made the signing key: its private half is in the Keychain ("${SERVICE}")`)
  if (offline) console.log(`and in ${offline}: keep that file offline, then delete it here.`)
  console.log(`Its public half is in ${KEY_FILE}; commit it, so every release carries it.`)
}

const args = process.argv.slice(2)
const at = (p: string) => resolve(process.env.INIT_CWD ?? process.cwd(), p)
try {
  if (args[0] === '--new-key') {
    const i = args.indexOf('--offline')
    newKey(i >= 0 && args[i + 1] ? at(args[i + 1] as string) : null)
  } else if (args[0] && existsSync(at(args[0]))) {
    const key = keychainKey()
    if (!key)
      throw new Error("No signing key in this Mac's Keychain: make it with pnpm sign --new-key.")
    console.log(`Signed ${signPack(at(args[0]), key)}`)
  } else {
    throw new Error('Say: pnpm sign <pack>, or pnpm sign --new-key [--offline <file>]')
  }
} catch (err) {
  console.error(err instanceof Error ? err.message : String(err))
  process.exit(1)
}
