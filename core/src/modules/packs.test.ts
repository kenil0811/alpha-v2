// Kit packs, on the made-up kit: packed, checked, installed from an inbox, updated from a file.
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join, relative } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { one } from '../world/db.ts'
import { World } from '../world/world.ts'
import { agents } from './agents.ts'
import { installInbox, installPack, pack, unpack } from './packs.ts'

const KIT = join(import.meta.dirname, 'test-kit')
const sha = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex')
function filesIn(root: string, dir = root, out: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory()) filesIn(root, p, out)
    else if (e.isFile()) out.push(relative(root, p))
  }
  return out.sort()
}
let home: string
let world: World
const ctx = { actor: { kind: 'system' as const } }

beforeEach(async () => {
  home = mkdtempSync(join(tmpdir(), 'alpha-packs-'))
  world = await World.open(join(home, 'tenants', 't_test'))
})

afterEach(() => {
  world.close()
  rmSync(home, { recursive: true, force: true })
})

describe('kit packs', () => {
  it('pack a kit into one file that unpacks to the same files', () => {
    const file = pack(KIT, join(home, 'out'))
    expect(file.endsWith('bakery-0.1.0.alphakit')).toBe(true)
    const { name, version, dir } = unpack(file, join(home, 'kits'))
    expect([name, version]).toEqual(['Bakery', '0.1.0'])
    expect(readFileSync(join(dir, 'module.yaml'), 'utf8')).toBe(
      readFileSync(join(KIT, 'module.yaml'), 'utf8'),
    )
  })

  it('refuse a pack changed after packing', () => {
    const file = pack(KIT, join(home, 'out'))
    const open = join(home, 'open')
    mkdirSync(open)
    execFileSync('tar', ['-xzf', file, '-C', open])
    writeFileSync(join(open, 'kit', 'NOTES.md'), 'changed\n')
    const bad = join(home, 'bad.alphakit')
    execFileSync('tar', ['-czf', bad, '-C', open, 'PACK.json', 'kit'])
    expect(() => unpack(bad, join(home, 'kits'))).toThrow(/NOTES.md is not as it was packed/)
  })

  it('refuse a version that is a path, before any folder is touched, and a link inside', () => {
    const kits = join(home, 'kits')
    const keep = join(home, 'Documents')
    mkdirSync(keep)
    writeFileSync(join(keep, 'mine.txt'), 'keep me')
    // a pack whose version climbs out of the kits folder
    const open = join(home, 'open')
    mkdirSync(join(open, 'kit'), { recursive: true })
    cpSync(KIT, join(open, 'kit'), { recursive: true })
    const files = Object.fromEntries(
      filesIn(join(open, 'kit')).map((f) => [f, sha(readFileSync(join(open, 'kit', f)))]),
    )
    writeFileSync(
      join(open, 'PACK.json'),
      JSON.stringify({ name: 'Bakery', version: '../../Documents', files }),
    )
    const bad = join(home, 'bad.alphakit')
    execFileSync('tar', ['-czf', bad, '-C', open, 'PACK.json', 'kit'])
    expect(() => unpack(bad, kits)).toThrow(/not a version like 1.2.3/)
    expect(readFileSync(join(keep, 'mine.txt'), 'utf8')).toBe('keep me')
    // a pack carrying a link
    symlinkSync('/etc/hosts', join(open, 'kit', 'hosts'))
    writeFileSync(
      join(open, 'PACK.json'),
      JSON.stringify({ name: 'Bakery', version: '0.1.0', files }),
    )
    const linked = join(home, 'linked.alphakit')
    execFileSync('tar', ['-czf', linked, '-C', open, 'PACK.json', 'kit'])
    expect(() => unpack(linked, kits)).toThrow(/holds a link/)
    expect(existsSync(join(kits, 'bakery'))).toBe(false)
  })

  it('go in from the inbox at start, agents paused, and a newer one updates the kit', async () => {
    const kits = join(home, 'kits')
    mkdirSync(join(kits, 'inbox'), { recursive: true })
    pack(KIT, join(kits, 'inbox'))
    writeFileSync(join(kits, 'inbox', 'broken.alphakit'), 'not a pack')
    const said = await installInbox(world, kits, ctx)
    expect(said).toEqual([
      'Installed Bakery 0.1.0, its agents paused.',
      'broken.alphakit did not go in: That file is not a kit pack.',
    ])
    expect(existsSync(join(kits, 'inbox', 'done', 'bakery-0.1.0.alphakit'))).toBe(true)
    expect(existsSync(join(kits, 'inbox', 'failed', 'broken.alphakit.txt'))).toBe(true)
    const m = world.shape.module('Bakery')
    expect(agents(world, m?.id).every((a) => a.state === 'paused')).toBe(true)
    const next = join(home, 'next')
    cpSync(KIT, next, { recursive: true })
    writeFileSync(
      join(next, 'module.yaml'),
      readFileSync(join(KIT, 'module.yaml'), 'utf8').replace('version: 0.1.0', 'version: 0.2.0'),
    )
    writeFileSync(join(next, 'NOTES.md'), '# Bakery\nNewer.\n')
    const words = await installPack(world, pack(next, join(home, 'out')), kits, ctx)
    expect(words).toBe('Updated Bakery to 0.2.0: 1 files new or replaced, 0 of your changes kept.')
    expect(existsSync(join(kits, 'bakery', '0.2.0', 'NOTES.md'))).toBe(true)
    // the same kit again (every install refills the inbox) is nothing to do
    expect(await installPack(world, pack(next, join(home, 'again')), kits, ctx)).toBe(
      'Bakery 0.2.0 is already there.',
    )
    // an older one never takes it back: refused with words, set aside with the reason
    mkdirSync(join(kits, 'inbox'), { recursive: true })
    pack(KIT, join(kits, 'inbox'))
    expect(await installInbox(world, kits, ctx)).toEqual([
      'bakery-0.1.0.alphakit did not go in: Bakery 0.2.0 is already there, newer than 0.1.0; nothing changed.',
    ])
    expect(existsSync(join(kits, 'inbox', 'failed', 'bakery-0.1.0.alphakit'))).toBe(true)
    expect(one(world.db, 'SELECT version FROM kits')).toEqual({ version: '0.2.0' })
  })
})
