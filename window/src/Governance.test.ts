import type { StreamLine } from '@alpha/core/api'
import { describe, expect, it } from 'vitest'
import { type Sent, settle } from './Governance.tsx'

const line = (id: number, kind: string, more: Partial<StreamLine> = {}): StreamLine => ({
  id,
  at: '2026-10-30T16:00:00.000Z',
  actor: 'alpha',
  kind,
  words: kind,
  turn: '10',
  card: null,
  module: null,
  data: {},
  agent: null,
  run: null,
  ...more,
})
const sent: Sent = { turn: '10', words: 'Alpha must never x', side: 'deny', at: '', answer: null }

describe('words sent from Governance', () => {
  it('wait while Alpha works', () => {
    expect(settle([sent], [line(11, 'call')], new Set())).toEqual([sent])
  })
  it('give way to their Save card', () => {
    const lines = [line(11, 'card_opened', { card: 'c1' }), line(12, 'replied')]
    expect(settle([sent], lines, new Set(['c1']))).toEqual([])
  })
  it('say so when the turn ends without one', () => {
    const lines = [line(11, 'card_opened', { card: 'q1' }), line(12, 'replied')]
    expect(settle([sent], lines, new Set())[0]?.answer).toMatch(/not a rule yet/)
    const failed = settle([sent], [line(11, 'error', { words: 'The desk stopped.' })], new Set())
    expect(failed[0]?.answer).toBe('The desk stopped.')
  })
  it('ignore other turns', () => {
    expect(settle([sent], [line(11, 'replied', { turn: '9' })], new Set())).toEqual([sent])
  })
})
