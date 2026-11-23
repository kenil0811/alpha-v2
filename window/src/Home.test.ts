import type { AgentView, CardView } from '@alpha/core/api'
import { expect, it } from 'vitest'
import { fitWidth, nearestWidth } from './CardGrid.tsx'
import { fromWhom } from './NeedsYou.tsx'
import { listOf, nameOf } from './ui/question.tsx'

it('snaps a dragged share of the row to the nearest width', () => {
  expect(nearestWidth(0.05)).toBe('1/16')
  expect(nearestWidth(0.13)).toBe('1/8')
  expect(nearestWidth(0.2)).toBe('1/4')
  expect(nearestWidth(0.31)).toBe('1/3')
  expect(nearestWidth(0.55)).toBe('1/2')
  expect(nearestWidth(0.8)).toBe('1')
  expect(nearestWidth(1.4)).toBe('1')
})

it("puts each waiting card under its agent in the team's order, a schedule's under Schedules, sign-ins last", () => {
  const card = (id: string, agent: string, schedule = false) =>
    ({ id, agent, schedule: schedule ? { id: 's', name: 'Morning' } : null }) as CardView
  const agents = [
    { id: 'chief', name: 'Chief of staff', chief: true },
    { id: 'a', name: 'Sales' },
    { id: 'b', name: 'Books' },
  ] as AgentView[]
  const sign = { connection: 'g' } as Parameters<typeof fromWhom>[1][number]
  const f = fromWhom(
    [card('4', 'chief', true), card('1', 'a'), card('2', 'chief'), card('3', 'a', true)],
    [sign],
    agents,
  )
  expect(f.map((x) => [x.key, x.name, x.cards.map((c) => c.id), x.signIns.length])).toEqual([
    ['chief', 'Chief of staff', ['2'], 0],
    ['a', 'Sales', ['1', '3'], 0],
    ['schedules', 'Schedules', ['4'], 0],
    ['sign-ins', 'Sign-ins', [], 1],
  ])
  expect(fromWhom([], [], agents)).toEqual([])
})

it('reads a detail made only of a list as things to pick, and names each by its bold part', () => {
  const items = listOf('- **Maria Chen**, CFO · maria@x.example\n- Tom Alvarez, owner · tom@y')
  expect(items).toEqual(['**Maria Chen**, CFO · maria@x.example', 'Tom Alvarez, owner · tom@y'])
  expect(items?.map(nameOf)).toEqual(['Maria Chen', 'Tom Alvarez'])
  expect(listOf('Two deals:\n- one\n- two')).toBeNull()
  expect(listOf('- only one')).toBeNull()
})

it('fits a card to its main words: two lines with something under them, three without', () => {
  // a 1200px row: a quarter holds about 2 × 0.9 × 244 = 439px of words in two lines
  expect(fitWidth(400, 2, 1200)).toBe('1/4')
  expect(fitWidth(600, 2, 1200)).toBe('1/3')
  expect(fitWidth(600, 3, 1200)).toBe('1/4')
  expect(fitWidth(900, 2, 1200)).toBe('1/2')
  expect(fitWidth(5000, 3, 1200)).toBe('1')
})
