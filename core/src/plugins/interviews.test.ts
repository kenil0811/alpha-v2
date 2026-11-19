// The interviews plugin (plugins/interviews) as an Alpha with it switched on starts it: it loads
// from this repository's plugins folder, and its kit makes Your work with the Interviewer in it.
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, expect, it } from 'vitest'
import { one } from '../world/db.ts'
import { World } from '../world/world.ts'
import { switchOn } from './plugins.ts'

let home: string
let world: World

beforeEach(async () => {
  home = mkdtempSync(join(tmpdir(), 'alpha-interviews-'))
  world = await World.open(join(home, 'tenants', 't_test'))
})
afterEach(() => {
  world.close()
  rmSync(home, { recursive: true, force: true })
})

it('loads where alpha.yaml names it, and its kit makes Your work with the Interviewer', async () => {
  const user = world.owner('Kenil')
  const { plugins, problems } = await switchOn(['interviews'], {
    world,
    user,
    home,
    region: () => null,
    ask: async () => ({ answer: null }),
    connectors: null,
  })
  expect(problems).toEqual([])
  expect(plugins.on()).toEqual(['interviews'])
  await plugins.keepKits({ actor: { kind: 'system' }, user: user.id })
  const m = world.shape.ownModule('Your work')
  expect(world.shape.tables(m?.id).map((t) => t.name)).toEqual([
    'Workflows',
    'Steps',
    'Proposals',
    'About you',
  ])
  expect(one(world.db, 'SELECT plugin FROM kits WHERE module_id = ?', m?.id ?? '')).toEqual({
    plugin: 'interviews',
  })
  const interviewer = world.agents.list().find((a) => a.name === 'Interviewer')
  expect(interviewer?.title).toBe('Learns how you work and what would help')
  expect(interviewer?.source).toBe(m?.id)
})
