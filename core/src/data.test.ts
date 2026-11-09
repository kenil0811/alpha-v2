// The person's data from within Alpha: a backup, going back, the archive out and in, the daily
// copy, removal; on the plain platform, in a scratch home.
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { MemorySecrets } from '@alpha/connector-sdk'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  applyBring,
  backupNow,
  copyNewestBackup,
  dataView,
  listBackups,
  markRestart,
  prepareBring,
  removeData,
  restoreWorld,
  takeData,
  takeRestartNote,
} from './data.ts'
import { readInstall, writeInstall } from './install.ts'
import { PlainPlatform } from './platform/plain.ts'
import { World } from './world/world.ts'

let home: string
let world: World
beforeEach(async () => {
  home = mkdtempSync(join(tmpdir(), 'alpha-data-'))
  writeInstall(home, { owner: 'Kenil', tenant: 't_test' })
  world = await World.open(join(home, 'tenants', 't_test'))
  world.owner('Kenil')
})
afterEach(() => {
  world.close()
  rmSync(home, { recursive: true, force: true })
})

const ctx = () => ({
  actor: { kind: 'person' as const, id: world.owner().id },
  user: world.owner().id,
})

describe('the person’s data', () => {
  it('says what the world holds, backs up now, and goes back to a backup', async () => {
    const m = world.shape.makeModule('Food', ctx())
    const t = world.shape.makeTable(m.id, 'Meals', [{ name: 'Food', kind: 'text' }], ctx())
    world.records.add(
      t.id,
      [{ values: { Food: 'two eggs' }, provenance: { kind: 'assumed', basis: 'a test' } }],
      ctx(),
    )
    const v = dataView(world, readInstall(home, {}))
    expect(v.world.rows).toBe(1)
    expect(v.world.version).toBe(1)
    expect(v.world.size).toBeGreaterThan(0)
    const b = await backupNow(world, { user: world.owner().id })
    expect(b.kind).toBe('now')
    expect(listBackups(world.paths.backups).map((x) => x.name)).toContain(b.name)
    expect(world.lines({ kinds: ['backup'] }).map((l) => l.words)).toEqual(['Backed up the world.'])
    // a second row, then the world put back as it was at the backup
    world.records.add(
      t.id,
      [{ values: { Food: 'toast' }, provenance: { kind: 'assumed', basis: 'a test' } }],
      ctx(),
    )
    expect(world.records.count(t.id)).toBe(2)
    const paths = world.paths
    world.close()
    await restoreWorld(paths, join(paths.backups, b.name))
    markRestart(paths, 'Went back.')
    world = await World.open(paths.dir)
    const again = world.shape.table('Meals')
    expect(again && world.records.count(again.id)).toBe(1)
    expect(takeRestartNote(paths.dir)).toBe('Went back.')
    expect(takeRestartNote(paths.dir)).toBeNull()
    await expect(restoreWorld(paths, join(paths.backups, 'world-now-none.sqlite'))).rejects.toThrow(
      /not there/,
    )
  })

  it('takes the data as one archive and brings it into a fresh install, refusing a world with rows', async () => {
    const m = world.shape.makeModule('Food', ctx())
    const t = world.shape.makeTable(m.id, 'Meals', [{ name: 'Food', kind: 'text' }], ctx())
    const [, toast] = world.records.add(
      t.id,
      [
        { values: { Food: 'two eggs' }, provenance: { kind: 'assumed', basis: 'a test' } },
        { values: { Food: 'toast' }, provenance: { kind: 'assumed', basis: 'a test' } },
      ],
      ctx(),
    )
    // a removed row waits in the trash, and the archive leaves it behind
    world.records.remove(t.id, [toast as string], ctx())
    writeFileSync(join(world.paths.instructions, 'everyone.md'), 'Be brief.\n')
    const out = join(home, 'out')
    const file = await takeData(world, home, out)
    expect(file).toMatch(/alpha-data-\d{4}-\d{2}-\d{2}\.tar\.gz$/)
    expect(() => prepareBring(world, file)).toThrow(/already holds rows/)
    // a fresh install
    const fresh = mkdtempSync(join(tmpdir(), 'alpha-fresh-'))
    try {
      const w2 = await World.open(join(fresh, 'tenants', 't_new'))
      w2.owner('Kenil')
      const staged = prepareBring(w2, file)
      const paths = w2.paths
      w2.close()
      await applyBring(paths, fresh, staged)
      expect(existsSync(staged.stage)).toBe(false)
      const w3 = await World.open(paths.dir)
      const meals = w3.shape.table('Meals')
      expect(meals && w3.records.count(meals.id)).toBe(1)
      expect(w3.db.prepare('SELECT count(*) AS n FROM removed_rows').get()).toEqual({ n: 0 })
      expect(existsSync(join(paths.instructions, 'everyone.md'))).toBe(true)
      w3.close()
      expect(() => prepareBring(world, join(fresh, 'nothing.tar.gz'))).toThrow(/not there/)
    } finally {
      rmSync(fresh, { recursive: true, force: true })
    }
  })

  it('copies the newest daily backup to the person’s folder, keeping seven, and removes everything on their word', async () => {
    mkdirSync(world.paths.backups, { recursive: true })
    for (const d of ['2026-10-20', '2026-10-21'])
      writeFileSync(join(world.paths.backups, `world-daily-${d}.sqlite`), d)
    const folder = join(home, 'copies')
    expect(copyNewestBackup(world.paths.backups, folder)).toBe(
      join(folder, 'alpha-world-daily-2026-10-21.sqlite'),
    )
    expect(copyNewestBackup(world.paths.backups, folder)).toBeNull() // the same again: nothing to do
    for (let i = 1; i <= 9; i++)
      writeFileSync(join(folder, `alpha-world-daily-2026-09-0${i}.sqlite`), 'x')
    writeFileSync(join(world.paths.backups, 'world-daily-2026-10-22.sqlite'), 'new')
    copyNewestBackup(world.paths.backups, folder)
    expect(readdirSync(folder).length).toBe(7)
    // removal: secrets gone, the person's folders gone, the readers' downloads kept
    const secrets = new MemorySecrets()
    await secrets.set('gmail:me', 'pw')
    await secrets.set('anthropic:api-key', 'sk')
    mkdirSync(join(home, 'browsers'), { recursive: true })
    mkdirSync(join(home, 'kits'), { recursive: true })
    world.close()
    const gone = await removeData(home, ['gmail:me'], secrets, new PlainPlatform())
    expect(gone.sort()).toEqual(['alpha.yaml', 'kits', 'tenants'])
    expect(await secrets.get('gmail:me')).toBeNull()
    expect(await secrets.get('anthropic:api-key')).toBeNull()
    expect(existsSync(join(home, 'browsers'))).toBe(true)
    expect(existsSync(join(home, 'tenants'))).toBe(false)
    world = await World.open(join(home, 'tenants', 't_test')) // for the afterEach
  })
})
