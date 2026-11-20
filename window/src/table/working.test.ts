import { describe, expect, it } from 'vitest'
import { BLANK } from './engine.ts'
import { drawnAs, viewOf } from './working.ts'

const board = { ...BLANK, kind: 'board' as const, group: 'stage', by: 'd1', measure: 'm1' }

describe('how a table is drawn, apart from the list', () => {
  it('keeps the list as saved when the person has no view', () => {
    expect(drawnAs(board, undefined)).toBe(board)
  })

  it('draws a list in the person’s kind, keeping its rows', () => {
    const list = { ...board, search: 'acme' }
    const drawn = drawnAs(list, viewOf({ ...BLANK, kind: 'table' }))
    expect(drawn.kind).toBe('table')
    expect(drawn.search).toBe('acme')
    expect(drawn.group).toBe('stage') // a table's group is the list's own
    expect(drawn.by).toBeNull()
  })

  it('takes a board’s group from the person', () => {
    expect(drawnAs(BLANK, viewOf({ ...board, group: 'owner' })).group).toBe('owner')
  })
})
