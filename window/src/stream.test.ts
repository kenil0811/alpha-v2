import type { StreamLine } from '@alpha/core/api'
import { describe, expect, it } from 'vitest'
import { group, threadOf } from './stream.ts'

const at = '2026-10-19T20:00:00.000Z'
let n = 0
const line = (kind: string, words: string, more: Partial<StreamLine> = {}): StreamLine => ({
  id: ++n,
  at,
  actor: 'alpha',
  kind,
  words,
  turn: null,
  card: null,
  module: null,
  data: {},
  agent: null,
  run: null,
  ...more,
})

describe('the stream', () => {
  it('groups a turn into the sentence and one message with its steps, results and cards', () => {
    n = 0
    const said = line('said', 'log two eggs', { actor: 'person' })
    const turn = String(said.id)
    const items = group([
      said,
      line('call', 'Added a row to Meals', { turn, data: { call: 'a' } }),
      line('wrote', 'Added a row to Meals: Food eggs.', { turn }),
      line('called', 'Done.', { turn, data: { call: 'a', ok: true } }),
      line('call', 'Asked: Which meal?', { turn, data: { call: 'b' } }),
      line('card_opened', 'Which meal?', { turn, card: 'c_1' }),
      line('called', 'Done.', { turn, data: { call: 'b', ok: true } }),
      line('replied', 'Logged two eggs.', { turn }),
    ])
    expect(items).toHaveLength(2)
    expect(items[0]).toMatchObject({ kind: 'said', words: 'log two eggs' })
    expect(items[1]).toEqual({
      kind: 'alpha',
      turn,
      reply: 'Logged two eggs.',
      error: null,
      steps: [
        {
          id: 2,
          words: 'Added a row to Meals',
          ok: true,
          results: ['Added a row to Meals: Food eggs.'],
        },
        { id: 5, words: 'Asked: Which meal?', ok: true, results: [] },
      ],
      cards: ['c_1'],
      answered: {},
      at,
      module: null,
    })
  })

  it('puts a card’s answer where the card was, and a turn of Alpha’s own after a note', () => {
    n = 0
    const said = line('said', 'remove the eggs', { actor: 'person' })
    const turn = String(said.id)
    const noticed = line('noticed', 'Carrying on after your yes.', { actor: 'system' })
    const items = group([
      said,
      line('card_opened', 'Remove a row from Meals?', { turn, card: 'c_1' }),
      line('replied', 'That waits for your yes.', { turn }),
      line('card_closed', 'Yes: Remove a row from Meals?', {
        actor: 'person',
        turn,
        card: 'c_1',
        data: { state: 'yes' },
      }),
      noticed,
      line('replied', 'Removed it.', { turn: `n${noticed.id}` }),
    ])
    expect(items.map((i) => i.kind)).toEqual(['said', 'alpha', 'note', 'alpha'])
    expect(items[1]).toMatchObject({
      cards: ['c_1'],
      answered: { c_1: { words: 'Yes: Remove a row from Meals?', state: 'yes', done: null } },
    })
    expect(items[3]).toMatchObject({ reply: 'Removed it.' })
  })

  it('shows a card an agent’s run opened as a card, with its module', () => {
    n = 0
    const deals = { id: 'm_1', name: 'Listings' }
    const items = group([
      line('card_opened', 'Let Listings read example.com?', {
        actor: 'agent',
        card: 'c_9',
        module: deals,
      }),
    ])
    expect(items).toEqual([
      { kind: 'card', id: 'c_9', at, module: deals, answered: null, agent: null },
    ])
  })

  it('keeps each agent to its own thread: its lines, what was said to it and the turn after', () => {
    n = 0
    const aps = { id: 'a_1', name: 'APS' }
    const said = line('said', 'why did you stop?', { actor: 'person', agent: aps })
    const turn = String(said.id)
    const lines = [
      line('said', 'hello', { actor: 'person' }),
      said,
      line('replied', 'It could not reach the site.', { turn }),
      line('told', 'APS: 3 new listings', { actor: 'agent', agent: aps, run: 'r_1' }),
      line('card_opened', 'Try again?', { actor: 'agent', card: 'c_2', agent: aps }),
      line('card_closed', 'Yes: Try again?', { card: 'c_2', data: { state: 'yes' } }),
    ]
    const of = threadOf(lines)
    expect(lines.map(of)).toEqual([null, 'a_1', 'a_1', 'a_1', 'a_1', 'a_1'])
  })
})
