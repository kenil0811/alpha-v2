// Plugins (docs/rules.md, P1 and P2): a plugin loads only where alpha.yaml's plugins line names it,
// and one switched off after use keeps what it made but hides its agents and schedules; the tools
// it gives are its own agent's alone, a conversation it starts is with that agent for the person
// who asked, and How to work is written only on the person's Keep. Tried on the rule world with the
// made-up plugin (core/src/plugins/test-plugin), never the model: a conversation's session is
// scripted here.
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Query, SDKMessage } from '@anthropic-ai/claude-agent-sdk'
import { buildServer } from '../api/server.ts'
import type { QueryFn } from '../engine/desk.ts'
import { Engine } from '../engine/engine.ts'
import type { Here } from '../engine/tools/common.ts'
import { Reviews } from '../modules/reviews.ts'
import { shownSchedules } from '../modules/schedules.ts'
import { loadPlugins, named, Plugins } from '../plugins/plugins.ts'
import { CHIEF } from '../world/agents/index.ts'
import { instructionsFile } from '../world/how-to-work.ts'
import { rule } from './rule.ts'
import type { RuleWorld } from './world.ts'

const DIR = join(import.meta.dirname, '..', 'plugins')
const TOKEN = { host: '127.0.0.1:4700', 'x-alpha-token': 'rules' }

// A session that answers every turn at once, keeping what it was told.
function scripted(told: string[]): QueryFn {
  return ({ prompt }) => {
    async function* gen() {
      yield { type: 'system', subtype: 'init', session_id: 's' } as unknown as SDKMessage
      for await (const m of prompt) {
        told.push(String(m.message.content))
        yield {
          type: 'result',
          subtype: 'success',
          result: 'Looked.',
          errors: [],
          terminal_reason: 'completed',
          duration_ms: 1,
          num_turns: 1,
          total_cost_usd: 0,
          modelUsage: {},
          session_id: 's',
        } as unknown as SDKMessage
      }
    }
    const g = gen()
    return Object.assign(g, {
      interrupt: async () => {},
      close: () => void g.return(undefined),
    }) as unknown as Query
  }
}

// This Alpha with these plugins on, as the core starts them from alpha.yaml.
async function switched(w: RuleWorld, names: string[], told: string[] = []) {
  w.world.pluginsOn = names
  const plugins = new Plugins({
    world: w.world,
    user: w.user,
    home: w.home,
    region: () => null,
    ask: async () => ({ answer: null }),
    connectors: null,
  })
  const chosen = named(names, await loadPlugins(DIR))
  await plugins.register(chosen.plugins)
  await plugins.keepKits({ actor: { kind: 'system' }, user: w.user.id })
  const engine = new Engine(w.world, {
    query: scripted(told),
    starts: () => plugins.startBlocks(),
    hands: {
      // no browser and no schedules here: a person who signed in to no site
      browser: () => ({ as: () => ({ sites: () => [] }) }) as never,
      runner: undefined as never, // no schedules run here
      plugins: (agent, here) => plugins.toolsFor(agent, here),
    },
  })
  plugins.engine = engine
  const app = buildServer({
    engine,
    user: w.user,
    token: 'rules',
    ports: [4700],
    plugins: plugins.routes,
    pluginsOn: plugins.on(),
  })
  return { plugins, engine, app }
}

const helperOf = (w: RuleWorld) => w.world.agents.list(true).find((a) => a.name === 'Note helper')
const hereFor = (w: RuleWorld, agent: string): Here => ({
  current: { user: w.user, turn: 't9', said: null, message: null, agent },
  fromSubagent: false,
  touched: new Set<string>(),
  afterTurn: [],
})

rule('P1', 'a plugin loads only where alpha.yaml names it', {
  cases: {
    'one not named adds no agent, tool, route, schedule, row or Home screen': async (w) => {
      const { app, engine } = await switched(w, [])
      try {
        const me = (await app.inject({ url: '/api/me', headers: TOKEN })).json() as {
          plugins: string[]
        }
        const route = await app.inject({ url: '/api/plugins/test/hello', headers: TOKEN })
        return (
          me.plugins.length === 0 &&
          route.statusCode === 404 &&
          !w.world.shape.ownModule('Kept notes') &&
          !helperOf(w) &&
          !shownSchedules(w.world).some((s) => s.name === 'Look at the notes')
        )
      } finally {
        await app.close()
        engine.close()
      }
    },
    'one named is on, with its agent, its schedule and its routes': async (w) => {
      const { app, engine } = await switched(w, ['test'])
      try {
        const me = (await app.inject({ url: '/api/me', headers: TOKEN })).json() as {
          plugins: string[]
        }
        const route = await app.inject({ url: '/api/plugins/test/hello', headers: TOKEN })
        return (
          me.plugins.join() === 'test' &&
          route.statusCode === 200 &&
          w.world.agents.list().some((a) => a.name === 'Note helper') &&
          shownSchedules(w.world).some((s) => s.name === 'Look at the notes')
        )
      } finally {
        await app.close()
        engine.close()
      }
    },
    'switched off after use, what it made stays and its agents and schedules are hidden': async (
      w,
    ) => {
      const first = await switched(w, ['test'])
      await first.app.close()
      first.engine.close()
      const m = w.world.shape.ownModule('Kept notes')
      const t = m && w.world.shape.ownTable(m.id, 'Notes')
      if (!t) return false
      w.world.records.add(
        t.id,
        [
          {
            values: { Line: 'Bakes on Fridays' },
            provenance: { kind: 'assumed', basis: 'the test' },
          },
        ],
        { actor: { kind: 'system' } },
      )
      const off = await switched(w, [])
      await off.app.close()
      off.engine.close()
      const hidden =
        !!w.world.shape.ownModule('Kept notes') &&
        w.world.records.list(t.id).length === 1 &&
        !w.world.agents.list().some((a) => a.name === 'Note helper') &&
        !shownSchedules(w.world).some((s) => s.name === 'Look at the notes')
      // on again, it carries on where it was
      const id = helperOf(w)?.id
      const again = await switched(w, ['test'])
      await again.app.close()
      again.engine.close()
      return hidden && w.world.agents.list().some((a) => a.id === id)
    },
    'a name alpha.yaml gives that is not there is said, never loaded in its place': async () => {
      const found = await loadPlugins(DIR)
      const out = named(['interviews'], found)
      return (
        out.plugins.length === 0 &&
        out.problems.join() === 'There is no plugin called interviews in plugins/ to switch on.'
      )
    },
  },
})

rule('P2', 'a plugin works through its own agent, and How to work only on the person’s Keep', {
  cases: {
    'its tools are its own agent’s alone': async (w) => {
      const { plugins, app, engine } = await switched(w, ['test'])
      try {
        const helper = helperOf(w)
        if (!helper) return false
        const names = (agent: string) =>
          plugins.toolsFor(agent, hereFor(w, agent)).map((t) => `${t.server} ${t.name}`)
        return names(helper.id).join() === 'test propose_lines' && names(CHIEF).length === 0
      } finally {
        await app.close()
        engine.close()
      }
    },
    'a conversation it starts is with its agent, for the person who pressed Start': async (w) => {
      const told: string[] = []
      const { app, engine } = await switched(w, ['test'], told)
      try {
        const helper = helperOf(w)
        const res = await app.inject({
          method: 'POST',
          url: '/api/plugins/test/start',
          headers: TOKEN,
        })
        await new Promise((r) => setTimeout(r, 50))
        const line = w.world
          .lines({ kinds: ['noticed'] })
          .find((l) => l.words === 'Started from the test plugin')
        return (
          res.statusCode === 200 &&
          line?.agent === helper?.id &&
          line?.user === w.user.id &&
          told.some((t) => t.includes('Look at the notes.'))
        )
      } finally {
        await app.close()
        engine.close()
      }
    },
    'a line lands in How to work only when the person keeps it': async (w) => {
      const { plugins, app, engine } = await switched(w, ['test'])
      try {
        const helper = helperOf(w)
        if (!helper) return false
        const [propose] = plugins.toolsFor(helper.id, hereFor(w, helper.id))
        const out = await propose?.handler({ lines: ['Works alone', 'Hates long mails'] })
        const card = w.world.cards
          .waiting(w.user.id)
          .find((c) => c.words === 'Keep these in How to work?')
        const file = instructionsFile(w.world, w.user.id)
        const before = existsSync(file) ? readFileSync(file, 'utf8') : ''
        if (!card || out?.isError || before.includes('Works alone')) return false
        const reviews = new Reviews(w.world, null)
        const rows = reviews.view(card)?.rows ?? []
        const person = { actor: { kind: 'person' as const, id: w.user.id }, user: w.user.id }
        reviews.choose(card.id, [rows[0]?.id ?? ''], 'Kept', person)
        reviews.choose(card.id, [rows[1]?.id ?? ''], 'Dropped', person)
        const after = readFileSync(file, 'utf8')
        const kept = w.world.lines({ kinds: ['remembered'] })
        return (
          /## About you\n\n- Works alone\n/.test(after) &&
          !after.includes('Hates long mails') &&
          kept.length === 1 &&
          kept[0]?.actor.kind === 'person'
        )
      } finally {
        await app.close()
        engine.close()
      }
    },
    'a line for everyone here is put only to the owner': async (w) => {
      const { plugins, app, engine } = await switched(w, ['test'])
      try {
        const helper = helperOf(w)
        if (!helper) return false
        const member = w.world.accounts.add('Ravi', 'ravi@bakery.example', {
          actor: { kind: 'person', id: w.user.id },
          user: w.user.id,
        })
        const host = (
          plugins as unknown as { host(l: unknown): import('@alpha/plugin-sdk').PluginHost }
        ).host(plugins.loaded[0])
        const [row] = host.own.add('Notes', [
          { values: { Line: 'Opens at six' }, basis: 'the test' },
        ])
        try {
          host.howToWork(
            { person: member.id, name: 'Ravi', owner: false, agent: helper.id, turn: 't9' },
            {
              words: 'Keep this for everyone?',
              table: 'Notes',
              rows: [row ?? ''],
              line: 'Line',
              choice: 'State',
              keep: 'Kept',
              drop: 'Dropped',
              for: 'everyone',
              heading: 'About the bakery',
            },
          )
          return false
        } catch (err) {
          return /Only the owner/.test(String(err))
        }
      } finally {
        await app.close()
        engine.close()
      }
    },
  },
})
