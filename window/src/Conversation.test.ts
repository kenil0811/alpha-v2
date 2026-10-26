import { expect, test } from 'vitest'
import { mentionAt, routeChip } from './Conversation.tsx'

test('an @ at the start or after a space addresses an agent', () => {
  expect(mentionAt('@')).toBe('')
  expect(mentionAt('ask @Deal wa')).toBe('Deal wa')
  expect(mentionAt('mail me@home')).toBeNull()
  expect(mentionAt('@Deal\nnext')).toBeNull()
})

test('the chip names the route only when it is not the subscription', () => {
  const m = { desk: 'x', hasKey: true, providers: [] }
  expect(routeChip(null)).toBeNull()
  expect(routeChip({ ...m, route: 'subscription' })).toBeNull()
  expect(routeChip({ ...m, route: 'api' })).toBe("Alpha's own loop")
})
