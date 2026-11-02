// What is counted of this computer and what never is (onboarding step 3): every filter, on rows the
// test makes; never a real computer's.
import type { FileSeen } from '@alpha/connector-sdk'
import { describe, expect, it } from 'vitest'
import {
  countApps,
  countFiles,
  countSites,
  filterDownloads,
  filterSpans,
  filterVisits,
  never,
  scrubTitle,
  siteOf,
} from './filters.ts'

describe('a site', () => {
  it('is an address without www., path, query or fragment; local and browser pages are none', () => {
    expect(siteOf('https://www.BizBuySell.com/listing/1?ref=x#top')).toBe('bizbuysell.com')
    expect(siteOf('http://docs.example.org/d/1')).toBe('docs.example.org')
    for (const local of [
      'http://localhost:4700/',
      'http://192.168.1.4/admin',
      'file:///Users/me/a.pdf',
      'chrome://settings',
      'about:blank',
      'http://printer.local/',
      'not an address',
    ])
      expect(siteOf(local)).toBeNull()
  })
})

describe('the never-use list', () => {
  it('holds health, money, dating, adult, gambling, religion and politics, and the person’s own', () => {
    for (const site of [
      'chase.com',
      'bankofamerica.com',
      'tinder.com',
      'casino.example',
      'mychart.healthsystem.org',
    ])
      expect(never(site)).toBe(true)
    // a short word is a whole part of a name, never inside one
    expect(never('alphabet.com')).toBe(false)
    expect(never('bet.example')).toBe(true)
    expect(never('example.com')).toBe(false)
    expect(never('example.com', ['example.com'])).toBe(true)
    expect(never('Deals/Private', ['private'])).toBe(true)
    expect(never('purchase.example')).toBe(false)
  })
})

describe('a title', () => {
  it('loses addresses, phone numbers and long runs of digits', () => {
    expect(scrubTitle('Re: offer from priya@harbor.example (+1 415 555 0134)')).toBe(
      'Re: offer from ()',
    )
    expect(scrubTitle('Order 123456789 shipped')).toBe('Order shipped')
    expect(scrubTitle('Q3 P&L review')).toBe('Q3 P&L review')
    expect(scrubTitle('12345678')).toBe('')
  })
})

describe('counting sites', () => {
  const at = (day: number, hour = 12) => new Date(2026, 9, day, hour).toISOString()
  it('counts visits, days and the last visit, keeps three titles, and drops one-day sites', () => {
    const sites = countSites([
      { url: 'https://www.bizbuysell.com/a', title: 'Car wash for sale', at: at(20) },
      { url: 'https://bizbuysell.com/b', title: 'Car wash for sale', at: at(21) },
      { url: 'https://bizbuysell.com/c', title: 'Laundromat', at: at(22) },
      { url: 'https://bizbuysell.com/d', title: 'Bakery', at: at(22, 15) },
      { url: 'https://bizbuysell.com/e', title: 'Gym', at: at(22, 16) },
      { url: 'https://once.example/', title: 'Seen once', at: at(20) },
      { url: 'https://mail.google.com/mail/u/0', title: 'Re: the LOI - priya', at: at(20) },
      { url: 'https://mail.google.com/mail/u/0', title: 'Inbox (3)', at: at(21) },
      { url: 'https://chase.com/', title: 'Accounts', at: at(20) },
      { url: 'https://chase.com/', title: 'Accounts', at: at(21) },
    ])
    expect(sites.map((s) => [s.site, s.visits, s.days])).toEqual([
      ['bizbuysell.com', 5, 3],
      ['mail.google.com', 2, 2],
    ])
    expect(sites[0]?.titles).toEqual(['Car wash for sale', 'Laundromat', 'Bakery'])
    expect(sites[0]?.last).toBe(at(22, 16))
    // a webmail title is a subject line: counted, never its titles
    expect(sites[1]?.titles).toEqual([])
  })
})

describe('counting apps', () => {
  it('gives hours a week where the time is known, the most used first, and leaves money apps out; one used outside the app folders counts too', () => {
    const apps = countApps(
      [
        {
          id: 'com.microsoft.Excel',
          name: 'Microsoft Excel',
          launches: 40,
          lastUsed: '2026-10-31T09:00:00Z',
        },
        { id: 'us.zoom.xos', name: 'zoom.us', launches: 12 },
        { id: 'com.example.notes', name: 'Notes' },
        { id: 'com.chase.app', name: 'Chase' },
      ],
      [
        { id: 'us.zoom.xos', day: '2026-10-30', seconds: 7 * 3600 },
        { id: 'com.apple.finder', day: '2026-10-30', seconds: 3600, name: 'Finder' },
        { id: 'com.example.helper', day: '2026-10-30', seconds: 360 },
        { id: 'com.microsoft.Excel', day: '2026-10-30', seconds: 3600 },
        { id: 'com.microsoft.Excel', day: '2026-10-31', seconds: 2 * 3600 },
      ],
      7,
    )
    // an app used outside the app folders: by the name the computer gives it, else its id
    expect(apps.map((a) => [a.name, a.hoursWeek ?? null, a.launches ?? null])).toEqual([
      ['zoom.us', 7, 12],
      ['Microsoft Excel', 3, 40],
      ['Finder', 1, null],
      ['com.example.helper', 0.1, null],
      ['Notes', null, null],
    ])
  })
})

describe('counting file names', () => {
  const f = (
    folder: FileSeen['folder'],
    path: string,
    kind: string,
    modified: string,
  ): FileSeen => ({
    folder,
    path,
    kind,
    modified,
  })
  it('makes a tree two levels deep by kind, counts a project as one, and keeps the newest names', () => {
    const files = countFiles(
      [
        f('documents', 'Deals', 'folder', '2026-10-01T00:00:00Z'),
        f('documents', 'Deals/Harbor/LOI draft.docx', 'docx', '2026-10-30T00:00:00Z'),
        f('documents', 'Deals/Harbor/CIM.pdf', 'pdf', '2026-10-29T00:00:00Z'),
        f('documents', 'Deals/Harbor/Model/Q3 P&L.xlsx', 'xlsx', '2026-10-31T00:00:00Z'),
        f('documents', 'notes.txt', 'txt', '2026-09-01T00:00:00Z'),
        f('desktop', 'alpha', 'project', '2026-10-31T12:00:00Z'),
        f('downloads', 'Medical/scan.pdf', 'pdf', '2026-10-31T13:00:00Z'),
      ],
      [],
      3,
    )
    expect(files.tree).toEqual([
      { folder: 'documents', path: 'Deals/Harbor', files: 3, kinds: { docx: 1, pdf: 1, xlsx: 1 } },
      { folder: 'documents', path: '', files: 1, kinds: { txt: 1 } },
      { folder: 'desktop', path: 'alpha', files: 1, kinds: { project: 1 } },
    ])
    // the newest names, never a folder or a project, and nothing under a folder on the list
    expect(files.recent.map((r) => r.path)).toEqual([
      'Deals/Harbor/Model/Q3 P&L.xlsx',
      'Deals/Harbor/LOI draft.docx',
      'Deals/Harbor/CIM.pdf',
    ])
  })
})

describe('what leaves for a closer look (onboarding B)', () => {
  it('is each visit’s site and scrubbed title in time order, never the address', () => {
    const seen = filterVisits(
      [
        { url: 'https://chase.com/statements', title: 'Statement', at: '2026-10-01T09:00:00Z' },
        {
          url: 'https://www.bizbuysell.com/listing/2?ref=mail',
          title: 'Car wash for sale, call +1 415 555 0101',
          at: '2026-10-01T10:00:00Z',
        },
        { url: 'https://mail.google.com/mail/u/0', title: 'Re: LOI', at: '2026-10-01T09:30:00Z' },
        { url: 'http://localhost:4700/', title: 'Alpha', at: '2026-10-01T08:00:00Z' },
      ],
      [],
    )
    expect(seen).toEqual([
      { at: '2026-10-01T09:30:00Z', site: 'mail.google.com', title: '' },
      { at: '2026-10-01T10:00:00Z', site: 'bizbuysell.com', title: 'Car wash for sale, call' },
    ])
    expect(JSON.stringify(seen)).not.toMatch(/listing|ref=|LOI|555/)
  })

  it('is each time an app was in front, by its name, the never-use list left out', () => {
    expect(
      filterSpans(
        [
          { id: 'com.tinder', start: '2026-10-01T10:00:00Z', end: '2026-10-01T10:05:00Z' },
          { id: 'com.excel', start: '2026-10-01T09:00:00Z', end: '2026-10-01T09:40:00Z' },
          { id: 'x.y', name: 'Notes', start: '2026-10-01T09:41:00Z', end: '2026-10-01T09:42:00Z' },
        ],
        [{ id: 'com.excel', name: 'Microsoft Excel' }],
      ),
    ).toEqual([
      { app: 'Microsoft Excel', start: '2026-10-01T09:00:00Z', end: '2026-10-01T09:40:00Z' },
      { app: 'Notes', start: '2026-10-01T09:41:00Z', end: '2026-10-01T09:42:00Z' },
    ])
  })

  it('is where each download came from, by site; one from a site on the list is not here', () => {
    expect(
      filterDownloads(
        [
          {
            path: 'CIM Car Wash.pdf',
            from: ['https://cdn.example.com/f/9?sig=abc', 'https://www.bizbuysell.com/listing/2'],
            at: '2026-10-02T10:00:00Z',
          },
          { path: 'Statement.pdf', from: ['https://chase.com/s/1'], at: '2026-10-03T10:00:00Z' },
          { path: 'Private/plan.pdf', from: [], at: '2026-10-04T10:00:00Z' },
        ],
        ['private'],
      ),
    ).toEqual([
      {
        name: 'CIM Car Wash.pdf',
        sites: ['cdn.example.com', 'bizbuysell.com'],
        at: '2026-10-02T10:00:00Z',
      },
    ])
  })
})
