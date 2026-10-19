import type { StreamLine } from '@alpha/core/api'
import { describe, expect, it } from 'vitest'
import { group } from './stream.ts'

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
  data: {},
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
      at,
    })
  })

  it('shows a turn of Alpha’s own after a note, and a closed card as a note', () => {
    n = 0
    const noticed = line('noticed', 'Carrying on after your yes.', { actor: 'system' })
    const items = group([
      line('card_closed', 'Yes: Remove a row from Meals?', { actor: 'person' }),
      noticed,
      line('replied', 'Removed it.', { turn: `n${noticed.id}` }),
    ])
    expect(items.map((i) => i.kind)).toEqual(['note', 'note', 'alpha'])
    expect(items[2]).toMatchObject({ reply: 'Removed it.' })
  })
})
