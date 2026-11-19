// The interviews plugin (plugins/interviews) as an Alpha with it switched on starts it: it loads
// from this repository's plugins folder, and its kit makes Your work with the Interviewer in it.
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Connector } from '@alpha/connector-sdk'
import { afterEach, beforeEach, expect, it } from 'vitest'
import { landIn } from '../connectors/places.ts'
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
  // a client's module already holding a table called Sources, as Deal pilot does
  landIn(world, {
    manifest: { name: 'deals', title: 'Deals' },
    module: 'Deal pilot',
    tables: [{ name: 'Sources', fields: [{ name: 'Name', kind: 'text' }] }],
  } as unknown as Connector)
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
    'Interview sources',
  ])
  expect(one(world.db, 'SELECT plugin FROM kits WHERE module_id = ?', m?.id ?? '')).toEqual({
    plugin: 'interviews',
  })
  const interviewer = world.agents.list().find((a) => a.name === 'Interviewer')
  expect(interviewer?.title).toBe('Learns how you work and what would help')
  expect(interviewer?.source).toBe(m?.id)
})

it('asks on Home to get to know them, starts and carries on in the Interviewer’s chat, and leaves Home on Decline', async () => {
  const user = world.owner('Kenil')
  const { plugins } = await switchOn(['interviews'], {
    world,
    user,
    home,
    region: () => null,
    ask: async () => ({ answer: null }),
    connectors: null,
  })
  await plugins.keepKits({ actor: { kind: 'system' }, user: user.id })
  const told: { words: string; brief: string }[] = []
  plugins.engine = {
    desk: () => ({ takeWork: (words: string, brief: string) => told.push({ words, brief }) }),
  } as never
  const route = (method: string, path: string) => {
    const r = plugins.routes.find(
      (x) => x.method === method && x.path === `/api/plugins/interviews${path}`,
    )
    if (!r) throw new Error(`No ${method} ${path}.`)
    const person = { id: user.id, name: user.name, owner: true }
    return r.answer({ params: {}, query: {}, body: {}, person }) as Promise<{
      title: string
      state: string
    }>
  }
  const first = await route('GET', '/home')
  expect(first.title).toMatch(/get to know you/)
  expect(first.state).toBe('start')
  expect((await route('POST', '/start')).state).toBe('part way')
  expect((await route('POST', '/start')).state).toBe('part way')
  expect(told.map((t) => t.words)).toEqual(['Started from Home', 'Carried on from Home'])
  expect(told[1]?.brief).toMatch(/where it stopped/)
  expect((await route('POST', '/decline')).state).toBe('declined')
  // Start again after Decline carries on, and Finish now ends it
  expect((await route('POST', '/start')).state).toBe('part way')
  expect((await route('POST', '/finish')).state).toBe('done')
  expect(told.at(-1)?.words).toBe('Finished from Home')
})
