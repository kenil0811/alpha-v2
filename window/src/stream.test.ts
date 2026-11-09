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
  module: null,
  data: {},
  ...more,
})

describe('the stream', () => {
  it('keeps a turn’s words and steps in the order they came', () => {
    n = 0
    const said = line('said', 'find it', { actor: 'person' })
    const turn = String(said.id)
    const items = group([
      said,
      line('along', 'Let me look.', { turn }),
      line('call', 'Searched the web', { turn, data: { call: 'a' } }),
      line('called', 'Done.', { turn, data: { call: 'a', ok: true } }),
      line('along', 'One more.', { turn }),
      line('call', 'Read a page', { turn, data: { call: 'b' } }),
      line('called', 'Done.', { turn, data: { call: 'b', ok: true } }),
      line('replied', 'Here it is.', { turn }),
    ])
    expect(items[1]).toMatchObject({
      reply: 'Here it is.',
      parts: [
        { kind: 'text', text: 'Let me look.' },
        { kind: 'steps', steps: [{ words: 'Searched the web', ok: true }] },
        { kind: 'text', text: 'One more.' },
        { kind: 'steps', steps: [{ words: 'Read a page', ok: true }] },
        { kind: 'text', text: 'Here it is.' },
      ],
    })
  })

  it('puts a teammate’s answer on the line that asked, and the asking turn’s words stay as they were', () => {
    n = 0
    const said = line('said', 'ask Scout', { actor: 'person' })
    const turn = String(said.id)
    const items = group([
      said,
      line('asking', 'Asking Scout: find it', { turn, data: { ask: 'k1' } }),
      line('replied', 'I have asked Scout.', { turn }),
      line('answered', 'It is Agra.', {
        data: { ask: 'k1', status: 'done', evidence: 'One search', unblock: null },
      }),
      line('noticed', 'The answers came back.'),
      line('replied', 'Agra, says Scout.', { turn: 'n5' }),
    ])
    expect(items).toHaveLength(3)
    expect(items[1]).toMatchObject({
      kind: 'alpha',
      turn,
      asks: [
        {
          id: 'k1',
          words: 'Asking Scout: find it',
          answer: { words: 'It is Agra.', status: 'done', evidence: 'One search', unblock: null },
        },
      ],
    })
    expect(items[2]).toMatchObject({
      kind: 'alpha',
      turn: 'n5',
      reply: 'Agra, says Scout.',
      asks: [],
    })
  })

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
      parts: [
        {
          kind: 'steps',
          steps: [
            {
              id: 2,
              words: 'Added a row to Meals',
              ok: true,
              results: ['Added a row to Meals: Food eggs.'],
            },
            { id: 5, words: 'Asked: Which meal?', ok: true, results: [] },
          ],
        },
        { kind: 'text', text: 'Logged two eggs.' },
      ],
      cards: ['c_1'],
      answered: {},
      asks: [],
      notes: [],
      changes: [],
      at,
      module: null,
    })
  })

  it('puts a card’s answer where the card was, and a turn of Alpha’s own says nothing for itself', () => {
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
    expect(items.map((i) => i.kind)).toEqual(['said', 'alpha', 'alpha'])
    expect(items[1]).toMatchObject({
      cards: ['c_1'],
      answered: { c_1: { words: 'Yes: Remove a row from Meals?', state: 'yes', done: null } },
    })
    expect(items[2]).toMatchObject({ reply: 'Removed it.' })
  })

  it('leaves out what Activity has, and says a failure', () => {
    n = 0
    const items = group([
      line('told', 'Morning: nothing is due.', { actor: 'schedule' }),
      line('filed', 'Filed a quote on Acme.'),
      line('rule_saved', 'Never email outside example.com.'),
      line('card_closed', 'Yes: Remove a row?', { actor: 'person', data: { state: 'yes' } }),
      line('limit', 'The usage limit is reached.', { actor: 'system' }),
      line('error', 'The model did not answer.', { actor: 'system' }),
      line('refused', 'Only the person can do that.'),
    ])
    expect(items.map((i) => [i.kind, 'words' in i ? i.words : null])).toEqual([
      ['note', 'The usage limit is reached.'],
      ['note', 'The model did not answer.'],
      ['note', 'Only the person can do that.'],
    ])
  })

  it('shows a card a schedule’s run opened as a card, with its module', () => {
    n = 0
    const deals = { id: 'm_1', name: 'Listings' }
    const items = group([
      line('card_opened', 'Let Listings read example.com?', {
        actor: 'schedule',
        card: 'c_9',
        module: deals,
      }),
    ])
    expect(items).toEqual([{ kind: 'card', id: 'c_9', at, module: deals, answered: null }])
  })
})
