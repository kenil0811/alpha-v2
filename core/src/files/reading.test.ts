// Reading a document into values, with a stand-in for the model: the wall decides what stands.
import { describe, expect, it } from 'vitest'
import { type Ask, holds, inReadingOrder, type Piece, readInto } from './reading.ts'

const sheet: Piece[] = [
  { position: { sheet: 'Profile', cell: 'A4' }, words: 'Year Established: 2015' },
  { position: { sheet: 'Profile', cell: 'B5' }, words: 'Retirement' },
  { position: { sheet: 'Condensed P&L', cell: 'E5' }, words: '1673541' },
  { position: { sheet: 'Census', cell: 'B3' }, words: 'Full' },
  { position: { sheet: 'Census', cell: 'C3' }, words: 'Manager' },
  { position: { sheet: 'Census', cell: 'D3' }, words: '12' },
  { position: { sheet: 'Mix', cell: 'C9' }, words: '0.88' },
]

describe('the wall', () => {
  it('finds a number as written, in thousands or millions, or a percent as a fraction', () => {
    const money = { kind: 'money' as const }
    expect(holds(money, 1673541, [{ position: {}, words: 'Gross Revenue $1,673,541' }])).toBeNull()
    expect(holds(money, 1200000, [{ position: {}, words: 'Asking $1.2M' }])).toBeNull()
    expect(holds(money, 550000, [{ position: {}, words: '550k after 2 years' }])).toBeNull()
    expect(holds(money, -12000, [{ position: {}, words: 'Net (12,000)' }])).toBeNull()
    expect(holds({ kind: 'percent' }, 88, [{ position: {}, words: '0.88' }])).toBeNull()
    expect(holds(money, 1700000, [{ position: {}, words: 'Gross Revenue $1,673,541' }])).toMatch(
      /not in the pieces it cites/,
    )
  })

  it('finds every word of a text, the year of a date, and lets a choice rest on its pieces', () => {
    expect(holds({ kind: 'text' }, 'Retirement', [sheet[1] as Piece])).toBeNull()
    expect(holds({ kind: 'text' }, 'Health reasons', [sheet[1] as Piece])).toMatch(
      /health, reasons not in/,
    )
    expect(holds({ kind: 'date' }, '2015', [sheet[0] as Piece])).toBeNull()
    expect(holds({ kind: 'date' }, '2016', [sheet[0] as Piece])).toMatch(/year/)
    const lease = [{ position: {}, words: 'Expiration Date: 4.30.26 with 3 year option' }]
    expect(holds({ kind: 'date' }, '2026-04-30', lease)).toBeNull()
    expect(holds({ kind: 'date' }, '2027-04', [{ position: {}, words: "ends Apr '27" }])).toBeNull()
    expect(holds({ kind: 'date' }, '2025-04-30', lease)).toMatch(/year/)
    const time = { kind: 'choice' as const, choices: ['Full', 'Part', 'Seasonal'] }
    expect(holds(time, 'Full', [sheet[3] as Piece])).toBeNull()
    expect(holds(time, 'Full', [])).toMatch(/cites no piece/)
  })
})

describe('reading a document into values', () => {
  it('keeps what the pieces hold, with the first piece’s place, and leaves out the rest', async () => {
    let asked = ''
    const ask: Ask = async (prompt) => {
      asked = prompt
      return {
        tokens: 1200,
        answer: {
          values: {
            'Year established': { value: '2015', pieces: [0] },
            'Reason for selling': { value: 'Retirement', pieces: [1] },
            Revenue: { value: 1673541, pieces: [2] },
            Rent: { value: 4000, pieces: [2] }, // not there: left out
            'Bookkeeping share': { value: 88, pieces: [6] },
            Software: null,
          },
          lists: {
            Staff: [
              {
                Role: { value: 'Manager', pieces: [4] },
                Time: { value: 'Full', pieces: [3] },
                'Years there': { value: 12, pieces: [5] },
              },
              { Role: { value: null, pieces: [] }, Time: null, 'Years there': null },
            ],
          },
        },
      }
    }
    const out = await readInto(
      {
        about: 'A practice profile.',
        values: {
          'Year established': { kind: 'date' },
          'Reason for selling': { kind: 'text' },
          Revenue: { kind: 'money', about: 'the latest actual year' },
          Rent: { kind: 'money' },
          'Bookkeeping share': { kind: 'percent' },
          Software: { kind: 'text' },
        },
        lists: {
          Staff: {
            about: 'person on staff',
            fields: {
              Role: { kind: 'text' },
              Time: { kind: 'choice', choices: ['Full', 'Part', 'Seasonal'] },
              'Years there': { kind: 'number' },
            },
          },
        },
      },
      sheet,
      ask,
    )
    expect(asked).toContain('[2] (Condensed P&L!E5) 1673541')
    expect(asked).toContain('- Time: choice (one of Full, Part, Seasonal)')
    expect(out.values.Revenue).toEqual({
      value: 1673541,
      place: { sheet: 'Condensed P&L', cell: 'E5' },
    })
    expect(out.values.Rent).toBeNull()
    expect(out.values.Software).toBeNull()
    expect(out.values['Bookkeeping share']?.value).toBe(88)
    expect(out.lists.Staff).toHaveLength(1)
    expect(out.lists.Staff?.[0]?.['Years there']?.place).toEqual({ sheet: 'Census', cell: 'D3' })
    expect(out.dropped).toEqual(['Rent: 4000 is not in the pieces it cites'])
    expect(out.tokens).toBe(1200)
  })

  it('puts a PDF’s pieces in reading order: by page, then down the page', () => {
    const order = inReadingOrder([
      { position: { page: 2, box: [0, 700, 10, 690] }, words: 'two-top' },
      { position: { page: 1, box: [0, 100, 10, 90] }, words: 'one-low' },
      { position: { page: 1, box: [0, 700, 10, 690] }, words: 'one-top' },
    ]).map((p) => p.words)
    expect(order).toEqual(['one-top', 'one-low', 'two-top'])
  })
})
