// Each person's order of a table's lists and their view of it (ui-rules T1): kept table by table,
// and gone with what they name, so nothing kept points at a table, list or field that is not there.
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, expect, it } from 'vitest'
import { drawnTables, listOrders, setDrawn, setListOrder } from './table-prefs.ts'
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
