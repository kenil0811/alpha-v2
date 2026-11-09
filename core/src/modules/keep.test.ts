// Keeping files in a module from the desk: where they may go, what is checked, and the commit.
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { World } from '../world/world.ts'
import { history } from './git.ts'
import { keep } from './keep.ts'
import { schedules } from './schedules.ts'

let home: string
let world: World
const ctx = { actor: { kind: 'alpha' as const }, user: 'u_1', turn: '7' }

beforeEach(async () => {
  home = mkdtempSync(join(tmpdir(), 'alpha-keep-'))
  world = await World.open(join(home, 'tenants', 't_test'))
})

afterEach(() => {
  world.close()
  rmSync(home, { recursive: true, force: true })
})

const SCHEDULE =
  '---\nname: Reader\ntrigger: { every: day, at: "06:30" }\nruns: { script: skills/read/run.js }\n---\nReads the list each morning.\n'

describe('keep', () => {
  it('keeps a reader and its schedule as commits, and the schedule is on', async () => {
    const m = world.shape.makeModule('Listings', ctx)
    await expect(keep(world, m, 'schedules/reader.md', SCHEDULE, ctx)).rejects.toThrow(
      /skills\/read\/run.js, which is not kept yet/,
    )
    await keep(
      world,
      m,
      'skills/read/SKILL.md',
      '---\nname: read\ndescription: Reads the list.\n---\nOpens the list.\n',
      ctx,
    )
    await keep(
      world,
      m,
      'skills/read/run.js',
      'export default async () => ({ words: "ok" })\n',
      ctx,
    )
    const said = await keep(world, m, 'schedules/reader.md', SCHEDULE, ctx)
    expect(said).toBe('Kept schedules/reader.md in Listings; Reader is on, every day at 06:30.')
    expect(schedules(world, m.id).map((a) => [a.name, a.state])).toEqual([['Reader', 'on']])
    expect((await history(m.dir)).map((c) => c.message)).toEqual([
      'Kept schedules/reader.md',
      'Kept skills/read/run.js',
      'Kept skills/read/SKILL.md',
    ])
    expect(readFileSync(join(m.dir, 'skills/read/run.js'), 'utf8')).toContain('words')
    expect(await keep(world, m, 'schedules/reader.md', undefined, ctx)).toBe(
      'schedules/reader.md in Listings was already kept as it is.',
    )
  })

  it('keeps only in a module’s places, and checks what it can', async () => {
    const m = world.shape.makeModule('Listings', ctx)
    await expect(keep(world, m, 'module.yaml', 'network: [x.com]', ctx)).rejects.toThrow(
      /is none of these/,
    )
    await expect(keep(world, m, 'skills/../../escape.js', 'x', ctx)).rejects.toThrow(
      /not a place in a module/,
    )
    await expect(keep(world, m, 'skills/read/SKILL.md', 'Just words.', ctx)).rejects.toThrow(
      /needs front matter/,
    )
    await expect(
      keep(world, m, 'schedules/bad.md', '---\ntrigger: { every: fortnight }\n---\n', ctx),
    ).rejects.toThrow(/is not right/)
  })
})
