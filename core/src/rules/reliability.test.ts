// What must fail loudly, and the rules held to their tests (docs/rules.md, R1 to R6). R3 is the
// door-list wall too: every route, tool and plugin call that writes is a door or is named in
// NOT_DOORS with why, and every act a door can do has its driver. R4 is held by review.
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { TOOL_NAMES, worldTools } from '../engine/tools/index.ts'
import { keepAgent } from '../modules/agents.ts'
import { Scheduler } from '../scheduler/scheduler.ts'
import { CHIEF } from '../world/agents/index.ts'
import { checkRules, pluginCalls, writeRoutes } from './check.ts'
import { DOORS, NOT_DOORS } from './doors.ts'
import { DRIVERS } from './drive.ts'
import { rule } from './rule.ts'
import type { RuleWorld } from './world.ts'

const SRC = join(import.meta.dirname, '..')
const MINUTE = 60_000

// A scheduled job that throws, ticked as the scheduler ticks it, once or more.
async function failing(w: RuleWorld, times: number): Promise<number> {
  const from = w.lastLine()
  const s = new Scheduler(w.world, [
    {
      run: async () => {
        throw new Error('the disk is full')
      },
    },
  ])
  const start = Date.now()
  for (let i = 0; i < times; i++) await s.tick(MINUTE, start + i * MINUTE)
  return from
}

rule('R1', 'every scheduled job that fails says so', {
  cases: {
    'a job that throws leaves a line saying so': async (w) => {
      const from = await failing(w, 1)
      return w.linesAfter(from).some((l) => /the disk is full/.test(l.words))
    },
    'two failures in a row leave a card on Home': async (w) => {
      const before = w.world.cards.waiting().length
      await failing(w, 2)
      return w.world.cards.waiting().length > before
    },
  },
  waits: {
    'a job that throws leaves a line saying so': 7,
    'two failures in a row leave a card on Home': 7,
  },
})

rule('R2', 'a daily backup that failed, or was not made by its hour, is a card the same day', {
  later: {
    'a backup that failed is a card the same day': 7,
    'a backup not made by its hour is a card the same day': 7,
  },
})

// Two agents, and the ask tool as the model calls it, delivering nowhere.
async function asking(w: RuleWorld) {
  const ctx = { actor: { kind: 'alpha' as const }, user: w.user.id }
  for (const n of ['One', 'Two'])
    await keepAgent(w.world, n, { title: n, description: n, instructions: n }, ctx, null)
  w.here.bus = { deliver: () => undefined, stop: () => undefined }
  const entry = worldTools(w.world, w.here).find((t) => t.name === 'ask_agent')
  return (to: string, objective: string) =>
    entry?.handler({ to: [to], objective, known: 'k', answer_wanted: 'a', limits: 'l' })
}

const said = (r: Awaited<ReturnType<Awaited<ReturnType<typeof asking>>>>) =>
  r?.content.map((c) => (c.type === 'text' ? c.text : '')).join('') ?? ''

rule('R6', 'one request makes at most 8 asks and 4 hops, counted by Alpha', {
  cases: {
    'the ninth ask of a request waits for Continue': async (w) => {
      const ask = await asking(w)
      for (let i = 0; i < 8; i++) await ask('One', `question ${i}`)
      const out = said(await ask('Two', 'one more'))
      return (
        /Continue first/.test(out) &&
        w.world.asks.ofRoot('t1').length === 8 &&
        w.world.cards.waiting().some((c) => c.call?.tool === 'ask_more')
      )
    },
    'a chain stops at 4 hops': async (w) => {
      const ask = await asking(w)
      const deep = w.world.asks.add({
        root: 't1',
        user: w.user.id,
        from: CHIEF,
        fromTurn: 't0',
        parent: null,
        to: w.world.agents.byName('One')?.id as string,
        hop: 4,
        brief: { objective: 'deep', known: 'k', answerWanted: 'a', limits: 'l' },
      })
      w.here.current.ask = deep.id
      return /4 steps deep/.test(said(await ask('Two', 'deeper')))
    },
    'the same ask is not made twice in one chain': async (w) => {
      const ask = await asking(w)
      await ask('One', 'Find deals')
      return /already asked/.test(said(await ask('One', 'find   deals')))
    },
  },
})

// What a door or NOT_DOORS names, each a route, `tool <name>` or `plugin <call>`.
const named = new Set([...DOORS.flatMap((d) => d.where), ...Object.keys(NOT_DOORS)])
const missing = (all: string[]) => all.filter((x) => !named.has(x))

rule('R3', 'each rule says how it is held, and every door is listed', {
  cases: {
    'docs/rules.md and the rule tests agree': async () => {
      const { problems } = checkRules()
      if (problems.length) console.error(problems.join('\n'))
      return problems.length === 0
    },
    'every route that writes is a door or says why not': async () => {
      const out = missing(writeRoutes())
      if (out.length) console.error(`Not in core/src/rules/doors.ts: ${out.join(', ')}`)
      return out.length === 0
    },
    'every tool of Alpha’s is a door or says why not': async () => {
      const out = missing(TOOL_NAMES.map((t) => `tool ${t}`))
      if (out.length) console.error(`Not in core/src/rules/doors.ts: ${out.join(', ')}`)
      return out.length === 0
    },
    'every call of the plugin host is a door or says why not': async () => {
      const out = missing(pluginCalls())
      if (out.length) console.error(`Not in core/src/rules/doors.ts: ${out.join(', ')}`)
      return out.length === 0
    },
    'every act a door can do has its driver': async (w) => {
      const out = DOORS.flatMap((d) => {
        const acts = DRIVERS[d.name]?.(w) ?? {}
        return d.can.filter((a) => typeof acts[a] !== 'function').map((a) => `${d.name}: ${a}`)
      })
      if (out.length) console.error(`No driver in core/src/rules/drive.ts for ${out.join(', ')}`)
      return out.length === 0
    },
  },
})

// Every file under core/src that loads plugins, but the tests and the rule world.
function loaders(dir = SRC): { file: string; text: string }[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name)
    if (e.isDirectory()) return p === import.meta.dirname ? [] : loaders(p)
    if (!e.name.endsWith('.ts') || e.name.endsWith('.test.ts')) return []
    const text = readFileSync(p, 'utf8')
    return /\bloadPlugins\(/.test(text) && !/function loadPlugins\(/.test(text)
      ? [{ file: p, text }]
      : []
  })
}

rule('R5', 'plugins are first-party code in this repository', {
  cases: {
    'the core loads plugins only from this repository’s plugins folder': async () => {
      const all = loaders()
      const astray = all.filter(({ text }) =>
        [...text.matchAll(/\bloadPlugins\(([^)]*)\)/g)].some((m) => m[1]?.trim() !== 'PLUGINS_DIR'),
      )
      if (astray.length)
        console.error(`Loads plugins from elsewhere: ${astray.map((a) => a.file).join(', ')}`)
      return all.length > 0 && astray.length === 0
    },
  },
})
