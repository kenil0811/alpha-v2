// A text edited on a page, written back to the field it was drawn from.
import type { FieldView } from '@alpha/core/api'
import { expect, it } from 'vitest'
import { editedValue } from './PageView.tsx'

const f = (kind: string) => ({ name: 'F', slug: 'f', kind, choices: [] }) as unknown as FieldView

it('writes an edited figure, a whole text, a line of a list, or a figure in a line', () => {
  expect(editedValue(f('money'), { amount: 1, currency: 'USD' }, '$1', '$94.2K')).toEqual({
    value: { amount: 94200, currency: 'USD' },
  })
  expect(editedValue(f('text'), 'Phoenix', 'Phoenix', 'Phoenix Co.')).toEqual({
    value: 'Phoenix Co.',
  })
  expect(editedValue(f('text'), 'Revenue up:6%\nMargin held', 'Revenue up: 6%', 'Up 7%')).toEqual({
    value: 'Up 7%\nMargin held',
  })
  expect(editedValue(f('text'), 'Acme: 12000: 61-90', '$12,000', '$13,500')).toEqual({
    value: 'Acme: 13500: 61-90',
  })
})

it('refuses a word for a number, and a text no longer in the field', () => {
  expect('problem' in editedValue(f('number'), 3, '3', 'three')).toBe(true)
  expect('problem' in editedValue(f('text'), 'Other words', 'Gone', 'New')).toBe(true)
})
