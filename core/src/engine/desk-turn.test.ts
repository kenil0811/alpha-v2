// A running turn's text and steps, in the order they came.
import { describe, expect, it } from 'vitest'
import { addBreak, addStep, addText, startTurn, textSoFar } from './desk-turn.ts'

const turn = () => startTurn({ turn: '1', text: 'hello', said: null, message: null })

describe('a running turn', () => {
  it('keeps text and steps in order, and a new message of text as a new paragraph', () => {
    const r = turn()
    addText(r, 'Let me ')
    addText(r, 'look.')
    addStep(r, 'Searched the web')
    addText(r, 'First.')
    addBreak(r)
    addText(r, 'Second.')
    expect(r.parts).toEqual([
      { kind: 'text', text: 'Let me look.' },
      { kind: 'step', words: 'Searched the web' },
      { kind: 'text', text: 'First.\n\nSecond.' },
    ])
    expect(textSoFar(r)).toBe('First.\n\nSecond.')
  })

  it('has no text so far right after a step', () => {
    const r = turn()
    addText(r, 'Before.')
    addStep(r, 'Read a page')
    expect(textSoFar(r)).toBeNull()
  })
})
