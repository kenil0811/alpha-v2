// Signed packs, on a throwaway key: a pack loads when it is signed by the key Alpha trusts, or
// while the developer switch is on; one byte changed anywhere is caught; an installed connector
// changed afterwards stops loading.
import { execFileSync } from 'node:child_process'
import { generateKeyPairSync } from 'node:crypto'
import {
  appendFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  loadSet,
  pack as packConnector,
  STANDARD_DIR,
  unpack as unpackConnector,
} from './connectors/discover.ts'
import { installPack, pack, unpack } from './modules/packs.ts'
import { signPack, UNSIGNED } from './signing.ts'
import { World } from './world/world.ts'

const KIT = join(import.meta.dirname, 'modules', 'test-kit')
const EXTRA = join(STANDARD_DIR, '..', 'connectors-extra')
const pair = () => {
  const k = generateKeyPairSync('ed25519')
  return {
    privatePem: k.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
    publicPem: k.publicKey.export({ type: 'spki', format: 'pem' }).toString(),
  }
}
const mine = pair()
const someoneElse = pair()
const off = { developer: false, key: mine.publicPem }

let home: string
let world: World
const ctx = { actor: { kind: 'system' as const } }
beforeEach(async () => {
  home = mkdtempSync(join(tmpdir(), 'alpha-signing-'))
  world = await World.open(join(home, 'tenants', 't_test'))
})
afterEach(() => {
  world.close()
  rmSync(home, { recursive: true, force: true })
})

describe('kit packs', () => {
  it('load signed, are refused unsigned or signed by another key unless the switch is on', async () => {
    const kits = join(home, 'kits')
    const unsigned = pack(KIT, join(home, 'out'))
    expect(() => unpack(unsigned, kits, off)).toThrow(UNSIGNED)
    expect(unpack(unsigned, kits, { developer: true, key: mine.publicPem }).name).toBe('Bakery')
    const other = signPack(pack(KIT, join(home, 'other')), someoneElse.privatePem)
    expect(() => unpack(other, kits, off)).toThrow(UNSIGNED)
    const signed = signPack(pack(KIT, join(home, 'signed')), mine.privatePem)
    expect(await installPack(world, signed, kits, ctx, off)).toBe(
      'Installed Bakery 0.1.0, its schedules paused.',
    )
  })

  it('refuse a signed pack with one byte changed, in a file or in its list', () => {
    const signed = signPack(pack(KIT, join(home, 'out')), mine.privatePem)
    const open = join(home, 'open')
    mkdirSync(open)
    execFileSync('tar', ['-xzf', signed, '-C', open])
    appendFileSync(join(open, 'kit', 'NOTES.md'), ' ')
    const changed = join(home, 'changed.alphakit')
    execFileSync('tar', ['-czf', changed, '-C', open, 'PACK.json', 'SIGNATURE', 'kit'])
    expect(() => unpack(changed, join(home, 'kits'), off)).toThrow(/not as it was packed/)
    // its list made to agree with the changed file: the signature no longer does
    const list = JSON.parse(readFileSync(join(open, 'PACK.json'), 'utf8'))
    list.files['NOTES.md'] = '0'.repeat(64)
    writeFileSync(join(open, 'PACK.json'), JSON.stringify(list))
    execFileSync('tar', ['-czf', changed, '-C', open, 'PACK.json', 'SIGNATURE', 'kit'])
    expect(() => unpack(changed, join(home, 'kits'), off)).toThrow(UNSIGNED)
  })
})

describe('connector packs', () => {
  it('load signed, refused unsigned; one changed after it was installed stops loading', async () => {
    const dir = join(home, 'connectors')
    const unsigned = await packConnector(join(EXTRA, 'linkedin'), join(home, 'out'))
    expect(() => unpackConnector(unsigned, dir, off)).toThrow(UNSIGNED)
    const signed = signPack(
      await packConnector(join(EXTRA, 'linkedin'), join(home, 'signed')),
      mine.privatePem,
    )
    const { dir: installed } = unpackConnector(signed, dir, off)
    const first = await loadSet(dir, [], off)
    expect([first.connectors.map((c) => c.manifest.name), first.failed]).toEqual([['linkedin'], []])
    for (const c of first.connectors)
      (c as { remote?: { process: { close(): void } } }).remote?.process.close()
    appendFileSync(join(installed, 'src', 'index.ts'), '\n// changed\n')
    const after = await loadSet(dir, [], off)
    expect(after.connectors).toEqual([])
    expect(after.failed[0]?.why).toMatch(/src\/index.ts changed since it was installed/)
    const dev = await loadSet(dir, [], { developer: true, key: mine.publicPem })
    expect(dev.connectors.map((c) => c.manifest.name)).toEqual(['linkedin'])
    for (const c of dev.connectors)
      (c as { remote?: { process: { close(): void } } }).remote?.process.close()
  }, 60_000)
})
