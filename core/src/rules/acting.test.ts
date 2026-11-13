// What leaves, through the browser (docs/rules.md L2, L3): a browse step that puts something into
// a site asks once for the agent, the site and the piece of work; one that cannot be taken back
// asks each time; and a step only ever opens the profiles of the person its work is for. The
// browser is a stand-in for the page (never a real site) and the real engine for the profiles.
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { BrowserEngine } from '@alpha/connector-sdk'
import { Gatekeeper } from '../engine/gate.ts'
import type { Hands } from '../engine/tools/index.ts'
import { rule } from './rule.ts'
import type { RuleWorld } from './world.ts'

let n = 0
const call = () => ({ callId: `b${++n}`, subagent: null })

// A gate with a browser whose one page is drive.example: what has its keys is set by the case.
function gateOf(w: RuleWorld, focus = { editable: true, words: '', dialog: '' }) {
  const as: string[] = []
  const page = {
    url: () => 'https://drive.example/folders/1',
    screenshot: async () => Buffer.from([0xff, 0xd8, 0x01]),
    evaluate: async () => focus,
  }
  const browser = {
    as: (who: string) => {
      as.push(who)
      return browser
    },
    tab: async () => page,
    holding: () => false,
  }
  const hands = { browser: () => browser } as unknown as Hands
  const gate = new Gatekeeper(w.world, w.here, w.user, { hands })
  const step = async (input: Record<string, unknown>) =>
    (await gate.before('mcp__alpha__browse', input, call())).allow
  return { step, as }
}
const work = (w: RuleWorld, turn: string, agent: string | null = null) => {
  w.here.current = { ...w.here.current, turn, root: turn, agent }
}
const cards = (w: RuleWorld) => w.world.cards.waiting()
const yes = (w: RuleWorld) => {
  const c = cards(w)[0]
  if (c) w.engine.answer(w.user, c.id, c.options[0] ?? 'Yes')
}
const TYPE = { action: 'type', text: 'From Alpha' }
const ENTER = { action: 'key', keys: 'Enter' }

rule(
  'L2',
  'a browse step that puts something into a site asks once per agent, site and work; one that cannot be taken back asks each time',
  {
    cases: {
      'reading, moving and keys that only move ask nothing': async (w) => {
        const { step } = gateOf(w)
        for (const input of [
          { action: 'find', words: 'notes' },
          { action: 'scroll', direction: 'down' },
          { action: 'back' },
          { action: 'picture' },
          { action: 'key', keys: 'ArrowDown' },
          { action: 'key', keys: 'ControlOrMeta+End' },
        ])
          if (!(await step(input))) return false
        return cards(w).length === 0
      },
      'typing, choosing, a key that types and Enter in a form do not run without a yes': async (
        w,
      ) => {
        const { step } = gateOf(w)
        for (const input of [
          TYPE,
          { action: 'choose', n: 3, option: 'Team' },
          { action: 'key', keys: 'a' },
          ENTER,
        ])
          if (await step(input)) return false
        // one card for the agent, the site and the work, whatever the step
        return cards(w).length === 1
      },
      'a yes lets the rest of that work through, the turn after the card included': async (w) => {
        const { step } = gateOf(w)
        work(w, 't1')
        await step(TYPE)
        yes(w)
        w.here.current = { ...w.here.current, turn: 'n7', root: 't1' }
        return (await step(TYPE)) && (await step(ENTER)) && cards(w).length === 0
      },
      'the yes is not for other work, another agent, or after its hours': async (w) => {
        const { step } = gateOf(w)
        work(w, 't1')
        await step(TYPE)
        yes(w)
        work(w, 't2')
        if (await step(TYPE)) return false
        work(w, 't1', 'ag_other')
        if (await step(TYPE)) return false
        work(w, 't1')
        w.world.db
          .prepare("UPDATE cards SET decided_at = '2026-01-01T00:00:00.000Z' WHERE state = 'yes'")
          .run()
        return !(await step(TYPE))
      },
      'a step that cannot be taken back asks each time, under a yes and under Always': async (
        w,
      ) => {
        const typing = gateOf(w)
        for (const t of ['t1', 't2', 't3', 't4']) {
          work(w, t)
          await typing.step(TYPE)
          const c = cards(w)[0]
          if (c) w.engine.answer(w.user, c.id, c.options[0] ?? 'Yes', t === 't4')
        }
        work(w, 't5')
        // Always: acting goes with no card
        if (!(await typing.step(TYPE)) || cards(w).length) return false
        const { step } = gateOf(w, { editable: false, words: 'Delete forever', dialog: '' })
        if (await step(ENTER)) return false
        yes(w)
        return (await step(ENTER)) && !(await step(ENTER))
      },
      'Always is offered only after three yeses in a row, and is one agent’s on one site': async (
        w,
      ) => {
        const { step } = gateOf(w)
        work(w, 't1')
        await step(TYPE)
        const first = cards(w)[0]
        if (!first) return false
        try {
          w.engine.answer(w.user, first.id, first.options[0] ?? 'Yes', true)
          return false // given on the first yes
        } catch {
          return w.world.rules.list().length === 0
        }
      },
      'a deny rule on the site refuses with no card': async (w) => {
        w.world.rules.save(
          {
            side: 'deny',
            module: null,
            schedule: null,
            covers: { does: ['reach'], sites: ['drive.example'] },
            said: null,
          },
          { actor: { kind: 'person', id: w.user.id } },
        )
        const { step } = gateOf(w)
        return !(await step(TYPE)) && cards(w).length === 0
      },
    },
  },
)

rule('L3', 'a browse step opens only the profiles of the person its work is for, or the firm’s', {
  cases: {
    'the gate looks at the page as the person the work is for': async (w) => {
      const { step, as } = gateOf(w)
      await step(TYPE)
      return as.length > 0 && as.every((who) => who === w.user.id)
    },
    'one person’s sign-in to a site is not another’s, nor the firm’s': async () => {
      const home = mkdtempSync(join(tmpdir(), 'alpha-rule-profiles-'))
      try {
        const engine = new BrowserEngine({
          browsers: join(home, 'b'),
          profiles: join(home, 'p'),
          pace: { minMs: 0, maxMs: 0 },
        })
        engine.as('u_ann').markSignedIn('https://drive.example/')
        return (
          engine.as('u_ann').signedIn('https://drive.example/x') &&
          !engine.as('u_bob').signedIn('https://drive.example/x') &&
          !engine.signedIn('https://drive.example/x') &&
          engine.as('u_bob').sites().length === 0
        )
      } finally {
        rmSync(home, { recursive: true, force: true })
      }
    },
  },
})
