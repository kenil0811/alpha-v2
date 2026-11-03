import { describe, expect, it } from 'vitest'
import { ordered } from './tree.ts'

describe('the rail order', () => {
  it('puts the modules as dragged, and any not placed yet after them in the core’s order', () => {
    const m = (id: string) => ({ id, name: id, parent: null })
    const got = ordered([m('a'), m('b'), m('c'), m('d')], ['c', 'a'])
    expect(got.map((x) => x.id)).toEqual(['c', 'a', 'b', 'd'])
  })
})
