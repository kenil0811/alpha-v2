import { expect, test } from 'vitest'
import { mentionAt } from './Conversation.tsx'

test('an @ at the start or after a space addresses an agent', () => {
  expect(mentionAt('@')).toBe('')
  expect(mentionAt('ask @Deal wa')).toBe('Deal wa')
  expect(mentionAt('mail me@home')).toBeNull()
  expect(mentionAt('@Deal\nnext')).toBeNull()
})
