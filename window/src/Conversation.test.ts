import { expect, test } from 'vitest'
import { answerOf } from './Conversation.tsx'

test('only a question’s answer stays in the chat', () => {
  expect(answerOf('Chose Add: Which meal?')).toBe('You chose Add')
  expect(answerOf('Answered Soon: When?')).toBe('You answered Soon')
  expect(answerOf('Yes: Remove a row from Meals?')).toBeNull()
  expect(answerOf('No: Remove a row from Meals?')).toBeNull()
  expect(answerOf('Withdrawn: Remove a row from Meals?')).toBeNull()
})
