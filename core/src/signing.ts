// Packs signed by Kenil: a kit's or a connector's pack carries SIGNATURE beside its PACK.json, an
// Ed25519 signature over PACK.json's bytes, which list every file and its hash, so one byte changed
// anywhere is caught. The public half of his key ships in every release (config/signing-key.pub);
// the private half stays in his Keychain. A pack that is not signed by it loads only with the
// developer switch on (developer: true in alpha.yaml), off on a fresh install.
import { execFileSync } from 'node:child_process'
import { createPrivateKey, createPublicKey, sign as edSign, verify as edVerify } from 'node:crypto'
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Refused } from './world/kinds.ts'

// A Mac's tar otherwise adds a ._ file beside every file with extended attributes.
export const PLAIN_TAR = { env: { ...process.env, COPYFILE_DISABLE: '1' } }
export const SIGNATURE = 'SIGNATURE'
export const KEY_FILE = join(import.meta.dirname, '..', 'config', 'signing-key.pub')

// Kenil's public key, as the release carries it; none until he has made his key.
export function trustedKey(): string | null {
  return existsSync(KEY_FILE) ? readFileSync(KEY_FILE, 'utf8') : null
}

// PACK.json's bytes signed with a private key (PEM): the signature, base64.
export function signManifest(manifest: Buffer, privatePem: string): string {
  return edSign(null, manifest, createPrivateKey(privatePem)).toString('base64')
}

export function verifyManifest(manifest: Buffer, signature: string, publicPem: string): boolean {
  try {
    return edVerify(null, manifest, createPublicKey(publicPem), Buffer.from(signature, 'base64'))
  } catch {
    return false
  }
}

export const UNSIGNED = 'Not signed by Kenil, so it does not load here.'
export const FOLDERS = 'A folder loads only with developer: true in alpha.yaml.'

// Whether an opened pack's PACK.json is signed by the key Alpha trusts (or the one given, in a
// test): its folder holds PACK.json and SIGNATURE.
export function signedIn(dir: string, key: string | null = trustedKey()): boolean {
  const mf = join(dir, 'PACK.json')
  const sig = join(dir, SIGNATURE)
  if (!key || !existsSync(mf) || !existsSync(sig)) return false
  return verifyManifest(readFileSync(mf), readFileSync(sig, 'utf8').trim(), key)
}

// What an install trusts: the developer switch, and the key (Kenil's, unless a test gives one).
export interface Trust {
  developer: boolean
  key?: string | null
}

// An opened pack signed by the trusted key, else refused, unless the developer switch is on.
export function mustBeSigned(dir: string, trust: Trust): void {
  if (trust.developer) return
  if (!signedIn(dir, trust.key === undefined ? trustedKey() : trust.key))
    throw new Refused(UNSIGNED)
}

// A pack file signed with a private key (PEM): SIGNATURE written beside its PACK.json, the rest
// as it was. Returns the file.
export function signPack(file: string, privatePem: string): string {
  const stage = mkdtempSync(join(tmpdir(), 'alpha-sign-'))
  try {
    execFileSync('tar', ['-xzf', file, '-C', stage], { stdio: 'pipe' })
    const mf = join(stage, 'PACK.json')
    if (!existsSync(mf)) throw new Refused('That file is not a pack: it has no PACK.json.')
    writeFileSync(join(stage, SIGNATURE), `${signManifest(readFileSync(mf), privatePem)}\n`)
    const entries = readdirSync(stage).sort()
    execFileSync('tar', ['-czf', file, '-C', stage, ...entries], PLAIN_TAR)
    return file
  } finally {
    rmSync(stage, { recursive: true, force: true })
  }
}
