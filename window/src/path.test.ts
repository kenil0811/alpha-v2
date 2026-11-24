// The bar's path: a module inside another keeps the outer module, so ‹ goes back to it.
import type { ModuleSummary } from '@alpha/core/api'
import { expect, it } from 'vitest'
import { trailOf } from './path.ts'
import { placeOf } from './place.ts'

const mod = (id: string, name: string, parent: string | null, tables: string[]) =>
  ({
    id,
    name,
    parent,
    people: false,
    pages: [],
    tables: tables.map((t) => ({ id: t, place: 'main', name: t })),
  }) as unknown as ModuleSummary

const modules = [mod('m1', 'Deals', null, []), mod('m2', 'Sourcing', 'm1', ['t1'])]
const here = (hash: string) => ({
  place: placeOf(hash),
  modules,
  rowPlace: null,
  table: null,
  itemName: '',
  moduleHereId: hash.startsWith('#/table/') ? 'm2' : null,
})

it('names the modules a table sits in, never its own', () => {
  expect(trailOf(here('#/table/t1'))).toEqual([
    { label: 'Home', href: '#/' },
    { label: 'Deals', href: '#/module/m1/overview' },
  ])
})

it('puts a page of Settings under Settings, and Home has none', () => {
  expect(trailOf(here('#/settings/connections')).map((c) => c.label)).toEqual(['Home'])
  expect(trailOf(here('#/'))).toEqual([])
})
