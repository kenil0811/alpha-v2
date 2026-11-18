// The never-use list's matcher and the host that applies it (rules N1).
import { describe, expect, it } from 'vitest'
import type { Host, Item } from './connector.ts'
import { itemOnList, onList, withNever } from './never.ts'

const list = { words: ['loan', 'bank statement', 'divorce'], stems: ['bank'] }

describe('the never-use list', () => {
  it('matches whole words, phrases in a row, and stems inside a word', () => {
    expect(onList('About your loan', list)).toBe(true)
    expect(onList('The van was loaned to Lee', list)).toBe(false)
    expect(onList('Your bank statement is ready', list)).toBe(true)
    expect(onList('Statement from the bank', list)).toBe(true) // the stem, on its own
    expect(onList('alerts@bankofamerica.example', list)).toBe(true)
    expect(onList('Quote for the kitchen at 14 Elm St', list)).toBe(false)
    expect(onList('DIVORCE papers', list)).toBe(true)
    expect(onList('', list)).toBe(false)
  })

  it('reads every text an item holds', () => {
    const item = (values: Record<string, unknown>): Item => ({ key: 'k', values })
    expect(itemOnList(item({ Subject: 'Hello', From: 'Lakeview Bank <a@x.example>' }), list)).toBe(
      true,
    )
    expect(itemOnList(item({ Attendees: ['Ravi', 'Divorce lawyer'] }), list)).toBe(true)
    expect(itemOnList(item({ Subject: 'Order confirmation', Rows: 3 }), list)).toBe(false)
  })

  it('leaves out what matches before it lands or is kept, and says how many', async () => {
    const landed: Item[] = []
    const kept: string[] = []
    const left: [string, number][] = []
    const host = {
      account: 'a',
      place: 'Somewhere',
      secret: async () => null,
      cursor: () => null,
      setCursor: () => undefined,
      land: (_t: string, items: Item[]) => {
        landed.push(...items)
        return { added: items.length, changed: 0, same: 0 }
      },
      keepFile: (name: string) => {
        kept.push(name)
        return { isNew: true }
      },
      journal: () => undefined,
      leftOut: (table: string, n: number) => left.push([table, n]),
    } satisfies Host
    const h = withNever(host, list)
    expect(h.place).toBe('Somewhere')
    await h.land('Mail', [
      { key: '1', values: { Subject: 'Your loan offer' } },
      { key: '2', values: { Subject: 'Quote for 14 Elm St' } },
    ])
    await h.keepFile?.('Bank statement March.pdf', new Uint8Array(), 'application/pdf')
    await h.keepFile?.('Quote 14 Elm St.pdf', new Uint8Array(), 'application/pdf')
    expect(landed.map((i) => i.key)).toEqual(['2'])
    expect(kept).toEqual(['Quote 14 Elm St.pdf'])
    expect(left).toEqual([
      ['Mail', 1],
      ['files', 1],
    ])
    // an empty list is the host as it was
    expect(withNever(host, { words: [], stems: [] })).toBe(host)
  })
})
