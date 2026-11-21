// A module's tabs: People's own Address book is its storage, never a tab (place 'people').
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
})

describe('a module’s tabs', () => {
  it('leave out the Address book that holds People', () => {
    const m = {
      id: 'm',
      pages: [],
      tables: [t('Address book', 'people'), t('Notes', 'main')],
    } as unknown as Pick<ModuleSummary, 'id' | 'pages' | 'tables'>
    expect(moduleTabs(m, null).map((x) => x.label)).toEqual(['Notes', 'Setup'])
  })
})
