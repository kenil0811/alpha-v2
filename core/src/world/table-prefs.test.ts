// Each person's order of a table's lists and their view of it (ui-rules T1): kept table by table,
// and gone with what they name, so nothing kept points at a table, list or field that is not there.
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, expect, it } from 'vitest'
import {
  drawnTables,
  forgetModule,
  keptRecords,
  keptTabs,
  listOrders,
  setDrawn,
  setListOrder,
  setRecord,
  setTabs,
} from './table-prefs.ts'
import { World } from './world.ts'

let home: string
let world: World

beforeEach(async () => {
  home = mkdtempSync(join(tmpdir(), 'alpha-table-prefs-'))
  world = await World.open(join(home, 'tenants', 't_test'))
})
afterEach(() => {
  world.close()
  rmSync(home, { recursive: true, force: true })
})

it('forgets a list, a field and a table in everyone’s order and view when each goes', () => {
  const ann = world.owner('Ann').id
  const ctx = { actor: { kind: 'person' as const, id: ann }, user: ann }
  const m = world.shape.makeModule('Shop', ctx)
  const t = world.shape.makeTable(
    m.id,
    'Orders',
    [
      { name: 'Name', kind: 'text' },
      { name: 'Day', kind: 'date' },
      { name: 'Stage', kind: 'choice', choices: ['New', 'Done'] },
    ],
    ctx,
  )
  const day = t.fields.find((f) => f.name === 'Day')?.id as string
  const stage = t.fields.find((f) => f.name === 'Stage')?.id as string
  const soon = world.views.save({ table: t.id, name: 'Soon', config: {} }, ctx)
  const late = world.views.save({ table: t.id, name: 'Late', config: {} }, ctx)
  setListOrder(world.db, ann, t.id, [late.id, 'all', soon.id])
  setDrawn(world.db, ann, t.id, {
    kind: 'board',
    by: day,
    until: null,
    group: stage,
    measure: null,
  })
  world.views.remove(late.id, ctx)
  expect(listOrders(world.db, ann)[t.id]).toEqual(['all', soon.id])
  world.shape.removeField(t.id, 'Stage', ctx)
  expect(drawnTables(world.db, ann)[t.id]).toEqual({
    kind: 'board',
    by: day,
    until: null,
    group: null,
    measure: null,
  })
  world.shape.removeTable(t.id, ctx)
  expect(listOrders(world.db, ann)).toEqual({})
  expect(drawnTables(world.db, ann)).toEqual({})
})

it('keeps a person’s tabs one module at a time, and forgets a table in everyone’s tabs when it goes', () => {
  const ann = world.owner('Ann').id
  const ctx = { actor: { kind: 'person' as const, id: ann }, user: ann }
  const bo = world.accounts.add('Bo', 'bo@example.com', ctx).id
  const shop = world.shape.makeModule('Shop', ctx)
  const desk = world.shape.makeModule('Desk', ctx)
  const t = (m: string, name: string) =>
    world.shape.makeTable(m, name, [{ name: 'Name', kind: 'text' }], ctx).id
  const [orders, bags, calls] = [t(shop.id, 'Orders'), t(shop.id, 'Bags'), t(desk.id, 'Calls')]
  setTabs(world.db, ann, shop.id, { order: [bags, orders], hidden: [orders], pinned: [] })
  setTabs(world.db, ann, desk.id, { order: [], hidden: [], pinned: [calls] })
  setTabs(world.db, bo, shop.id, { order: [orders, bags], hidden: [], pinned: [] })
  // one module set leaves the other as it was
  setTabs(world.db, ann, desk.id, { order: [calls], hidden: [], pinned: [calls] })
  expect(keptTabs(world.db, ann)).toEqual({
    [shop.id]: { order: [bags, orders], hidden: [orders], pinned: [] },
    [desk.id]: { order: [calls], hidden: [], pinned: [calls] },
  })
  // nothing kept is no preference at all
  setTabs(world.db, ann, desk.id, { order: [], hidden: [], pinned: [] })
  expect(Object.keys(keptTabs(world.db, ann))).toEqual([shop.id])
  // a table gone leaves everyone's tabs
  world.shape.removeTable(orders, ctx)
  expect(keptTabs(world.db, ann)[shop.id]).toEqual({ order: [bags], hidden: [], pinned: [] })
  expect(keptTabs(world.db, bo)[shop.id]).toEqual({ order: [bags], hidden: [], pinned: [] })
})

it('forgets a module’s tabs for everyone when the module goes', () => {
  const ann = world.owner('Ann').id
  setTabs(world.db, ann, 'm_gone', { order: ['t_x'], hidden: [], pinned: [] })
  setTabs(world.db, ann, 'm_here', { order: ['t_y'], hidden: [], pinned: [] })
  forgetModule(world.db, 'm_gone')
  expect(Object.keys(keptTabs(world.db, ann))).toEqual(['m_here'])
})

it('keeps a record page’s hidden properties and tabs one table at a time, and forgets what goes', () => {
  const ann = world.owner('Ann').id
  const ctx = { actor: { kind: 'person' as const, id: ann }, user: ann }
  const m = world.shape.makeModule('Shop', ctx)
  const orders = world.shape.makeTable(
    m.id,
    'Orders',
    [
      { name: 'Name', kind: 'text' },
      { name: 'Day', kind: 'date' },
    ],
    ctx,
  )
  const lines = world.shape.makeTable(m.id, 'Lines', [{ name: 'Name', kind: 'text' }], ctx)
  const day = orders.fields.find((f) => f.name === 'Day')?.id as string
  setRecord(world.db, ann, orders.id, { hidden: [day], tabs: [`part:${lines.id}`, 'files'] })
  setRecord(world.db, ann, lines.id, { hidden: [], tabs: ['tasks'] })
  setRecord(world.db, ann, 'person', { hidden: [], tabs: ['related'] })
  // where each block shows (0 nowhere, 1 Summary, 2 a tab, 3 both) is kept with the order
  setRecord(world.db, ann, 'company', { hidden: [], tabs: [], places: { knows: 3, events: 0 } })
  expect(keptRecords(world.db, ann).company?.places).toEqual({ knows: 3, events: 0 })
  setRecord(world.db, ann, 'company', { hidden: [], tabs: [], places: {} })
  expect(keptRecords(world.db, ann).company).toBeUndefined()
  setRecord(world.db, ann, orders.id, {
    hidden: [day],
    tabs: [`part:${lines.id}`, 'files'],
    places: { [`part:${lines.id}`]: 2, files: 1 },
  })
  // one table set leaves the others as they were
  setRecord(world.db, ann, lines.id, { hidden: [], tabs: ['tasks', 'files'] })
  expect(keptRecords(world.db, ann)).toEqual({
    [orders.id]: {
      hidden: [day],
      tabs: [`part:${lines.id}`, 'files'],
      places: { [`part:${lines.id}`]: 2, files: 1 },
    },
    [lines.id]: { hidden: [], tabs: ['tasks', 'files'] },
    person: { hidden: [], tabs: ['related'] },
  })
  // a field gone leaves its table's hidden properties; a table gone takes its own and leaves the
  // tabs that named it
  world.shape.removeField(orders.id, 'Day', ctx)
  expect(keptRecords(world.db, ann)[orders.id]?.hidden).toEqual([])
  world.shape.removeTable(lines.id, ctx)
  expect(keptRecords(world.db, ann)).toEqual({
    [orders.id]: { hidden: [], tabs: ['files'], places: { files: 1 } },
    person: { hidden: [], tabs: ['related'] },
  })
})
