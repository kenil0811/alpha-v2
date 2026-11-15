// QuickBooks on made-up Intuit answers, shaped as Intuit's docs show them: never a real company.
// What is asked (GET only), how reports become rows, a test company found at the sandbox
// address, a report Intuit cuts short read in halves, and a row QuickBooks stops showing.
import { type Host, type Item, makeCall, Problem } from '@alpha/connector-sdk'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { goneKeys, quickbooks, readAll, span } from './index.ts'
import { HOSTS } from './intuit.ts'

const REALM = '9341455130166501'
const asked: { method: string; url: URL }[] = []
let answer: (url: URL) => { status?: number; json?: unknown }

beforeEach(() => {
  asked.length = 0
  vi.stubGlobal('fetch', async (input: string | URL, init?: RequestInit) => {
    const url = new URL(String(input))
    asked.push({ method: init?.method ?? 'GET', url })
    const a = answer(url)
    return new Response(JSON.stringify(a.json ?? {}), {
      status: a.status ?? 200,
      headers: { 'content-type': 'application/json' },
    })
  })
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

// each host its own account, so the calls of one test are not paced by another's
let hosts = 0
function host(place: string | null = REALM, cursor: string | null = null) {
  hosts++
  const landed = new Map<string, Item[]>()
  const goneSaid = new Map<string, string[]>()
  const kept = new Map<string, string[]>()
  const h: Host & {
    now: string | null
    landed: typeof landed
    goneSaid: typeof goneSaid
    kept: typeof kept
  } = {
    account: `Harbor CPA ${hosts}`,
    place,
    now: cursor,
    landed,
    goneSaid,
    kept,
    secret: async () => 'short-lived',
    cursor: () => h.now,
    setCursor: (c) => {
      h.now = c
    },
    land: (table, items) => {
      landed.set(table, items)
      const had = new Set(kept.get(table) ?? [])
      kept.set(table, [...new Set([...had, ...items.map((i) => i.key)])])
      return { added: items.filter((i) => !had.has(i.key)).length, changed: 0, same: 0 }
    },
    keys: (table) => kept.get(table) ?? [],
    gone: (table, keys) => {
      goneSaid.set(table, keys)
      return keys.length
    },
    journal: () => {},
  }
  return h
}
const call = (h: Host) =>
  makeCall(quickbooks.manifest, h, {
    judgements: { retries: 0, busyWaitMs: 60_000, fewerRowsRatio: 0.5, quietDays: 7 },
    sleep: async () => {},
  })

// A report as Intuit writes one: columns with their keys and months, and nested rows.
const col = (title: string, key: string, start?: string, end?: string) => ({
  ColTitle: title,
  ColType: key === 'account' ? 'Account' : 'Money',
  MetaData: [
    { Name: 'ColKey', Value: key },
    ...(start ? [{ Name: 'StartDate', Value: start }] : []),
    ...(end ? [{ Name: 'EndDate', Value: end }] : []),
  ],
})
const months = [
  col('', 'account'),
  col('Oct 2026', 'Oct 2026', '2026-10-01', '2026-10-31'),
  col('Nov 1-15, 2026', 'Nov 2026', '2026-11-01', '2026-11-15'),
  col('Total', 'total'),
]
const data = (...cells: [string, string?][]) => ({
  type: 'Data',
  ColData: cells.map(([value, id]) => ({ value, ...(id ? { id } : {}) })),
})
const section = (group: string, title: string, rows: unknown[], id?: string) => ({
  type: 'Section',
  group,
  Header: { ColData: [{ value: title, ...(id ? { id } : {}) }] },
  Rows: { Row: rows },
  Summary: { ColData: [{ value: `Total ${title}` }] },
})

let fees = '1,250.00' // the October fees, changed between two reads
let glLines = 2 // transaction lines under Checking in October
let cutOnce = false // Intuit cuts the first November ledger short

function books(url: URL): { status?: number; json?: unknown } {
  const path = url.pathname.replace(`/v3/company/${REALM}/`, '')
  if (path.startsWith('companyinfo/'))
    return {
      json: {
        CompanyInfo: {
          CompanyName: 'Harbor CPA LLC',
          LegalName: 'Harbor CPA LLC',
          FiscalYearStartMonth: 'January',
        },
      },
    }
  if (path === 'preferences')
    return {
      json: {
        Preferences: {
          ReportPrefs: { ReportBasis: 'Cash' },
          CurrencyPrefs: { HomeCurrency: { value: 'USD' } },
        },
      },
    }
  if (path === 'query')
    return {
      json: {
        QueryResponse: {
          Account: [
            {
              Id: '1',
              Name: 'Fees',
              AccountType: 'Income',
              AccountSubType: 'ServiceFeeIncome',
              Classification: 'Revenue',
              Active: true,
              CurrentBalance: 0,
            },
            {
              Id: '35',
              Name: 'Checking',
              AcctNum: '1000',
              AccountType: 'Bank',
              Classification: 'Asset',
              Active: true,
              CurrentBalance: 5400.5,
            },
            { Id: '7', Name: 'Rent', AccountType: 'Expense', Active: false },
          ],
        },
      },
    }
  if (path === 'reports/ProfitAndLoss')
    return {
      json: {
        Columns: { Column: months },
        Rows: {
          Row: [
            section('Income', 'Income', [data(['Fees', '1'], [fees], ['800.00'], ['2,050.00'])]),
            section('Expenses', 'Expenses', [data(['Rent', '7'], ['900.00'], [''], ['900.00'])]),
            {
              type: 'Section',
              group: 'NetIncome',
              Summary: { ColData: [{ value: 'Net Income' }] },
            },
          ],
        },
      },
    }
  if (path === 'reports/BalanceSheet')
    return {
      json: {
        Columns: { Column: months },
        Rows: {
          Row: [
            section('TotalAssets', 'ASSETS', [
              section('CurrentAssets', 'Current Assets', [
                data(['Checking', '35'], ['4,000.00'], ['5,400.50'], ['']),
              ]),
            ]),
            section('TotalLiabilitiesAndEquity', 'LIABILITIES AND EQUITY', [
              section('Liabilities', 'Liabilities', [
                data(['Credit card', '41'], ['(120.00)'], ['0.00'], ['']),
              ]),
            ]),
          ],
        },
      },
    }
  if (path === 'reports/CustomerSales')
    return {
      json: {
        Columns: { Column: months },
        Rows: { Row: [data(['Lakeside Dental', '58'], ['1,250.00'], ['800.00'], ['2,050.00'])] },
      },
    }
  if (path === 'reports/GeneralLedger') {
    const from = url.searchParams.get('start_date') ?? ''
    const to = url.searchParams.get('end_date') ?? ''
    if (from === '2026-11-01' && to === '2026-11-15' && !cutOnce) {
      cutOnce = true
      return {
        json: {
          Header: { Option: [{ Name: 'NoReportData', Value: 'false' }] },
          Rows: {
            Row: [
              {
                ColData: [{ value: 'Unable to display more data. Please reduce the date range.' }],
              },
            ],
          },
        },
      }
    }
    const gl = [
      col('Date', 'tx_date'),
      col('Transaction Type', 'txn_type'),
      col('Num', 'doc_num'),
      col('Name', 'name'),
      col('Memo/Description', 'memo'),
      col('Split', 'split_acc'),
      col('Amount', 'subt_nat_amount'),
    ]
    const lines =
      from === '2026-10-01'
        ? [
            data(['Beginning Balance'], [''], [''], [''], [''], [''], ['']),
            data(
              ['2026-10-03'],
              ['Deposit', '201'],
              ['D1'],
              ['Lakeside Dental'],
              ['October fees'],
              ['Fees'],
              ['1,250.00'],
            ),
            data(
              ['2026-10-20'],
              ['Expense', '202'],
              ['1043'],
              ['Landlord'],
              ['Rent'],
              ['Rent'],
              ['-900.00'],
            ),
          ].slice(0, glLines + 1)
        : from >= '2026-11-01'
          ? [
              data(
                [from],
                ['Deposit', `3${from.slice(8)}`],
                [''],
                ['Lakeside Dental'],
                [''],
                ['Fees'],
                ['400.00'],
              ),
            ]
          : []
    return {
      json: {
        Columns: { Column: gl },
        Rows: { Row: lines.length ? [section('', 'Checking', lines, '35')] : [] },
      },
    }
  }
  if (path === 'reports/AgedReceivables' || path === 'reports/AgedPayables') {
    const ages = [
      col('', 'account'),
      col('Current', 'current'),
      col('1 - 30', '0'),
      col('31 - 60', '1'),
      col('61 - 90', '2'),
      col('91 and over', '3'),
      col('Total', 'total'),
    ]
    const who = path.endsWith('Receivables')
      ? data(['Lakeside Dental', '58'], ['400.00'], ['250.00'], [''], [''], ['75.00'], ['725.00'])
      : data(['Landlord', '9'], ['900.00'], [''], [''], [''], [''], ['900.00'])
    return { json: { Columns: { Column: ages }, Rows: { Row: [who] } } }
  }
  return { status: 404, json: { Fault: { Error: [{ Message: 'Not found', Detail: path }] } } }
}

const NOW = new Date('2026-11-15T12:00:00Z')

beforeEach(() => {
  // a daily read reads up to today: today is the 15th of November 2026 here
  vi.useFakeTimers({ toFake: ['Date'], now: NOW })
  fees = '1,250.00'
  glLines = 2
  cutOnce = false
  answer = (url) => (url.origin === HOSTS.production ? books(url) : { status: 404 })
})

describe('reading a company’s books', () => {
  it('reads two full years before this month, a month of the ledger at a time', () => {
    const s = span(NOW)
    expect(s.start).toBe('2024-11-01')
    expect(s.end).toBe('2026-11-15')
    expect(s.months).toHaveLength(25)
    expect(s.months.at(-1)).toEqual(['2026-11-01', '2026-11-15'])
    expect(s.months[0]).toEqual(['2024-11-01', '2024-11-30'])
  })

  it('makes every table’s rows from the company, its accounts and its reports, on its own basis', async () => {
    const h = host()
    const { rows } = await readAll(call(h), 'production', NOW)
    expect(rows.Companies?.[0]).toEqual({
      key: REALM,
      values: expect.objectContaining({
        Name: 'Harbor CPA LLC',
        Basis: 'Cash',
        'Test company': 'no',
        'Last read': '2026-11-15',
      }),
    })
    expect(rows.Accounts?.map((a) => [a.values.Account, a.values.Active])).toEqual([
      ['Fees', 'yes'],
      ['Checking', 'yes'],
      ['Rent', 'no'],
    ])
    // an account in a month: empty and zero amounts are no row
    expect(
      rows['Monthly results']?.map((r) => [
        r.values.Account,
        r.values.Month,
        r.values.Group,
        r.values.Amount,
      ]),
    ).toEqual([
      ['Fees', '2026-10-01', 'Income', { amount: 1250, currency: 'USD' }],
      ['Fees', '2026-11-01', 'Income', { amount: 800, currency: 'USD' }],
      ['Rent', '2026-10-01', 'Expenses', { amount: 900, currency: 'USD' }],
    ])
    expect(
      rows['Month-end balances']?.map((r) => [
        r.values.Account,
        r.values['As of'],
        r.values.Group,
        r.values.Balance,
      ]),
    ).toEqual([
      ['Checking', '2026-10-31', 'Assets', { amount: 4000, currency: 'USD' }],
      ['Checking', '2026-11-15', 'Assets', { amount: 5400.5, currency: 'USD' }],
      ['Credit card', '2026-10-31', 'Liabilities', { amount: -120, currency: 'USD' }],
    ])
    expect(rows['Sales by customer']).toHaveLength(2)
    // the opening balance is no transaction; each line names its account and the other side
    const oct = rows.Transactions?.filter((t) => String(t.values.Date).startsWith('2026-10'))
    expect(
      oct?.map((t) => [t.values.Type, t.values.Account, t.values.Split, t.values.Amount]),
    ).toEqual([
      ['Deposit', 'Checking', 'Fees', { amount: 1250, currency: 'USD' }],
      ['Expense', 'Checking', 'Rent', { amount: -900, currency: 'USD' }],
    ])
    expect(rows.Receivables?.[0]?.values).toMatchObject({
      Customer: 'Lakeside Dental',
      Current: { amount: 400 },
      '1 to 30 days': { amount: 250 },
      '31 to 60 days': { amount: 0 },
      'Over 90 days': { amount: 75 },
      Total: { amount: 725 },
    })
    expect(rows.Payables?.[0]?.values).toMatchObject({ Vendor: 'Landlord', Total: { amount: 900 } })
    // the reports on the company's own basis, at minor version 75
    const pl = asked.find((a) => a.url.pathname.endsWith('/ProfitAndLoss'))?.url
    expect(pl?.searchParams.get('accounting_method')).toBe('Cash')
    expect(pl?.searchParams.get('summarize_column_by')).toBe('Month')
    expect(pl?.searchParams.get('minorversion')).toBe('75')
  })

  it('asks for nothing but reads: every call is a GET', async () => {
    await quickbooks.sync?.(call(host()))
    expect(asked.length).toBeGreaterThan(30)
    expect(new Set(asked.map((a) => a.method))).toEqual(new Set(['GET']))
    expect(quickbooks.tools).toEqual({})
  })

  it('reads a ledger Intuit cuts short in two halves', async () => {
    const { rows } = await readAll(call(host()), 'production', NOW)
    const nov = asked.filter(
      (a) =>
        a.url.pathname.endsWith('/GeneralLedger') &&
        (a.url.searchParams.get('start_date') ?? '') >= '2026-11-01',
    )
    expect(
      nov.map((a) => [a.url.searchParams.get('start_date'), a.url.searchParams.get('end_date')]),
    ).toEqual([
      ['2026-11-01', '2026-11-15'],
      ['2026-11-01', '2026-11-08'],
      ['2026-11-09', '2026-11-15'],
    ])
    expect(
      rows.Transactions?.filter((t) => String(t.values.Date).startsWith('2026-11')),
    ).toHaveLength(2)
  })

  it('finds a test company at the sandbox address, and keeps where it is', async () => {
    answer = (url) =>
      url.origin === HOSTS.sandbox
        ? books(url)
        : { status: 401, json: { Fault: { Error: [{ Message: 'AuthenticationFailed' }] } } }
    const h = host()
    await quickbooks.check?.(call(h))
    expect(JSON.parse(h.now ?? '{}')).toMatchObject({ where: 'sandbox' })
    const { rows } = await readAll(call(h), 'sandbox', NOW)
    expect(rows.Companies?.[0]?.values['Test company']).toBe('yes')
  })

  it('asks for a sign-in when neither address takes it, and waits when Intuit says too many', async () => {
    answer = () => ({
      status: 401,
      json: { Fault: { Error: [{ Message: 'AuthenticationFailed' }] } },
    })
    await expect(quickbooks.check?.(call(host()))).rejects.toMatchObject({ kind: 'sign_in' })
    await expect(quickbooks.check?.(call(host(null)))).rejects.toThrow(/pick the company/)
    answer = () => ({ status: 429, json: { Fault: { Error: [{ Message: 'ThrottleExceeded' }] } } })
    const busy = await quickbooks.check?.(call(host())).catch((e: unknown) => e)
    expect(busy).toBeInstanceOf(Problem)
    expect((busy as Problem).kind).toBe('busy')
  })

  it('lands a changed amount in place, and marks gone what QuickBooks no longer shows, within what it read', async () => {
    const h = host()
    await quickbooks.sync?.(call(h))
    const before = h.landed.get('Transactions')?.length ?? 0
    fees = '1,300.00'
    glLines = 1 // the October rent line is deleted in QuickBooks
    cutOnce = false // and November's ledger is cut short again, read in the same halves
    const again = await quickbooks.sync?.(call(h))
    expect(again?.sawNew).toBe(false)
    const fee = h.landed
      .get('Monthly results')
      ?.find((r) => r.values.Account === 'Fees' && r.values.Month === '2026-10-01')
    expect(fee?.values.Amount).toEqual({ amount: 1300, currency: 'USD' })
    expect(h.landed.get('Transactions')).toHaveLength(before - 1)
    expect(h.goneSaid.get('Transactions')).toEqual([
      expect.stringMatching(/^9341455130166501:2026-10:35:Expense:202:1$/),
    ])
  })

  it('leaves gone only the company’s own rows of the months it read', () => {
    const had = [
      `${REALM}:2024-10:35:x`,
      `${REALM}:2026-10:35:y`,
      `${REALM}:2026-10:35:z`,
      `1111:2026-10:35:y`,
    ]
    expect(goneKeys(REALM, had, new Set([`${REALM}:2026-10:35:y`]), ['2026-10'])).toEqual([
      `${REALM}:2026-10:35:z`,
    ])
    expect(goneKeys(REALM, [`${REALM}:7`, `${REALM}:1`], new Set([`${REALM}:1`]), null)).toEqual([
      `${REALM}:7`,
    ])
  })
})
