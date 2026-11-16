// The Bridge's own key: made on its computer when it pairs, its private half kept in the computer's
// own store for secrets (the Mac's Keychain, Windows' Credential Manager), never in a file and
// never sent anywhere; Alpha keeps only the public half. The key's text reaches each store on its
// standard input, never on a command line another program could see.
import { execFileSync } from 'node:child_process'
import { generateKeyPairSync } from 'node:crypto'

const SERVICE = 'Alpha Bridge'

export interface KeyStore {
  get(account: string): string | null // the private key, PEM
  set(account: string, pem: string): void
  forget(account: string): void
}

// A new Ed25519 key: its private half (PEM) and its public half (PEM).
export function newKey(): { privatePem: string; publicPem: string } {
  const k = generateKeyPairSync('ed25519')
  return {
    privatePem: k.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
    publicPem: k.publicKey.export({ type: 'spki', format: 'pem' }).toString(),
  }
}

// The Mac's Keychain, through its own security tool; the key kept as one base64 line.
const quoted = (v: string) => `"${v.replace(/(["\\])/g, '\\$1')}"`
export const keychain: KeyStore = {
  get(account) {
    try {
      const b64 = execFileSync(
        'security',
        ['find-generic-password', '-s', SERVICE, '-a', account, '-w'],
        { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
      ).trim()
      return b64 ? Buffer.from(b64, 'base64').toString('utf8') : null
    } catch {
      return null
    }
  },
  set(account, pem) {
    const b64 = Buffer.from(pem).toString('base64')
    execFileSync('security', ['-i'], {
      input: `add-generic-password -U -s ${quoted(SERVICE)} -a ${quoted(account)} -w ${b64}\n`,
      stdio: ['pipe', 'ignore', 'inherit'],
    })
    if (keychain.get(account) !== pem) throw new Error('The Keychain did not keep the key.')
  },
  forget(account) {
    try {
      execFileSync('security', ['delete-generic-password', '-s', SERVICE, '-a', account], {
        stdio: 'ignore',
      })
    } catch {
      // not there: nothing to forget
    }
  },
}

// Windows' Credential Manager, through its own PasswordVault in Windows PowerShell (always there;
// PowerShell 7 cannot reach it).
const VAULT = `[void][Windows.Security.Credentials.PasswordVault,Windows.Security.Credentials,ContentType=WindowsRuntime]
$vault = New-Object Windows.Security.Credentials.PasswordVault`
const ps = (script: string): string =>
  execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', '-'], {
    input: `$ErrorActionPreference = 'Stop'\n${VAULT}\n${script}\n`,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
    windowsHide: true,
  }).trim()
const psText = (v: string) => `'${v.replace(/'/g, "''")}'`
export const vault: KeyStore = {
  get(account) {
    try {
      const b64 = ps(
        `$c = $vault.Retrieve(${psText(SERVICE)}, ${psText(account)}); $c.RetrievePassword(); $c.Password`,
      )
      return b64 ? Buffer.from(b64, 'base64').toString('utf8') : null
    } catch {
      return null
    }
  },
  set(account, pem) {
    vault.forget(account)
    const b64 = Buffer.from(pem).toString('base64')
    ps(
      `$vault.Add((New-Object Windows.Security.Credentials.PasswordCredential(${psText(SERVICE)}, ${psText(account)}, ${psText(b64)})))`,
    )
    if (vault.get(account) !== pem) throw new Error('Credential Manager did not keep the key.')
  },
  forget(account) {
    try {
      ps(`$vault.Remove($vault.Retrieve(${psText(SERVICE)}, ${psText(account)}))`)
    } catch {
      // not there: nothing to forget
    }
  },
}

// A key held only while this program runs: the journeys' stand-in Bridge and the tests.
export function inMemory(): KeyStore {
  const kept = new Map<string, string>()
  return {
    get: (a) => kept.get(a) ?? null,
    set: (a, pem) => void kept.set(a, pem),
    forget: (a) => void kept.delete(a),
  }
}

// This computer's own store.
export function storeOf(platform: NodeJS.Platform = process.platform): KeyStore {
  if (platform === 'darwin') return keychain
  if (platform === 'win32') return vault
  throw new Error('The Bridge keeps its key in a Mac’s Keychain or in Windows’ Credential Manager.')
}
