import { describe, expect, it } from 'vitest'
import { folded, verbOf } from './Overview.tsx'

describe('a goal said as what to do', () => {
  it('reads its verb from its measure', () => {
    expect(verbOf('Listings reviewed', 'Reviewed')).toEqual({ verb: 'Review', thing: 'listings' })
    expect(verbOf('LOIs sent', 'LOI')).toEqual({ verb: 'Send', thing: 'LOIs' })
    expect(verbOf('Deals qualified', 'Qualified')).toEqual({ verb: 'Qualify', thing: 'deals' })
    expect(verbOf('Pipeline', 'Contacted')).toEqual({ verb: 'Move to', thing: 'contacted' })
  })

  it('says a line again only once, with how many times', () => {
    const lines = folded([
      { s: 'opt', words: 'Lead aging finished.' },
      { s: 'opt', words: 'Lead aging finished.' },
      { s: 'yes', words: 'Review 3 more listings' },
    ])
    expect(lines.map((l) => [l.words, l.n])).toEqual([
      ['Lead aging finished.', 2],
      ['Review 3 more listings', 1],
    ])
  })
})
