// Onboarding as the core runs it (4b, B): the real plugin loaded from plugins/, its own module
// (About you) kept inside Alpha's, its routes answered behind the token, the closer look given the
// plugin's read-only tools and no others, every look kept, its lines landing as Alpha's guesses and
// kept as the person's word, kept lines at the start of a conversation, the session's cost under
// its module. The model is a function here; never Claude.
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { buildServer } from '../api/server.ts'
import { startLayer } from '../engine/context.ts'
import { Engine } from '../engine/engine.ts'
import { monthOf } from '../world/day.ts'
import { World } from '../world/world.ts'
import { loadPlugins, PLUGINS_DIR, Plugins } from './plugins.ts'

const token = 'secret-token'
const ok = { host: '127.0.0.1:4700', 'x-alpha-token': token }
let home: string
let world: World
beforeEach(async () => {
  home = mkdtempSync(join(tmpdir(), 'alpha-onboarding-core-'))
  world = await World.open(join(home, 'tenants', 't_test'))
})
afterEach(() => {
  world.close()
  rmSync(home, { recursive: true, force: true })
})

it('runs onboarding through the plugin seam alone, and keeps only what the person keeps', async () => {
  const me = world.owner('Kenil')
  const sent: string[] = []
  const given: string[] = []
  const plugins = new Plugins({
    world,
    user: me,
    home,
    region: () => 'SG',
    ask: async () => {
      throw new Error('onboarding asks nothing without its tools')
    },
    // the model: looks at the days once, then answers citing that look
    explore: async (_system, prompt, tools) => {
      sent.push(prompt)
      given.push(...tools.map((t) => `${t.server}/${t.name}`))
      const day = tools.find((t) => t.name === 'day')
      const got = await day?.handler({})
      expect(got?.content).toEqual([{ type: 'text', text: '[t1] {"days":[]}' }])
      return {
        answer: {
          about: [{ line: 'You are Kenil, in Singapore', from: ['P1', 't1'], sure: 'likely' }],
          routines: [],
          suggestions: [],
          questions: [],
        },
        uses: [
          {
            model: 'claude-test',
            input: 900,
            output: 80,
            cacheRead: 0,
            cacheWrite: 0,
            usd: 0.02,
            how: 'reported' as const,
          },
        ],
      }
    },
    connectors: null,
  })
  const found = await loadPlugins(PLUGINS_DIR)
  expect(found.failed).toEqual([])
  expect(found.plugins.map((p) => p.plugin.name)).toEqual(['onboarding'])
  expect(await plugins.register(found.plugins)).toEqual([])
  await plugins.keepKits({ actor: { kind: 'system' }, user: me.id })
  const about = world.shape.ownModule('About you')
  expect(world.shape.module(about?.parent ?? '')?.name).toBe('Alpha')
  const engine = new Engine(world)
  const a = buildServer({ engine, user: me, token, ports: [4700], plugins: plugins.routes })
  try {
    const post = (url: string, payload: unknown = {}) =>
      a.inject({
        method: 'POST',
        url: `/api/plugins/onboarding${url}`,
        headers: ok,
        payload: payload as never,
      })
    const latest = async () =>
      (await a.inject({ url: '/api/plugins/onboarding/run', headers: ok })).json() as {
        id: string
        state: string
        overview: string
        calls: { id: string; tool: string }[]
      }
    const run = (await post('/look')).json() as { id: string; overview: string }
    expect(run.overview).toContain('[P1] Kenil; region SG')
    expect(run.overview).toContain('Browsing history: nothing read (not connected).')
    await vi.waitFor(async () => expect((await latest()).state).toBe('done'))
    // one session, the overview first, the plugin's own tools and no others
    expect(sent).toHaveLength(1)
    expect(sent[0]).toContain(run.overview)
    expect(given).toEqual([
      'onboarding/day',
      'onboarding/sites',
      'onboarding/apps',
      'onboarding/files',
      'onboarding/mail',
      'onboarding/calendar',
      'onboarding/contacts',
      'onboarding/search',
    ])
    expect((await latest()).calls.map((c) => [c.id, c.tool])).toEqual([['t1', 'day']])
    // what it cost, kept with Alpha's usage under its own module
    expect(world.spend.month(monthOf()).map((s) => [s.kind, s.module_id])).toEqual([
      ['ask', about?.id],
    ])
    const [line] = (
      await a.inject({ url: '/api/plugins/onboarding/about', headers: ok })
    ).json() as { id: string; values: { From: string } }[]
    expect(line?.values.From).toBe('You, Your days')
    expect(world.records.get(line?.id ?? '')?.record.provenance.line?.kind).toBe('assumed')
    expect(startLayer(world, me.id, home, null, plugins.startBlocks())).not.toContain(
      'About the person',
    )
    await post(`/about/${line?.id}/keep`)
    expect(world.records.get(line?.id ?? '')?.record.provenance.state?.kind).toBe('stated')
    expect(startLayer(world, me.id, home, null, plugins.startBlocks())).toContain(
      '## About the person (they kept these)\n- You are Kenil, in Singapore',
    )
    // a refusal said in the person's words
    const gone = await post('/answer', { run: 'r-nothing', question: 0, answer: 'x' })
    expect([gone.statusCode, gone.json().problem]).toEqual([
      409,
      'That question is not here any more.',
    ])
    expect(world.lines({ kinds: ['plugin'] }).map((l) => l.words)).toEqual([
      'Started getting to know the person from 0 meetings, 0 contacts, 0 messages, 0 sites, 0 apps and 0 file names.',
      'Looked closer 1 time, then wrote 1 line about the person, 0 routines, 0 suggestions and 0 questions; left out 0 nothing read backed.',
    ])
  } finally {
    await a.close()
    engine.close()
  }
})
