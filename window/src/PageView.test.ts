// A value a page drew, double-clicked: the window edits the field's whole value in place, opens a
// value of several lines beside the page, and says why one that is worked out can't be typed.
import type { FieldView, TableView } from '@alpha/core/api'
import { describe, expect, it } from 'vitest'
import { editOf } from './PageView.tsx'

const field = (name: string, kind: string, more: Partial<FieldView> = {}) =>
  ({
    id: name,
    name,
    slug: name.toLowerCase(),
    kind,
    choices: [],
    tones: {},
    default: null,
    many: false,
    relatesTo: null,
    summary: null,
    about: null,
    aboutBy: null,
    ...more,
  }) as FieldView

const table = {
  fields: [
    field('Client', 'text'),
    field('Fee', 'money'),
    field('Notes', 'text'),
    field('Paid', 'number', { summary: 'the sum of its payments' }),
  ],
  rows: [
    {
      id: 'r1',
      values: {
        client: 'Harbor Supply',
        fee: { amount: 1200, currency: 'USD' },
        notes: 'Call on Monday\nSend the deck',
        paid: 800,
      },
      sources: {},
    },
  ],
} as unknown as TableView

describe('a value edited where a page drew it', () => {
  it('edits the whole value of the field the page named, by its name or its slug', () => {
    const at = editOf(table, { table: 'Jobs', row: 'r1', field: 'Fee' })
    expect(at?.at).toBe('here')
    if (at?.at === 'here') expect(at.row.values[at.field.slug]).toEqual(table.rows[0]?.values.fee)
    expect(editOf(table, { table: 'Jobs', row: 'r1', field: 'client' })?.at).toBe('here')
  })
  it('opens a value of several lines beside the page, never one line of it', () => {
    expect(editOf(table, { table: 'Jobs', row: 'r1', field: 'Notes' })?.at).toBe('beside')
  })
  it('says why a worked-out value is not typed', () => {
    const at = editOf(table, { table: 'Jobs', row: 'r1', field: 'Paid' })
    expect(at).toEqual({
      at: 'fixed',
      why: 'Worked out: the sum of its payments. It changes when those rows do.',
    })
  })
  it('asks nothing of a row or field that is not there', () => {
    expect(editOf(table, { table: 'Jobs', row: 'r9', field: 'Fee' })).toBeNull()
    expect(editOf(table, { table: 'Jobs', row: 'r1', field: 'Gone' })).toBeNull()
  })
})
