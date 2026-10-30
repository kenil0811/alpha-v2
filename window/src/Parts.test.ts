import { describe, expect, it } from 'vitest'
import { moduleNumbers, numberTables } from './Parts.tsx'

describe('numbering', () => {
  it('numbers modules in rail order and tables as a tree under them', () => {
    const ms = [
      { id: 'a', name: 'Alpha', parent: null, alpha: true },
      { id: 'x', name: 'Avilo', parent: null },
      { id: 'd', name: 'DealPilot', parent: 'x' },
      { id: 'c', name: 'CRM', parent: 'x' },
    ]
    expect([...moduleNumbers(ms)]).toEqual([
      ['x', '1'],
      ['d', '1.1'],
      ['c', '1.2'],
    ])
    const t = (id: string, place: 'main' | 'part' | 'setup', of: string | null = null) => ({
      id,
      name: id,
      place,
      of,
    })
    const tables = [
      t('Sources', 'main'),
      t('Deals', 'main'),
      t('Theses', 'setup'),
      t('Financials', 'part', 'Deals'),
      t('Service mix', 'part', 'Deals'),
      t('Lines', 'part', 'Service mix'),
    ]
    expect(numberTables(tables, '2').map((r) => `${r.n} ${r.table.id}`)).toEqual([
      '2.1 Sources',
      '2.2 Deals',
      '2.2.1 Financials',
      '2.2.2 Service mix',
      '2.2.2.1 Lines',
      '2.3 Theses',
    ])
  })
})
