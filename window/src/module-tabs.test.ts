// A module's tabs: People's own Contacts is People's source (place 'people'), never a tab.
import type { ModuleSummary } from '@alpha/core/api'
import { describe, expect, it } from 'vitest'
import { moduleTabs } from './Module.tsx'

const t = (name: string, place: 'main' | 'people') => ({
  id: name,
  name,
  rows: 1,
  place,
  of: null,
  tab: false,
  number: null,
  view: 'table' as const,
})

describe('a module’s tabs', () => {
  it('leave out the Contacts that holds People', () => {
    const m = {
      id: 'm',
      pages: [],
      tables: [t('Contacts', 'people'), t('Notes', 'main')],
    } as unknown as Pick<ModuleSummary, 'id' | 'pages' | 'tables'>
    expect(moduleTabs(m, null).map((x) => x.label)).toEqual(['Notes', 'Setup'])
  })

  it('leave out a page drawn for a record', () => {
    const m = {
      id: 'm',
      pages: [
        { name: 'report', title: 'Report', front: false, record: 't_clients' },
        { name: 'funnel', title: 'Funnel', front: true, record: null },
      ],
      tables: [],
    } as unknown as Pick<ModuleSummary, 'id' | 'pages' | 'tables'>
    expect(moduleTabs(m, null).map((x) => x.label)).toEqual(['Funnel', 'Setup'])
  })
})
