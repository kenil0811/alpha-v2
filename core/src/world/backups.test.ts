// Daily backups and what is kept of them.
import { existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { backupDaily, kept } from './backups.ts'
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
})
