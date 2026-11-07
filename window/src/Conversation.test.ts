import { expect, test } from 'vitest'
import { answerOf, mentionAt } from './Conversation.tsx'

test('an @ at the start or after a space addresses an agent', () => {
  expect(mentionAt('@')).toBe('')
  expect(mentionAt('ask @Deal wa')).toBe('Deal wa')
  expect(mentionAt('mail me@home')).toBeNull()
  expect(mentionAt('@Deal\nnext')).toBeNull()
})

test('only a question’s answer stays in the chat', () => {
  expect(answerOf('Chose Add: Which meal?')).toBe('You chose Add')
  expect(answerOf('Answered Soon: When?')).toBe('You answered Soon')
  expect(answerOf('Yes: Remove a row from Meals?')).toBeNull()
  expect(answerOf('No: Remove a row from Meals?')).toBeNull()
  expect(answerOf('Withdrawn: Remove a row from Meals?')).toBeNull()
})
