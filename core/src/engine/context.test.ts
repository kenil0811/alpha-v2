// Context by mode (Kenil, 24 Oct): the start layer names modules and tables with their counts;
// a table's fields and meanings come with its first touch, once per session, again after the
// start layer is resent; the heavy grammars are fetched with guide.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { World } from '../world/world.ts'
import { firstTouch, startLayer } from './context.ts'
import type { ToolEntry } from './registry.ts'
import type { Here } from './tools/common.ts'
import { worldTools } from './tools/index.ts'

let home: string
let world: World
const alpha = { actor: { kind: 'alpha' as const } }

beforeEach(async () => {
  home = mkdtempSync(join(tmpdir(), 'alpha-context-'))
  world = await World.open(join(home, 'tenants', 't_test'))
})

afterEach(() => {
  world.close()
  rmSync(home, { recursive: true, force: true })
})

function meals() {
  const m = world.shape.makeModule('Food', alpha)
  return world.shape.makeTable(
    m.id,
    'Meals',
    [
      { name: 'Food', kind: 'text', about: 'What was eaten.', aboutBy: 'alpha' },
      { name: 'Meal', kind: 'choice', choices: ['Breakfast', 'Dinner'] },
    ],
    alpha,
    { about: 'One meal the person ate.', aboutBy: 'alpha' },
  )
}

describe('the start layer', () => {
  it('names tables with their counts and what each is, never their fields', () => {
    meals()
    const text = startLayer(world, world.owner().id, '/desk', null)
    expect(text).toContain('- Meals (view meals), 0 rows: One meal the person ate.')
    expect(text).not.toContain('Food (text)')
    expect(text).toContain('come with your first query, write or change of it')
  })
})

describe('a module’s skills', () => {
  it('are listed under their module in the start layer, a line each from SKILL.md', () => {
    meals()
    const m = world.shape.module('Food')
    if (!m) throw new Error('no Food')
    for (const [dir, front] of [
      ['tally', 'name: tally\ndescription: Adds up the day’s meals by kind.'],
      ['broken', 'name: [not closed'],
    ] as const) {
      mkdirSync(join(m.dir, 'skills', dir), { recursive: true })
      writeFileSync(join(m.dir, 'skills', dir, 'SKILL.md'), `---\n${front}\n---\nMore words.\n`)
    }
    const layer = startLayer(world, 'u_1', home, null)
    expect(layer).toContain(
      'Skills (skills/<name>/SKILL.md says more):\n- tally: Adds up the day’s meals by kind.',
    )
    expect(layer).not.toContain('not closed')
  })
})

describe('a table on its first touch', () => {
  it('gives its fields with their meanings once, and names the ones with no sentence yet', () => {
    const t = meals()
    const here: Here = {
      current: { user: world.owner(), turn: null, said: null, message: null },
      fromSubagent: false,
      touched: new Set(),
    }
    const brief = firstTouch(world, here, [t])
    expect(brief).toContain('Meals (view meals), 0 rows: One meal the person ate.')
    expect(brief).toContain('- Food (text): What was eaten.')
    expect(brief).toContain('- Meal (choice: Breakfast, Dinner)')
    expect(brief).toContain('No sentence yet on what Meal means')
    expect(firstTouch(world, here, [t])).toBe('')
    here.touched.clear()
    expect(firstTouch(world, here, [t])).toContain('- Food (text)')
  })

  it('comes with the first query of the table through the query tool, then not again', async () => {
    const t = meals()
    world.records.add(
      t.id,
      [{ values: { Food: 'two eggs' }, provenance: { kind: 'estimated', basis: 'a test' } }],
      alpha,
    )
    const here: Here = {
      current: { user: world.owner(), turn: null, said: null, message: null },
      fromSubagent: false,
      touched: new Set(),
    }
    const tools = worldTools(world, here)
    const query = tools.find((x) => x.name === 'query') as ToolEntry
    const first = await query.handler({ sql: 'SELECT food FROM meals' })
    expect(first.content[0]).toMatchObject({ type: 'text' })
    expect((first.content[0] as { text: string }).text).toContain('- Food (text): What was eaten.')
    expect((first.content[1] as { text: string }).text).toContain('two eggs')
    const second = await query.handler({ sql: 'SELECT food FROM meals' })
    expect(second.content).toHaveLength(1)
    // the ten in hand, the rest found; guide hands out the grammars
    const inHand = tools.filter((x) => x.alwaysLoad).map((x) => x.name)
    expect(inHand.sort()).toEqual(
      [
        'ask',
        'change',
        'file',
        'guide',
        'query',
        'remember',
        'rule',
        'search',
        'shape',
        'task',
        'write',
      ].sort(),
    )
    expect(
      tools
        .filter((x) => !x.alwaysLoad)
        .map((x) => x.name)
        .sort(),
    ).toEqual(['build', 'connect', 'governance', 'keep', 'look', 'research', 'run'])
    const guide = tools.find((x) => x.name === 'guide') as ToolEntry
    const views = await guide.handler({ about: 'views' })
    expect((views.content[0] as { text: string }).text).toContain('view.kind: table, board')
  })
})
