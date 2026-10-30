// When an agent next runs, as Today's "Coming up" shows it.
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { BrowserEngine } from '@alpha/connector-sdk'
import { describe, expect, it } from 'vitest'
import { config } from '../config.ts'
import { run as exec } from '../world/db.ts'
import { World } from '../world/world.ts'
import {
  type Agent,
  agents,
  cardsWaiting,
  functionOf,
  nextRun,
  setAgentState,
  syncAgents,
  triggerWords,
} from './agents.ts'
import { install } from './kits/index.ts'
import { AgentRunner } from './runs/index.ts'

const at = (s: string) => new Date(s).getTime()

describe('an agent’s next run', () => {
  it('is tomorrow at its hour when it ran today', () => {
    const next = nextRun(
      { every: 'day', at: '07:00' },
      '2026-10-20T10:04:00',
      at('2026-10-20T13:00:00'),
    )
    expect(next?.getDate()).toBe(21)
    expect(next?.getHours()).toBe(7)
  })

  it('is today at its hour when that has not come yet', () => {
    const next = nextRun(
      { every: 'day', at: '18:00' },
      '2026-10-19T18:00:00',
      at('2026-10-20T13:00:00'),
    )
    expect(next?.getDate()).toBe(20)
    expect(next?.getHours()).toBe(18)
  })

  it('is now when it never ran and its hour has passed', () => {
    const now = at('2026-10-20T13:00:00')
    expect(nextRun({ every: 'day', at: '07:00' }, null, now)?.getTime()).toBe(now)
  })

  it('is an hour after the last for an hourly one', () => {
    const next = nextRun({ every: 'hour' }, '2026-10-20T12:30:00', at('2026-10-20T13:00:00'))
    expect(next?.getTime()).toBe(at('2026-10-20T13:30:00'))
  })

  it('follows a schedule', () => {
    const next = nextRun({ cron: '0 9 * * 1' }, null, at('2026-10-20T13:00:00')) // Mondays at 9
    expect(next?.getDay()).toBe(1)
    expect(next?.getHours()).toBe(9)
  })

  it('has no time when it runs on changes', () => {
    expect(nextRun({ changes: 'Deals' }, null, Date.now())).toBeNull()
  })
})

describe('an agent’s triggers in words', () => {
  it('says each one whole, on a time or on an event', () => {
    const named = (n: string) => (n === 'leads' ? 'Leads' : n)
    expect(
      triggerWords(
        [
          { cron: '30 7 * * 1-5' },
          { every: 'day', at: '06:30' },
          { cron: '*/5 * * * *' },
          { changes: ['leads', 'Deals'] },
          { filed: true },
        ],
        named,
        'Intake',
      ),
    ).toEqual([
      { words: 'Weekdays 07:30', on: 'time' },
      { words: 'Daily 06:30', on: 'time' },
      { words: 'On the schedule */5 * * * *', on: 'time' },
      { words: 'When a row is added or changed in Leads or Deals', on: 'event' },
      { words: 'When a document is filed in Intake', on: 'event' },
    ])
  })
})

describe('an agent’s function', () => {
  it('is what its file says, else read from its name and words, else Admin', () => {
    const a = { description: null, brief: '', function: null }
    expect(functionOf({ ...a, name: 'Fusion', function: 'Sourcing' })).toBe('Sourcing')
    expect(functionOf({ ...a, name: 'Outreach' })).toBe('Outreach')
    expect(functionOf({ ...a, name: 'Fusion', brief: 'Reads the listings each morning.' })).toBe(
      'Sourcing',
    )
    expect(functionOf({ ...a, name: 'Morning' })).toBe('Admin')
  })
})

// The made-up kit (test-kit/), with an agent that puts rows to the person: never the real model.
describe('an agent whose cards wait on the person', () => {
  it('puts like rows on the card already waiting, waits past the limit, and runs once woken', async () => {
    const home = mkdtempSync(join(tmpdir(), 'alpha-agents-'))
    const world = await World.open(join(home, 'tenants', 't_test'))
    const ctx = { actor: { kind: 'person' as const, id: 'u_1' }, user: 'u_1' }
    try {
      const m = await install(world, join(import.meta.dirname, 'test-kit'), ctx)
      world.shape.makeTable(
        m.id,
        'Picks',
        [
          { name: 'Name', kind: 'text' },
          { name: 'State', kind: 'choice', choices: ['Proposed', 'In', 'Out'] },
        ],
        ctx,
      )
      writeFileSync(
        join(m.dir, 'skills/picks.js'),
        `export default async (alpha) => {
          const n = alpha.input.n
          await alpha.rows.land('Picks', [{ key: 'k' + n, values: { Name: 'Row ' + n, State: 'Proposed' } }])
          const rows = (await alpha.rows.list('Picks')).map((r) => r.id)
          return alpha.review({ words: 'Pick these', table: 'Picks', field: 'State', choices: ['In', 'Out'], rows })
        }`,
      )
      writeFileSync(
        join(m.dir, 'agents/picker.md'),
        '---\nname: Picker\ntrigger: { every: day, at: "07:00" }\nruns: { script: skills/picks.js, input: { n: 1 } }\ntouches: [Picks]\n---\nPuts picks to the person.\n',
      )
      syncAgents(world, m, 'paused')
      const id = agents(world, m.id).find((a) => a.name === 'Picker')?.id as string
      setAgentState(world, id, 'on', 'u_1')
      const picker = () => agents(world, m.id).find((a) => a.id === id) as Agent
      const runner = new AgentRunner(world, () => ({}) as BrowserEngine, { owner: 'u_1' })

      // two runs, two rows: one card holding both
      const first = await runner.runAgent(picker())
      const second = await runner.runAgent(picker(), undefined, { n: 2 })
      expect([first.state, second.state]).toEqual(['ok', 'ok'])
      expect((first.result as { card: string }).card).toBe((second.result as { card: string }).card)
      const card = world.cards.get((first.result as { card: string }).card)
      expect(runner.reviews.view(card as never)?.rows.map((r) => r.name)).toEqual([
        'Row 1',
        'Row 2',
      ])
      expect(cardsWaiting(world, id)).toBe(1)

      // it ran today: not due until tomorrow, but turned on it runs at once
      const today = new Date()
      today.setHours(7, 30, 0, 0)
      const now = today.getTime() + 60_000
      exec(world.db, 'UPDATE agents SET last_run_at = ? WHERE id = ?', today.toISOString(), id)
      await runner.runDue(now)
      expect(runner.runs().filter((r) => r.agent === id)).toHaveLength(2)
      runner.woken.add(id)
      await runner.runDue(now)
      expect(runner.runs().filter((r) => r.agent === id)).toHaveLength(3)

      // past the limit of cards waiting, its runs wait for the person, and say so once
      const limit = config.limits().agent_cards_waiting
      const lastRun = runner.runs().find((r) => r.agent === id)?.id as string
      for (let i = 0; i < limit; i++)
        world.cards.open({
          kind: 'question',
          words: `Question ${i}`,
          actor: { kind: 'agent', id: 'Picker' },
          run: lastRun,
        })
      runner.woken.add(id)
      await runner.runDue(now)
      await runner.runDue(now)
      expect(runner.runs().filter((r) => r.agent === id)).toHaveLength(3)
      expect(
        world
          .lines({ kinds: ['run_step'] })
          .filter((l) => /waiting for you to go through/.test(l.words)),
      ).toHaveLength(1)
    } finally {
      world.close()
      rmSync(home, { recursive: true, force: true })
    }
  }, 60_000)
})
