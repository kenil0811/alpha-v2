// Back returns to where you were (Batch A, pick 1, Kenil's call 2: a tab switch inside a screen
// is not a place). The places visited in this window, each with its screen's name.
import { describe, expect, it } from 'vitest'
import { backTo, screenOf, visit } from './back.ts'

describe('the way back', () => {
  it('is a screen, not a tab inside it', () => {
    expect(screenOf('#/module/m_1/agents')).toBe('#/module/m_1')
    expect(screenOf('#/module/m_1/page/funnel')).toBe('#/module/m_1')
    expect(screenOf('#/settings/model')).toBe('#/settings')
    expect(screenOf('#/intelligence/connections')).toBe('#/intelligence')
    expect(screenOf('#/tasks?list=week')).toBe('#/tasks')
    expect(screenOf('#/tasks/t_9')).toBe('#/tasks/t_9')
    expect(screenOf('#/people?companies')).toBe('#/people')
    expect(screenOf('#/table/t_1?field=Stage')).toBe('#/table/t_1')
  })

  it('goes back to the screen you came from, by its name', () => {
    let v = visit([], { hash: '#/module/m_1', name: 'DealPilot' }, '#/table/t_1')
    v = visit(v, { hash: '#/table/t_1', name: 'Deals' }, '#/row/r_7')
    expect(backTo(v)).toEqual({ hash: '#/table/t_1', name: 'Deals' })
    // a tab switch adds no place
    const tabs = visit([], { hash: '#/module/m_1', name: 'DealPilot' }, '#/module/m_1/agents')
    expect(tabs).toEqual([])
    // the place returned to comes off, so Back again goes one further
    expect(backTo(v.slice(0, -1))).toEqual({ hash: '#/module/m_1', name: 'DealPilot' })
  })

  it('has nothing to go back to on a fresh start or a link: the parent, as today', () => {
    expect(backTo([])).toBeNull()
  })

  it('keeps the newest places only', () => {
    let v: ReturnType<typeof visit> = []
    for (let i = 0; i < 60; i++)
      v = visit(v, { hash: `#/row/r_${i}`, name: `Row ${i}` }, `#/row/r_${i + 1}`)
    expect(v.length).toBe(30)
    expect(backTo(v)).toEqual({ hash: '#/row/r_59', name: 'Row 59' })
  })
})
