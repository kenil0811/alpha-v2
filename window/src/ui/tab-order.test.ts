import { describe, expect, it } from 'vitest'
import { arrangeTabs, inBar, moveBefore, NO_TABS, pinTab } from './tab-order.ts'

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

describe('a person’s own header', () => {
  const main = { id: 'm', place: 'main' as const, tab: false }
  const part = { id: 'p', place: 'part' as const, tab: false }
  const kept = { id: 'k', place: 'setup' as const, tab: true } // kept as a tab for everyone
  it('shows the main tables and those kept as tabs, and hides what the person hid', () => {
    expect([main, part, kept].map((t) => inBar(t, NO_TABS))).toEqual([true, false, true])
    const mine = pinTab(main, NO_TABS, false)
    expect(mine).toEqual({ order: [], hidden: ['m'], pinned: [] })
    expect(inBar(main, mine)).toBe(false)
  })
  it('pins a part for this person alone, and a pin or a hide undoes the other', () => {
    const pinned = pinTab(part, NO_TABS, true)
    expect(pinned).toEqual({ order: [], hidden: [], pinned: ['p'] })
    expect(inBar(part, pinned)).toBe(true)
    expect(pinTab(part, pinned, false)).toEqual(NO_TABS)
    const hidden = pinTab(kept, NO_TABS, false)
    expect(hidden.hidden).toEqual(['k'])
    expect(pinTab(kept, hidden, true)).toEqual(NO_TABS)
  })
})
