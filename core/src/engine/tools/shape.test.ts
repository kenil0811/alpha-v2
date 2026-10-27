// The shape tool's wall on meaning (Kenil, 24 Oct): no table or field without its sentence, and
// describe for the ones there are.
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { z } from 'zod'
import { World } from '../../world/world.ts'
import { Field } from './common.ts'
import { applyShape } from './shape.ts'

let home: string
let world: World
const alpha = { actor: { kind: 'alpha' as const }, user: 'u_1' }
const person = { actor: { kind: 'person' as const, id: 'u_1' }, user: 'u_1' }

beforeEach(async () => {
  home = mkdtempSync(join(tmpdir(), 'alpha-shape-tool-'))
  world = await World.open(join(home, 'tenants', 't_test'))
})

afterEach(() => {
  world.close()
  rmSync(home, { recursive: true, force: true })
})

describe('the shape tool and meaning', () => {
  it('refuses a field without its about in the schema, and a table without one in the call', () => {
    expect(z.object(Field.shape).safeParse({ name: 'Food', kind: 'text' }).success).toBe(false)
    expect(() =>
      applyShape(
        world,
        {
          action: 'make_table',
          module: 'Food',
          table: 'Meals',
          fields: [{ name: 'Food', kind: 'text', about: 'What was eaten.' }],
        },
        alpha,
      ),
    ).toThrow(/needs about/)
  })

  it('lands the model’s sentences as assumed, and describe changes them until the person writes theirs', () => {
    applyShape(
      world,
      {
        action: 'make_table',
        module: 'Food',
        table: 'Meals',
        about: 'One meal the person ate.',
        fields: [
          { name: 'Food', kind: 'text', about: 'What was eaten.' },
          {
            name: 'Meal',
            kind: 'choice',
            about: 'Which meal of the day.',
            choices: ['Breakfast', 'Lunch', 'Dinner'],
            tones: { Dinner: 'accent' },
          },
        ],
      },
      alpha,
    )
    const t = world.shape.table('Meals')
    expect([t?.about, t?.aboutBy]).toEqual(['One meal the person ate.', 'alpha'])
    // a main table gets its Notes from the builder (core step 3b)
    expect(t?.fields.map((f) => [f.about, f.aboutBy])).toEqual([
      ['What was eaten.', 'alpha'],
      ['Which meal of the day.', 'alpha'],
      ['Free notes on this row, with people and rows mentioned in them.', 'alpha'],
    ])
    expect(t?.fields[1]?.tones).toEqual({ Dinner: 'accent' })
    expect(
      applyShape(
        world,
        { action: 'describe', table: 'Meals', field: 'Food', about: 'The dish, in a few words.' },
        alpha,
      ),
    ).toBe('Food in Meals: The dish, in a few words.')
    // the person's own sentence, then Alpha's try is turned away in words
    applyShape(
      world,
      { action: 'describe', table: 'Meals', field: 'Food', about: 'What I ate, as I say it.' },
      person,
    )
    expect(
      applyShape(
        world,
        { action: 'describe', table: 'Meals', field: 'Food', about: 'Alpha again.' },
        alpha,
      ),
    ).toMatch(/theirs stands/)
    expect(world.shape.table('Meals')?.fields[0]?.about).toBe('What I ate, as I say it.')
    // a view's question
    applyShape(
      world,
      {
        action: 'save_view',
        table: 'Meals',
        field: 'Dinners',
        view: { filters: { match: 'all', rules: [{ field: 'Meal', op: 'is', value: 'Dinner' }] } },
      },
      alpha,
    )
    applyShape(
      world,
      {
        action: 'describe',
        table: 'Meals',
        field: 'Dinners',
        what: 'view',
        about: 'The dinners alone.',
      },
      alpha,
    )
    expect(world.views.list(t?.id as string)[0]?.about).toBe('The dinners alone.')
  })
})
