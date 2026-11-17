// The rail's modules: pinned ones first, in the order pinned; a hidden one gone, pin or not; one
// inside another keeps its place under it.
import type { ModuleSummary } from '@alpha/core/api'
import { describe, expect, it } from 'vitest'
import { shownTops } from './ModuleMenu.tsx'

const m = (id: string, parent: string | null = null) => ({ id, name: id, parent }) as ModuleSummary

describe('the rail', () => {
  const modules = [m('a'), m('b'), m('c'), m('d'), m('e', 'a')]
  const ids = (hidden: string[], pinned: string[]) =>
    shownTops(modules, hidden, pinned).map((x) => x.id)

  it('puts pinned modules first, in the order they were pinned', () => {
    expect(ids([], [])).toEqual(['a', 'b', 'c', 'd'])
    expect(ids([], ['c', 'a'])).toEqual(['c', 'a', 'b', 'd'])
  })

  it('leaves out a hidden module and one inside another, pinned or not', () => {
    expect(ids(['c'], ['c', 'e'])).toEqual(['a', 'b', 'd'])
  })
})
