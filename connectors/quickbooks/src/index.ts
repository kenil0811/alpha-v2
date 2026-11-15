// QuickBooks: a client company's QuickBooks Online books, through the firm's own Intuit app, read
// only (intuit.ts holds the wall: every call is a GET). One connection is one company, the one
// picked on Intuit's page (host.place). Each read goes back two full years before this month and
// reads that span again each day, since books change after the fact: the company and its
// accounts, the profit and loss and the balance sheet by month, sales by customer by month, every
// transaction line by account (a month at a time, as Intuit cuts a big report short), and what is
// owed to and by the company, by age. A row QuickBooks no longer shows is marked gone (rules D8).
import { readFileSync } from 'node:fs'
import { type Call, type Connector, type Item, Problem } from '@alpha/connector-sdk'
import { get, type Where, whereIs } from './intuit.ts'
import { amount, columns, cutShort, dataRows, groupWords, type Report } from './reports.ts'

export const MONTHS_BACK = 24 // two full years before this month
const SHAPE = 'q1' // the cursor's shape: a newer one finds where the company is again

interface Cursor {
  shape: string
  where?: Where
}

interface CompanyInfo {
  CompanyInfo?: {
    CompanyName?: string
    LegalName?: string
    Country?: string
    FiscalYearStartMonth?: string
  }
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

const day = (d: Date) => d.toISOString().slice(0, 10)
const money = (n: number, currency: string) => ({ amount: n, currency })

// The span read: the first day of the month two years back, to today.
export function span(now: Date): { start: string; end: string; months: [string, string][] } {
  const first = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - MONTHS_BACK, 1))
  const months: [string, string][] = []
  for (
    let m = new Date(first);
    m <= now;
    m = new Date(Date.UTC(m.getUTCFullYear(), m.getUTCMonth() + 1, 1))
  ) {
    const last = new Date(Date.UTC(m.getUTCFullYear(), m.getUTCMonth() + 1, 0))
    months.push([day(m), day(last < now ? last : now)])
  }
  return { start: day(first), end: day(now), months }
}

function readCursor(raw: string | null): Cursor {
  try {
    const c = JSON.parse(raw ?? '{}') as Cursor
    return c.shape === SHAPE ? c : { shape: SHAPE }
  } catch {
    return { shape: SHAPE }
  }
}

// A report read whole, or, when Intuit cuts it short, in two halves of its span, down to a day.
async function report(
  c: Call,
  where: Where,
  name: string,
  query: Record<string, string>,
): Promise<Report[]> {
  const r = await c.call(`report ${name}`, query, () =>
    get<Report>(c, where, `reports/${name}`, query),
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
    ...(await report(c, where, name, { ...query, end_date: mid })),
    ...(await report(c, where, name, { ...query, start_date: next })),
  ]
}

// The company: its name, its year, its currency and the basis its reports use.
async function company(c: Call, where: Where) {
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
    legal: i.LegalName ?? '',
    yearStarts: i.FiscalYearStartMonth ?? '',
    currency: p.CurrencyPrefs?.HomeCurrency?.value ?? 'USD',
    basis: p.ReportPrefs?.ReportBasis === 'Cash' ? 'Cash' : 'Accrual',
  }
}

async function accounts(c: Call, where: Where): Promise<Account[]> {
  const all: Account[] = []
  for (let at = 1; ; at += 1000) {
    const q = `select * from Account where Active in (true, false) startposition ${at} maxresults 1000`
    const page = await c.call('accounts', { at }, () =>
      get<{ QueryResponse?: { Account?: Account[] } }>(c, where, 'query', { query: q }),
    )
    const got = page.QueryResponse?.Account ?? []
    all.push(...got)
    if (got.length < 1000) return all
  }
}

type Rows = Record<string, Item[]>

// The general ledger's columns asked for, each by its key and its title
const GL: [string, RegExp][] = [
  ['tx_date', /^date$/i],
  ['txn_type', /type/i],
  ['doc_num', /^num/i],
  ['name', /^name$/i],
  ['memo', /memo|description/i],
  ['split_acc', /^split/i],
  ['subt_nat_amount', /^amount$/i],
]

// Every table's rows for one read of the company.
export async function readAll(
  c: Call,
  where: Where,
  now: Date,
): Promise<{ rows: Rows; months: string[] }> {
  const co = await company(c, where)
  const s = span(now)
  const tag = { Company: co.name, 'Company ID': co.id }
  const key = (...parts: (string | undefined)[]) => [co.id, ...parts.map((p) => p ?? '')].join(':')
  const cash = (n: number) => money(n, co.currency)
  const rows: Rows = {
    Companies: [
      {
        key: co.id,
        values: {
          Name: co.name,
          'Legal name': co.legal,
          'Company ID': co.id,
          'Fiscal year starts': co.yearStarts,
          Currency: co.currency,
          Basis: co.basis,
          'Test company': where === 'sandbox' ? 'yes' : 'no',
          'Last read': day(now),
        },
      },
    ],
  }

  rows.Accounts = (await accounts(c, where)).map((a) => ({
    key: key(a.Id),
    values: {
      ...tag,
      Account: a.Name ?? '',
      'Full name': a.FullyQualifiedName ?? a.Name ?? '',
      Number: a.AcctNum ?? '',
      Type: a.AccountType ?? '',
      'Detail type': a.AccountSubType ?? '',
      Classification: a.Classification ?? '',
      Parent: a.ParentRef?.name ?? '',
      Active: a.Active === false ? 'no' : 'yes',
      Balance: cash(a.CurrentBalance ?? 0),
      'Account ID': a.Id,
    },
  }))

  const basis = { accounting_method: co.basis }
  const byMonth = { start_date: s.start, end_date: s.end, summarize_column_by: 'Month', ...basis }
  // an account's (or a customer's) amount in each month column, the total column left out
  const monthly = (
    reports: Report[],
    each: (
      f: ReturnType<typeof dataRows>[number],
      col: { start: string; end: string },
      n: number,
    ) => Item | null,
  ) => {
    const out: Item[] = []
    for (const r of reports) {
      const cols = columns(r)
      for (const f of dataRows(r))
        cols.forEach((col, i) => {
          if (!col.start || !col.end || i === 0) return
          const n = amount(f.cells[i]?.value)
          if (n === null || n === 0) return
          const item = each(f, { start: col.start, end: col.end }, n)
          if (item) out.push(item)
        })
    }
    return out
  }

  rows['Monthly results'] = monthly(
    await report(c, where, 'ProfitAndLoss', byMonth),
    (f, col, n) => {
      const a = f.cells[0]
      if (!a?.value) return null
      return {
        key: key(a.id ?? a.value, col.start.slice(0, 7)),
        values: {
          ...tag,
          Month: col.start,
          Account: a.value,
          'Account ID': a.id ?? '',
          Group: groupWords(f.group),
          Amount: cash(n),
        },
      }
    },
  )

  rows['Month-end balances'] = monthly(
    await report(c, where, 'BalanceSheet', byMonth),
    (f, col, n) => {
      const a = f.cells[0]
      if (!a?.value) return null
      return {
        key: key(a.id ?? a.value, col.start.slice(0, 7)),
        values: {
          ...tag,
          'As of': col.end,
          Account: a.value,
          'Account ID': a.id ?? '',
          Group: groupWords(f.group),
          Balance: cash(n),
        },
      }
    },
  )

  rows['Sales by customer'] = monthly(
    await report(c, where, 'CustomerSales', byMonth),
    (f, col, n) => {
      const who = f.cells[0]
      if (!who?.value) return null
      return {
        key: key(who.id ?? who.value, col.start.slice(0, 7)),
        values: {
          ...tag,
          Month: col.start,
          Customer: who.value,
          'Customer ID': who.id ?? '',
          Sales: cash(n),
        },
      }
    },
  )

  // every line under each account, a month at a time, its columns asked for by name
  const lines: Item[] = []
  for (const [from, to] of s.months) {
    const seen = new Map<string, number>()
    const query = {
      start_date: from,
      end_date: to,
      columns: GL.map(([k]) => k).join(','),
      ...basis,
    }
    for (const r of await report(c, where, 'GeneralLedger', query)) {
      const cols = columns(r)
      // a column by its key, or by its title where Intuit gives no key
      const at = (name: string) => {
        const title = GL.find(([k]) => k === name)?.[1]
        const i = cols.findIndex((x) => x.key === name)
        return i >= 0 ? i : cols.findIndex((x) => !!title && title.test(x.title))
      }
      for (const f of dataRows(r)) {
        const cell = (name: string) => {
          const i = at(name)
          return i >= 0 ? f.cells[i] : undefined
        }
        const type = cell('txn_type')
        const amt = amount(cell('subt_nat_amount')?.value)
        // the opening balance line is a sum, not a transaction
        if (!type?.value || amt === null) continue
        const account = f.under
        const date = cell('tx_date')?.value ?? from
        const num = cell('doc_num')?.value ?? ''
        const id = type.id ?? cell('tx_date')?.id ?? `${date}|${num}|${amt}`
        const base = key(from.slice(0, 7), account?.id ?? account?.value, type.value, id)
        const n = (seen.get(base) ?? 0) + 1
        seen.set(base, n)
        lines.push({
          key: `${base}:${n}`,
          values: {
            ...tag,
            Date: date,
            Type: type.value,
            Number: num,
            Name: cell('name')?.value ?? '',
            Memo: cell('memo')?.value ?? '',
            Account: account?.value ?? '',
            'Account ID': account?.id ?? '',
            Split: cell('split_acc')?.value ?? '',
            Amount: cash(amt),
            'Transaction ID': type.id ?? cell('tx_date')?.id ?? '',
          },
        })
      }
    }
  }
  rows.Transactions = lines

  // what each customer owes, and what is owed to each vendor, by age, today
  const AGES: [string, RegExp][] = [
    ['Current', /^current/i],
    ['1 to 30 days', /^1\s*-\s*30/],
    ['31 to 60 days', /^31\s*-\s*60/],
    ['61 to 90 days', /^61\s*-\s*90/],
    ['Over 90 days', /^91|over/i],
    ['Total', /^total/i],
  ]
  const aging = async (name: string, who: string) => {
    const out: Item[] = []
    for (const r of await report(c, where, name, { report_date: s.end })) {
      const cols = columns(r)
      for (const f of dataRows(r)) {
        const party = f.cells[0]
        if (!party?.value) continue
        const values: Record<string, unknown> = {
          ...tag,
          'As of': s.end,
          [who]: party.value,
          [`${who} ID`]: party.id ?? '',
        }
        for (const [field, title] of AGES) {
          const i = cols.findIndex((x) => title.test(x.title.trim()))
          const n = i > 0 ? amount(f.cells[i]?.value) : null
          values[field] = cash(n ?? 0)
        }
        out.push({ key: key(party.id ?? party.value), values })
      }
    }
    return out
  }
  rows.Receivables = await aging('AgedReceivables', 'Customer')
  rows.Payables = await aging('AgedPayables', 'Vendor')
  return { rows, months: s.months.map(([m]) => m.slice(0, 7)) }
}

// The keys the company had in a table that this read did not find, within what it read: rows of a
// month it no longer reads are left as they are.
export function goneKeys(
  company: string,
  had: string[],
  found: Set<string>,
  months: string[] | null,
): string[] {
  return had.filter((k) => {
    if (!k.startsWith(`${company}:`) || found.has(k)) return false
    if (!months) return true
    const m = /:(\d{4}-\d{2})(:|$)/.exec(k.slice(company.length))
    return !m || months.includes(m[1] as string)
  })
}

// the tables whose rows carry their month in their key, and so are read again only for the span
const BY_MONTH = new Set([
  'Monthly results',
  'Month-end balances',
  'Sales by customer',
  'Transactions',
])

const T = (name: string) => ({ name, kind: 'text' as const })
const M = (name: string) => ({ name, kind: 'money' as const })
const D = (name: string) => ({ name, kind: 'date' as const })
const COMPANY = [T('Company'), T('Company ID')]

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
    syncEveryMinutes: 24 * 60,
    reaches: ['quickbooks.api.intuit.com', 'sandbox-quickbooks.api.intuit.com'],
  },
  guide: readFileSync(new URL('../GUIDE.md', import.meta.url), 'utf8'),
  module: 'QuickBooks',
  tables: [
    {
      name: 'Companies',
      fields: [
        T('Name'),
        T('Legal name'),
        T('Company ID'),
        T('Fiscal year starts'),
        T('Currency'),
        { name: 'Basis', kind: 'choice', choices: ['Accrual', 'Cash'] },
        { name: 'Test company', kind: 'choice', choices: ['yes', 'no'] },
        D('Last read'),
      ],
    },
    {
      name: 'Accounts',
      fields: [
        ...COMPANY,
        T('Account'),
        T('Full name'),
        T('Number'),
        T('Type'),
        T('Detail type'),
        T('Classification'),
        T('Parent'),
        { name: 'Active', kind: 'choice', choices: ['yes', 'no'] },
        M('Balance'),
        T('Account ID'),
      ],
    },
    {
      name: 'Monthly results',
      fields: [...COMPANY, D('Month'), T('Account'), T('Account ID'), T('Group'), M('Amount')],
    },
    {
      name: 'Month-end balances',
      fields: [...COMPANY, D('As of'), T('Account'), T('Account ID'), T('Group'), M('Balance')],
    },
    {
      name: 'Sales by customer',
      fields: [...COMPANY, D('Month'), T('Customer'), T('Customer ID'), M('Sales')],
    },
    {
      name: 'Transactions',
      fields: [
        ...COMPANY,
        D('Date'),
        T('Type'),
        T('Number'),
        T('Name'),
        T('Memo'),
        T('Account'),
        T('Account ID'),
        T('Split'),
        M('Amount'),
        T('Transaction ID'),
      ],
    },
    {
      name: 'Receivables',
      fields: [
        ...COMPANY,
        D('As of'),
        T('Customer'),
        T('Customer ID'),
        M('Current'),
        M('1 to 30 days'),
        M('31 to 60 days'),
        M('61 to 90 days'),
        M('Over 90 days'),
        M('Total'),
      ],
    },
    {
      name: 'Payables',
      fields: [
        ...COMPANY,
        D('As of'),
        T('Vendor'),
        T('Vendor ID'),
        M('Current'),
        M('1 to 30 days'),
        M('31 to 60 days'),
        M('61 to 90 days'),
        M('Over 90 days'),
        M('Total'),
      ],
    },
  ],
  // reads only: nothing a person, an agent or a script asks for can change a client's books
  tools: {},
  // the company answers, at the production address or, for a test company, the sandbox one
  check: async (c) => {
    const cur = readCursor(c.host.cursor())
    const where = await whereIs(c, cur.where)
    if (where !== cur.where) c.host.setCursor(JSON.stringify({ ...cur, where }))
  },
  sync: async (c) => {
    const cur = readCursor(c.host.cursor())
    const where = await whereIs(c, cur.where)
    const { rows, months } = await readAll(c, where, new Date())
    let total = 0
    let added = 0
    const company = c.host.place as string
    for (const [table, items] of Object.entries(rows)) {
      const landed = await c.host.land(table, items)
      added += landed.added
      total += items.length
      const had = (await c.host.keys?.(table)) ?? []
      const gone = goneKeys(
        company,
        had,
        new Set(items.map((i) => i.key)),
        BY_MONTH.has(table) ? months : null,
      )
      if (gone.length) await c.host.gone?.(table, gone)
    }
    c.host.setCursor(JSON.stringify({ ...cur, where }))
    return { rows: total, sawNew: added > 0 }
  },
}

export const connector = quickbooks
