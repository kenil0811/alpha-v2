// Watson, Alpha's own noticer, with a stand-in for the model: promises become proposed tasks,
// decisions and facts land as Proposed and wait on review cards; nothing said, no noticing.
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { BrowserEngine } from '@alpha/connector-sdk'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { Ask } from '../files/reading.ts'
import { World } from '../world/world.ts'
import { agents } from './agents.ts'
import { DEFAULT_KITS, keepDefaults } from './defaults.ts'
import { AgentRunner } from './runs/index.ts'

let home: string
let world: World
beforeEach(async () => {
  home = mkdtempSync(join(tmpdir(), 'alpha-watson-'))
  world = await World.open(join(home, 'tenants', 't_test'))
  world.owner('Kenil')
  await keepDefaults(world, { actor: { kind: 'system' }, user: world.owner().id }, DEFAULT_KITS)
})
afterEach(() => {
  world.close()
  rmSync(home, { recursive: true, force: true })
})

// The model's stand-in: a promise when the words say so (with Friday as a date), a decision on
// "decided", a fact on "is our", nothing else.
const fakeJudge: Ask = async (prompt) => {
  const items = prompt
    .split('\n')
    .filter((l) => /^\d+:/.test(l))
    .map((l) => [l.split(':')[0] as string, l] as const)
  return {
    answer: {
      answers: items.map(([id, l]) =>
        /promised Priya/i.test(l)
          ? { id, group: 'Promise', why: 'a promise to Priya, due 2026-10-30' }
          : /promised Mark/i.test(l)
            ? { id, group: 'Promise', why: 'a promise to Mark, no date said' }
            : /decided|from now on/i.test(l)
              ? { id, group: 'Decision', why: 'a decision on the office' }
              : /is our|revenue/i.test(l)
                ? { id, group: 'Fact', why: 'Priya Nair: the CFO at Harbor' }
                : { id, group: null, why: 'nothing' },
      ),
    },
    tokens: 50,
  }
}

function runner() {
  const engine = new BrowserEngine({
    browsers: join(home, 'b'),
    profiles: join(home, 'p'),
    pace: { minMs: 0, maxMs: 0 },
  })
  return new AgentRunner(world, () => engine, { owner: world.owner().id, judge: fakeJudge })
}

describe('Watson', () => {
  it('runs at two fixed times, and does nothing when nothing was said', async () => {
    const alpha = world.shape.module('Alpha')
    const watson = alpha && agents(world, alpha.id).find((a) => a.name === 'Watson')
    expect(watson?.state).toBe('on')
    expect(watson?.trigger).toEqual([
      { every: 'day', at: '12:30' },
      { every: 'day', at: '18:30' },
    ])
    const out = await runner().runAgent(watson as never)
    expect(out.state).toBe('ok')
    expect(out.words).toBe('Watson: Nothing said since last time.')
    expect(world.cards.waiting(world.owner().id)).toHaveLength(0)
  }, 60_000)

  it('proposes the promises as tasks, and puts decisions and facts to the person as Proposed rows', async () => {
    const owner = world.owner()
    for (const w of [
      'I promised Priya the CIM by Friday',
      'we decided to keep the office in Clayton',
      'Priya is our CFO at Harbor',
      'I promised Mark the deck, no date yet',
      'thanks',
    ])
      world.line({
        actor: { kind: 'person', id: owner.id },
        kind: 'said',
        words: w,
        user: owner.id,
      })
    const alpha = world.shape.module('Alpha')
    const watson = alpha && agents(world, alpha.id).find((a) => a.name === 'Watson')
    const out = await runner().runAgent(watson as never)
    expect(out.words).not.toMatch(/did not finish/)
    expect(out.state).toBe('ok')
    expect(out.words).toBe('Watson: Noticed 2 promises, 1 decision, 1 fact, for your yes.')
    const cards = world.cards.waiting(owner.id)
    const proposal = cards.find((c) => c.kind === 'suggestion')
    const input = proposal?.call?.input as { tasks: { title: string; due: string | null }[] }
    expect(input.tasks.map((t) => [t.title, t.due])).toEqual([
      ['I promised Priya the CIM by Friday', '2026-10-30'],
      ['I promised Mark the deck, no date yet', null],
    ])
    const reviews = cards
      .filter((c) => c.kind === 'review')
      .map((c) => c.words)
      .sort()
    expect(reviews).toEqual(['Watson noticed a decision', 'Watson noticed a fact'])
    const decisions = world.shape.table('Decisions')
    const noticed = world.shape.table('Noticed')
    expect(decisions && world.records.list(decisions.id).map((r) => r.values.state)).toEqual([
      'Proposed',
    ])
    expect(
      noticed && world.records.list(noticed.id).map((r) => [r.values.about, r.values.state]),
    ).toEqual([['Priya Nair', 'Proposed']])
    // a second run notices nothing new
    const again = await runner().runAgent(watson as never)
    expect(again.words).toMatch(/Nothing said since last time/)
  }, 60_000)

  it('leaves out what the person told Alpha to do: its turn acted on it (28 Oct)', async () => {
    const owner = world.owner()
    const said = (words: string) =>
      world.line({ actor: { kind: 'person', id: owner.id }, kind: 'said', words, user: owner.id })
    // a turn that wrote a row, and one that opened a rule's Save card: instructions, acted on
    const add = said('Add Acme Bakery, with revenue of 1,200,000 in 2024')
    world.line({
      actor: { kind: 'alpha' },
      kind: 'wrote',
      words: 'Added 1 row to Deals.',
      user: owner.id,
      turn: String(add.id),
    })
    const rule = said('From now on, copy me on every CIM request')
    world.line({
      actor: { kind: 'alpha' },
      kind: 'card_opened',
      words: 'Save this rule?',
      user: owner.id,
      turn: String(rule.id),
    })
    said('we decided to keep the office in Clayton')
    const alpha = world.shape.module('Alpha')
    const watson = alpha && agents(world, alpha.id).find((a) => a.name === 'Watson')
    const out = await runner().runAgent(watson as never)
    expect(out.words).toBe('Watson: Noticed 1 decision, for your yes.')
    const decisions = world.shape.table('Decisions')
    expect(decisions && world.records.list(decisions.id).map((r) => r.values.decision)).toEqual([
      'we decided to keep the office in Clayton',
    ])
    expect(
      world.shape.table('Noticed') &&
        world.records.list(world.shape.table('Noticed')?.id as string),
    ).toEqual([])
  }, 60_000)
})
