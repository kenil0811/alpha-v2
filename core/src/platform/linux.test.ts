// A server's secrets: kept, changed and removed in one encrypted file; the wrong key opens nothing.
import { randomBytes } from 'node:crypto'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { FileSecrets } from './linux.ts'

let home: string
beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), 'alpha-secrets-'))
})
afterEach(() => rmSync(home, { recursive: true, force: true }))

describe('a server’s secrets', () => {
  it('keeps them encrypted, and many writes at once all land', async () => {
    const file = join(home, 'secrets.enc')
    const s = new FileSecrets(file, randomBytes(32))
    await Promise.all(['a', 'b', 'c'].map((k) => s.set(k, `the secret ${k}`)))
    expect(await s.get('b')).toBe('the secret b')
    expect(readFileSync(file, 'utf8')).not.toContain('the secret')
    await s.delete('b')
    expect(await s.get('b')).toBeNull()
    expect(await s.get('c')).toBe('the secret c')
  })

  it('opens nothing with the wrong key', async () => {
    const file = join(home, 'secrets.enc')
    await new FileSecrets(file, randomBytes(32)).set('a', 'the secret')
    await expect(new FileSecrets(file, randomBytes(32)).get('a')).rejects.toThrow()
  })
})
