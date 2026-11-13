// What the browse tool's steps are called in the turn.
import { describe, expect, it } from 'vitest'
import { stepWords } from '../words.ts'

describe('the browse steps in the turn', () => {
  it('say what was done in plain words, the site by its host', () => {
    const say = (input: Record<string, unknown>) => stepWords('mcp__alpha__browse', input)
    expect(say({ action: 'open', url: 'https://drive.google.com/drive/my-drive' })).toBe(
      'Opened drive.google.com',
    )
    expect(say({ action: 'click', n: 12 })).toBe('Clicked on the page')
    expect(say({ action: 'find', words: 'Plan' })).toBe('Looked on the page for “Plan”')
    expect(say({ action: 'picture' })).toBe('Looked at the page')
  })
})
