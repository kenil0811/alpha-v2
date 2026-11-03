import { describe, expect, it } from 'vitest'
import { railLine } from './Shell.tsx'

const fixed = ['#/', '#/conversation', '#/tasks'].map((href) => ({
  href,
  label: href,
  current: false,
  count: 0,
  icon: () => null,
}))
const keys = (order: string[]) =>
  railLine(fixed, [{ id: 'a' }, { id: 'b' }], order).map((x) => x.key)

describe('the rail line', () => {
  it('keeps Home, Agents and Tasks first until something is dropped among them', () => {
    expect(keys([])).toEqual(['#/', '#/conversation', '#/tasks', 'a', 'b'])
    expect(keys(['b', 'a'])).toEqual(['#/', '#/conversation', '#/tasks', 'b', 'a'])
  })
  it('puts a module between Home and Agents where it was dropped', () => {
    expect(keys(['#/', 'b', '#/conversation', '#/tasks', 'a'])).toEqual([
      '#/',
      'b',
      '#/conversation',
      '#/tasks',
      'a',
    ])
  })
})
