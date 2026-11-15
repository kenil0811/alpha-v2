// QuickBooks: a client company's QuickBooks Online books, through the firm's own Intuit app, read
// only (intuit.ts holds the wall: every call is a GET). One connection is one company, the one
// picked on Intuit's page (host.place). It keeps nothing of its own: no tables, no daily read. It
// offers reads, used by a module whose kit names it (the Accounting module's daily read, through
// the kit API) and by an agent the person asks; what is kept, and where, is the module's.
import { readFileSync } from 'node:fs'
import { type Call, type Connector, defineTool, Problem } from '@alpha/connector-sdk'
import { z } from 'zod'
import { get, type Where, whereIs } from './intuit.ts'
import {
  type Column,
  columns,
  cutShort,
  dataRows,
  type Found,
  groupWords,
  type Report,
} from './reports.ts'

const SHAPE = 'q1' // the cursor's shape: a newer one finds where the company is again
const PAGES = 20 // a list read at most this many pages of a thousand
const DATE = /^\d{4}-\d{2}-\d{2}$/

interface Cursor {
  shape: string
  where?: Where
}

function readCursor(raw: string | null): Cursor {
  try {
    const c = JSON.parse(raw ?? '{}') as Cursor
    return c.shape === SHAPE ? c : { shape: SHAPE }
  } catch {
    return { shape: SHAPE }
  }
}

// Where the company is (a real company at the production address, a test company at the sandbox
// one), found once and kept.
async function whereOf(c: Call): Promise<Where> {
  const cur = readCursor(c.host.cursor())
  const where = await whereIs(c, cur.where)
  if (where !== cur.where) c.host.setCursor(JSON.stringify({ ...cur, where }))
  return where
}

const day = (d: Date) => d.toISOString().slice(0, 10)

// A report read whole, or, when Intuit cuts it short, in two halves of its span, down to a day.
async function reportParts(
  c: Call,
  where: Where,
  name: string,
  query: Record<string, string>,
): Promise<Report[]> {
  const r = await c.call(`report ${name}`, query, () =>
    get<Report>(c, where, `reports/${encodeURIComponent(name)}`, query),
  )
  if (!cutShort(r)) return [r]
  const { start_date: start, end_date: end } = query
  if (!start || !end || start === end)
    throw new Problem(`QuickBooks' ${name} report is too big to read, even for one day.`)
  const a = Date.parse(start)
  const b = Date.parse(end)
  const mid = day(new Date(a + Math.floor((b - a) / 86_400_000 / 2) * 86_400_000))
  const next = day(new Date(Date.parse(mid) + 86_400_000))
  return [
    ...(await reportParts(c, where, name, { ...query, end_date: mid })),
    ...(await reportParts(c, where, name, { ...query, start_date: next })),
  ]
}

export interface ReportRead {
  name: string
  basis: string | null
  columns: Column[]
  // each data row (an account, a customer, a transaction line) with the group its section is in
  // (Income, Expenses, Assets) and the account whose section holds it, and each section's total
  // after its rows (total: true)
  rows: { cells: Found['cells']; group: string; under: Found['under']; total: boolean }[]
}

export interface CompanyRead {
  id: string
  name: string
  legalName: string
  fiscalYearStarts: string
  currency: string
  basis: 'Cash' | 'Accrual'
  test: boolean
}

interface CompanyInfo {
  CompanyInfo?: { CompanyName?: string; LegalName?: string; FiscalYearStartMonth?: string }
}
interface Preferences {
  Preferences?: {
    ReportPrefs?: { ReportBasis?: string }
    CurrencyPrefs?: { HomeCurrency?: { value?: string } }
  }
}
interface Account {
  Id: string
  Name?: string
  FullyQualifiedName?: string
  AcctNum?: string
  AccountType?: string
  AccountSubType?: string
  Classification?: string
  ParentRef?: { value?: string; name?: string }
  Active?: boolean
  CurrentBalance?: number
}

// A list by QuickBooks' own query: one select, every page of it.
async function query(c: Call, where: Where, select: string): Promise<Record<string, unknown>[]> {
  const words = select.trim().replace(/;+\s*$/, '')
  if (!/^select\s/i.test(words) || words.includes(';'))
    throw new Problem('A QuickBooks list is read with one select, nothing else.')
  if (/\b(startposition|maxresults)\b/i.test(words))
    throw new Problem('Leave startposition and maxresults out: every page is read.')
  const all: Record<string, unknown>[] = []
  for (let page = 0; page < PAGES; page++) {
    const q = `${words} startposition ${page * 1000 + 1} maxresults 1000`
    const got = await c.call('query', { q }, () =>
      get<{ QueryResponse?: Record<string, unknown> }>(c, where, 'query', { query: q }),
    )
    const list = Object.values(got.QueryResponse ?? {}).find(Array.isArray) as
      | Record<string, unknown>[]
      | undefined
    all.push(...(list ?? []))
    if (!list || list.length < 1000) return all
  }
  return all
}

const day10 = z.string().regex(DATE, 'a date as YYYY-MM-DD')

export const quickbooks: Connector = {
  manifest: {
    name: 'quickbooks',
    title: 'QuickBooks',
    auth: 'oauth',
    oauth: { provider: 'intuit', scopes: ['com.intuit.quickbooks.accounting'] },
    icon: 'plug',
    account: { label: 'Client', placeholder: 'The client, as your firm calls it' },
    setup: { sub: 'A client company’s books, read only, through your firm’s own Intuit app' },
    pace: { perMinute: 120 },
    reaches: ['quickbooks.api.intuit.com', 'sandbox-quickbooks.api.intuit.com'],
  },
  guide: readFileSync(new URL('../GUIDE.md', import.meta.url), 'utf8'),
  module: 'QuickBooks',
  // it keeps nothing: a module that needs the books keeps what it needs, in its own tables
  tables: [],
  tools: {
    company: defineTool({
      description:
        'The company: its name, its fiscal year’s first month, its currency, the basis its reports use (Cash or Accrual), and whether it is one of Intuit’s test companies.',
      input: {},
      effect: 'read',
      words: () => 'Read the company from QuickBooks',
      run: async (c): Promise<CompanyRead> => {
        const where = await whereOf(c)
        const id = c.host.place as string
        const [info, prefs] = await Promise.all([
          c.call('company', { id }, () =>
            get<CompanyInfo>(c, where, `companyinfo/${encodeURIComponent(id)}`),
          ),
          c.call('preferences', { id }, () => get<Preferences>(c, where, 'preferences')),
        ])
        const i = info.CompanyInfo ?? {}
        const p = prefs.Preferences ?? {}
        return {
          id,
          name: i.CompanyName || i.LegalName || c.host.account,
          legalName: i.LegalName ?? '',
          fiscalYearStarts: i.FiscalYearStartMonth ?? '',
          currency: p.CurrencyPrefs?.HomeCurrency?.value ?? 'USD',
          basis: p.ReportPrefs?.ReportBasis === 'Cash' ? 'Cash' : 'Accrual',
          test: where === 'sandbox',
        }
      },
    }),
    accounts: defineTool({
      description:
        'The chart of accounts, active and not: each account’s id, name, full name, number, type (Income, Expense, Bank, …), detail type, classification, parent, whether it is active, and its balance today.',
      input: {},
      effect: 'read',
      words: () => 'Read the chart of accounts from QuickBooks',
      run: async (c) => {
        const where = await whereOf(c)
        const list = (await query(
          c,
          where,
          'select * from Account where Active in (true, false)',
        )) as unknown as Account[]
        return list.map((a) => ({
          id: a.Id,
          name: a.Name ?? '',
          fullName: a.FullyQualifiedName ?? a.Name ?? '',
          number: a.AcctNum ?? '',
          type: a.AccountType ?? '',
          detailType: a.AccountSubType ?? '',
          classification: a.Classification ?? '',
          parent: a.ParentRef?.name ?? '',
          active: a.Active !== false,
          balance: a.CurrentBalance ?? 0,
        }))
      },
    }),
    report: defineTool({
      description:
        'One of QuickBooks’ reports by its name (ProfitAndLoss, BalanceSheet, CustomerSales, GeneralLedger, AgedReceivables, AgedPayables, VendorExpenses, …), for dates as YYYY-MM-DD: start and end for a period, asOf for an aging. byMonth gives a column a month. basis is Cash or Accrual (the company’s own when left out). columns names a general ledger’s columns (tx_date,txn_type,doc_num,name,memo,split_acc,subt_nat_amount). Returns its columns, each month’s with its first and last day, and its rows, each with the group its section is in and the account that holds it; a section’s total (Total Income, Net Income) comes after its rows, marked total.',
      input: {
        name: z.string().regex(/^[A-Za-z]+$/, 'a report’s name, such as ProfitAndLoss'),
        start: day10.optional(),
        end: day10.optional(),
        asOf: day10.optional(),
        byMonth: z.boolean().optional(),
        basis: z.enum(['Cash', 'Accrual']).optional(),
        columns: z
          .string()
          .regex(/^[a-z_,]+$/)
          .optional(),
      },
      effect: 'read',
      words: ({ name }) => `Read the ${name} report from QuickBooks`,
      run: async (c, i): Promise<ReportRead> => {
        const where = await whereOf(c)
        const q: Record<string, string> = {
          ...(i.start ? { start_date: i.start } : {}),
          ...(i.end ? { end_date: i.end } : {}),
          ...(i.asOf ? { report_date: i.asOf } : {}),
          ...(i.byMonth ? { summarize_column_by: 'Month' } : {}),
          ...(i.basis ? { accounting_method: i.basis } : {}),
          ...(i.columns ? { columns: i.columns } : {}),
        }
        const parts = await reportParts(c, where, i.name, q)
        return {
          name: i.name,
          basis: parts[0]?.Header?.ReportBasis ?? i.basis ?? null,
          columns: parts[0] ? columns(parts[0]) : [],
          rows: parts.flatMap((r) =>
            dataRows(r).map((f) => ({
              cells: f.cells,
              group: groupWords(f.group),
              under: f.under,
              total: f.total,
            })),
          ),
        }
      },
    }),
    list: defineTool({
      description:
        "Any QuickBooks list by one select in QuickBooks’ own query words, such as “select * from Customer” or “select * from Bill where TxnDate >= '2026-01-01'”. Every page is read. Only a select.",
      input: { select: z.string() },
      effect: 'read',
      words: () => 'Read a list from QuickBooks',
      run: async (c, { select }) => query(c, await whereOf(c), select),
    }),
  },
  // the company answers, at the production address or, for a test company, the sandbox one
  check: async (c) => {
    await whereOf(c)
  },
}

export const connector = quickbooks
