// Daily backups and what is kept of them.
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { backupDaily, kept, mirror, readManifests } from './backups.ts'
import { World } from './world.ts'

let home: string
let world: World

beforeEach(async () => {
  home = mkdtempSync(join(tmpdir(), 'alpha-backups-'))
  world = await World.open(join(home, 'tenants', 't_test'))
})

afterEach(() => {
  world.close()
  rmSync(home, { recursive: true, force: true })
})

describe('daily backups', () => {
  it('reads no manifests from a folder that is not one, so a start never stops on it', () => {
    const path = join(home, 'in-the-way')
    writeFileSync(path, 'a file')
    expect(readManifests(path)).toEqual([])
    expect(readManifests(join(home, 'nothing-here'))).toEqual([])
  })

  it('keep the last 7 days, then one a week for 4 weeks', () => {
    const days: string[] = []
    for (let i = 0; i < 60; i++)
      days.push(new Date(Date.UTC(2026, 9, 21) - i * 86_400_000).toISOString().slice(0, 10))
    const keep = [...kept(days)].sort().reverse()
    expect(keep.slice(0, 7)).toEqual(days.slice(0, 7))
    expect(keep).toHaveLength(11)
  })

  it('make one a day by the backup API, and leave the backups before a migration alone', async () => {
    const dir = join(home, 'b')
    const first = await backupDaily(world.db, dir, new Date('2026-10-21T08:00:00Z'))
    expect(first && existsSync(first)).toBe(true)
    expect(await backupDaily(world.db, dir, new Date('2026-10-21T20:00:00Z'))).toBeNull()
    writeFileSync(join(dir, 'world-2026-09-01T00-00-00-000Z-v6.sqlite'), 'x')
    for (const d of ['2026-09-01', '2026-09-02'])
      writeFileSync(join(dir, `world-daily-${d}.sqlite`), 'x')
    for (let i = 1; i <= 8; i++)
      await backupDaily(world.db, dir, new Date(Date.UTC(2026, 9, 21 + i, 8)))
    const names = readdirSync(dir)
    expect(names.filter((n) => n.startsWith('world-daily-'))).toHaveLength(7 + 2)
    expect(names).toContain('world-2026-09-01T00-00-00-000Z-v6.sqlite')
  })

  it('mirror the files by hash once each and the modules whole, beside the world', async () => {
    const dir = join(home, 'b')
    const ctx = { actor: { kind: 'person' as const, id: world.owner('Kenil').id } }
    const { file } = world.files.take(Buffer.from('a cim'), 'cim.pdf', 'application/pdf', ctx)
    const m = world.shape.makeModule('Rentals', { actor: { kind: 'alpha' } })
    writeFileSync(join(m.dir, 'NOTES.md'), '# Rentals\n')
    await backupDaily(world.db, dir, new Date('2026-10-25T08:00:00Z'), {
      files: world.paths.files,
      modules: world.paths.modules,
    })
    expect(existsSync(join(dir, 'files', file.hash.slice(0, 2), file.hash))).toBe(true)
    expect(existsSync(join(dir, 'modules', 'rentals', 'NOTES.md'))).toBe(true)
    // the next day: a new file comes, the old one is not copied again, the modules are refreshed
    writeFileSync(join(m.dir, 'NOTES.md'), '# Rentals, changed\n')
    const second = world.files.take(Buffer.from('a teaser'), 'teaser.pdf', 'application/pdf', ctx)
    expect(mirror({ files: world.paths.files, modules: world.paths.modules }, dir)).toEqual({
      files: 1,
    })
    expect(existsSync(join(dir, 'files', second.file.hash.slice(0, 2), second.file.hash))).toBe(
      true,
    )
    expect(readFileSync(join(dir, 'modules', 'rentals', 'NOTES.md'), 'utf8')).toContain('changed')
  })
})
