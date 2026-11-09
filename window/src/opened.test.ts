// Tasks, runs, people and rows open beside the page, kept in the address (Batch A, pick 2).
import { describe, expect, it } from 'vitest'
import { linkBeside, pageOf, splitBeside, withBeside } from './opened.ts'
import { placeOf } from './place.ts'

describe('what is open beside the page', () => {
  it('is kept in the address, beside the page’s own', () => {
    expect(withBeside('#/module/m_1', { kind: 'task', id: 't_1' })).toBe(
      '#/module/m_1?beside=task/t_1',
    )
    expect(withBeside('#/table/t_9?only=r_1,r_2', { kind: 'person', id: 'p_3' })).toBe(
      '#/table/t_9?only=r_1,r_2&beside=person/p_3',
    )
    expect(splitBeside('#/table/t_9?only=r_1,r_2&beside=person/p_3')).toEqual({
      base: '#/table/t_9?only=r_1,r_2',
      opened: { kind: 'person', id: 'p_3' },
    })
    expect(splitBeside('#/module/m_1')).toEqual({ base: '#/module/m_1', opened: null })
    // the page under it is the same place it was
    expect(placeOf('#/module/m_1?beside=task/t_1')).toEqual(placeOf('#/module/m_1'))
  })

  it('opens from a link to a task, a run, a person or a row, not on that kind’s own screen', () => {
    expect(linkBeside('#/tasks/t_1', '#/')).toEqual({ kind: 'task', id: 't_1' })
    expect(linkBeside('#/run/r_1', '#/module/m_1')).toEqual({ kind: 'run', id: 'r_1' })
    expect(linkBeside('#/people/p_1', '#/table/t_1')).toEqual({ kind: 'person', id: 'p_1' })
    expect(linkBeside('#/row/r_1', '#/tasks/t_1')).toEqual({ kind: 'row', id: 'r_1' })
    expect(linkBeside('#/tasks/t_1', '#/tasks?list=open')).toBeNull() // Tasks opens its own
    expect(linkBeside('#/people/p_1', '#/people')).toBeNull()
    expect(linkBeside('#/module/m_1', '#/')).toBeNull() // a screen is a place, not beside
  })

  it('has its own page', () => {
    expect(pageOf({ kind: 'run', id: 'r_1' })).toBe('#/run/r_1')
    expect(pageOf({ kind: 'person', id: 'p_1' })).toBe('#/people/p_1')
  })

  it('opens a schedule, a rule and the rows a figure counted too (Batch D, 79.6, 79.7)', () => {
    expect(linkBeside('#/schedule/a_1', '#/')).toEqual({ kind: 'schedule', id: 'a_1' })
    expect(linkBeside('#/rule/u_1', '#/settings/permissions')).toEqual({ kind: 'rule', id: 'u_1' })
    const rows = linkBeside('#/table/t_9?only=r_1,r_2', '#/module/m_1')
    expect(rows).toEqual({ kind: 'rows', id: 't_9:r_1,r_2' })
    // kept in the address, so a reload keeps it; its page is the table, filtered
    const at = withBeside('#/module/m_1', rows)
    expect(splitBeside(at).opened).toEqual(rows)
    expect(pageOf({ kind: 'rows', id: 't_9:r_1,r_2' })).toBe('#/table/t_9?only=r_1,r_2')
  })
})
