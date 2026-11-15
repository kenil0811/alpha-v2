// QuickBooks on made-up Intuit answers, shaped as Intuit's docs show them: never a real company.
// Its reads: what is asked (GET only), how a report becomes rows, a test company found at the
// sandbox address, a report Intuit cuts short read in halves, and a list read by one select only.
import { type Host, type Item, makeCall, Problem } from '@alpha/connector-sdk'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { type CompanyRead, quickbooks, type ReportRead } from './index.ts'
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

const run = async <T>(tool: string, input: Record<string, unknown> = {}, h = host()): Promise<T> =>
  (await quickbooks.tools[tool]?.run(call(h), input as never)) as T

describe('reading a company’s books', () => {
  it('keeps nothing of its own: no tables, no daily read, reads only', () => {
    expect(quickbooks.tables).toEqual([])
    expect(quickbooks.sync).toBeUndefined()
    expect(Object.keys(quickbooks.tools)).toEqual(['company', 'accounts', 'report', 'list'])
    for (const t of Object.values(quickbooks.tools)) expect(t.effect).toBe('read')
  })

  it('reads the company: its name, its year, its currency and its basis', async () => {
    const co = await run<CompanyRead>('company')
    expect(co).toEqual({
      id: REALM,
      name: 'Harbor CPA LLC',
      legalName: 'Harbor CPA LLC',
      fiscalYearStarts: 'January',
      currency: 'USD',
      basis: 'Cash',
      test: false,
    })
  })

  it('reads the chart of accounts, inactive ones too', async () => {
    const list = await run<{ name: string; active: boolean; balance: number }[]>('accounts')
    expect(list.map((a) => [a.name, a.active, a.balance])).toEqual([
      ['Fees', true, 0],
      ['Checking', true, 5400.5],
      ['Rent', false, 0],
    ])
    const q = asked.find((a) => a.url.pathname.endsWith('/query'))?.url.searchParams.get('query')
    expect(q).toBe(
      'select * from Account where Active in (true, false) startposition 1 maxresults 1000',
    )
  })

  it('reads a report by month into its columns and data rows, totals left out', async () => {
    const r = await run<ReportRead>('report', {
      name: 'ProfitAndLoss',
      start: '2026-10-01',
      end: '2026-11-15',
      byMonth: true,
      basis: 'Cash',
    })
    expect(r.columns.map((c) => [c.title, c.start ?? null])).toEqual([
      ['', null],
      ['Oct 2026', '2026-10-01'],
      ['Nov 1-15, 2026', '2026-11-01'],
      ['Total', null],
    ])
    expect(
      r.rows.map((x) => [x.cells[0]?.value, x.cells[0]?.id, x.group, x.cells[1]?.value]),
    ).toEqual([
      ['Fees', '1', 'Income', '1,250.00'],
      ['Rent', '7', 'Expenses', '900.00'],
    ])
    const url = asked.find((a) => a.url.pathname.endsWith('/ProfitAndLoss'))?.url
    expect(Object.fromEntries(url?.searchParams ?? [])).toEqual({
      start_date: '2026-10-01',
      end_date: '2026-11-15',
      summarize_column_by: 'Month',
      accounting_method: 'Cash',
      minorversion: '75',
    })
    // the balance sheet's groups are the innermost QuickBooks names
    const bs = await run<ReportRead>('report', {
      name: 'BalanceSheet',
      start: '2026-10-01',
      end: '2026-11-15',
      byMonth: true,
    })
    expect(bs.rows.map((x) => [x.cells[0]?.value, x.group])).toEqual([
      ['Checking', 'Assets'],
      ['Credit card', 'Liabilities'],
    ])
  })

  it('reads a ledger Intuit cuts short in two halves, each line with its account', async () => {
    const r = await run<ReportRead>('report', {
      name: 'GeneralLedger',
      start: '2026-11-01',
      end: '2026-11-15',
      columns: 'tx_date,txn_type,doc_num,name,memo,split_acc,subt_nat_amount',
    })
    const asks = asked.filter((a) => a.url.pathname.endsWith('/GeneralLedger'))
    expect(
      asks.map((a) => [a.url.searchParams.get('start_date'), a.url.searchParams.get('end_date')]),
    ).toEqual([
      ['2026-11-01', '2026-11-15'],
      ['2026-11-01', '2026-11-08'],
      ['2026-11-09', '2026-11-15'],
    ])
    expect(r.rows).toHaveLength(2)
    expect(r.rows[0]?.under).toEqual({ value: 'Checking', id: '35' })
  })

  it('reads a list by one select only, every page', async () => {
    await expect(run('list', { select: 'delete from Account' })).rejects.toThrow(/one select/)
    await expect(
      run('list', { select: 'select * from Vendor; select * from Bill' }),
    ).rejects.toThrow(/one select/)
    const list = await run<{ Name: string }[]>('list', { select: 'select * from Account' })
    expect(list).toHaveLength(3)
  })

  it('asks for nothing but reads: every call is a GET', async () => {
    await run('company')
    await run('accounts')
    await run('report', { name: 'AgedReceivables', asOf: '2026-11-15' })
    expect(new Set(asked.map((a) => a.method))).toEqual(new Set(['GET']))
  })

  it('finds a test company at the sandbox address, and keeps where it is', async () => {
    answer = (url) =>
      url.origin === HOSTS.sandbox
        ? books(url)
        : { status: 401, json: { Fault: { Error: [{ Message: 'AuthenticationFailed' }] } } }
    const h = host()
    await quickbooks.check?.(call(h))
    expect(JSON.parse(h.now ?? '{}')).toMatchObject({ where: 'sandbox' })
    const co = await run<CompanyRead>('company', {}, h)
    expect(co.test).toBe(true)
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
})
