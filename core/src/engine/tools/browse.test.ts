// Which of a page's buttons the browse tool will not press until acting asks: those whose words
// send something to other people or cannot be taken back. And what its steps are called in the turn.
import { describe, expect, it } from 'vitest'
import { stepWords } from '../words.ts'
import { asks } from './browse.ts'

describe('the browse steps that ask', () => {
  it('a button or menu item that sends or cannot be taken back', () => {
    expect(asks('- button "Share"')).toBe(true)
    expect(asks('- button "Post"')).toBe(true)
    expect(asks('- menuitem "Delete forever"')).toBe(true)
    expect(asks('- button "Place order"')).toBe(true)
    expect(asks('button "Share with people"')).toBe(true)
  })

  it('not a link, a sign-in, or a word inside another', () => {
    expect(asks('- link "Share"')).toBe(false)
    expect(asks('- button "Sign in"')).toBe(false)
    expect(asks('- button "Sort order"')).toBe(false)
    expect(asks('- button "Posts"')).toBe(false)
    expect(asks('- button "New folder"')).toBe(false)
  })
})

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
