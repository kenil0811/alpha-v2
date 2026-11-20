import { describe, expect, it } from 'vitest'
import { arrangeTabs, moveBefore } from './tab-order.ts'

const t = (id: string, sel = false) => ({ key: `t:${id}`, href: '', label: id, sel })
const keys = (x: { key: string }[]) => x.map((y) => y.key)

describe('arrangeTabs', () => {
  const tabs = [
    { key: 'p:a', href: '', label: 'a', sel: false },
    t('1'),
    t('2'),
    t('3'),
    { ...t('s'), key: 'setup' },
  ]
  it('puts ordered tabs first and keeps the rest in created order', () => {
    expect(keys(arrangeTabs(tabs, ['3']).shown)).toEqual(['p:a', 't:3', 't:1', 't:2', 'setup'])
  })
  it('hides a tab but never the one on screen', () => {
    const r = arrangeTabs([t('1'), t('2', true)], [], ['1', '2'])
    expect(keys(r.shown)).toEqual(['t:2'])
    expect(keys(r.hidden)).toEqual(['t:1'])
  })
})

describe('moveBefore', () => {
  it('moves before, or last', () => {
    expect(moveBefore(['a', 'b', 'c'], 'c', 'a')).toEqual(['c', 'a', 'b'])
    expect(moveBefore(['a', 'b', 'c'], 'a', null)).toEqual(['b', 'c', 'a'])
  })
})
