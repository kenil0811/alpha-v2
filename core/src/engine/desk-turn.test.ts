// A running turn's text and steps, in the order they came.
import { describe, expect, it } from 'vitest'
import type { User } from '../world/world.ts'
import { addBreak, addStep, addText, failedOf, startTurn, textSoFar } from './desk-turn.ts'
import { refusedWords } from './route.ts'

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

describe('a turn Claude would not answer', () => {
  const owner: User = { id: 'u_1', name: 'Kenil', role: 'owner' }
  const member: User = { id: 'u_2', name: 'Asha', role: 'member' }

  it('says how this install was refused, by what the session was started with', () => {
    expect(refusedWords('authentication_failed', {})).toBe(
      'Alpha can’t reach Claude yet: Claude isn’t signed in here.',
    )
    expect(refusedWords('authentication_failed', { CLAUDE_CODE_OAUTH_TOKEN: 'sk-ant-x' })).toMatch(
      /refused the subscription token/,
    )
    expect(refusedWords('authentication_failed', { ANTHROPIC_API_KEY: 'sk-ant-x' })).toMatch(
      /refused the API key/,
    )
    expect(refusedWords('billing_error', {})).toMatch(/no plan or credit/)
    expect(refusedWords('server_error', {})).toBeNull()
  })

  it('links the owner to Settings › LLM, and tells a member who fixes it', () => {
    const e = { text: 'Alpha can’t reach Claude yet.', data: { refused: 'authentication_failed' } }
    expect(failedOf(e, owner)).toEqual({
      words: 'Alpha can’t reach Claude yet.',
      data: { fix: { at: '#/settings/model', words: 'Open Settings › LLM' } },
    })
    expect(failedOf(e, member)).toEqual({
      words: 'Alpha can’t reach Claude yet. The firm’s owner can fix it in Settings › LLM.',
      data: {},
    })
    expect(failedOf({ text: '', data: {} }, owner).words).toBe(
      'Something went wrong, and nothing more was done.',
    )
  })
})
