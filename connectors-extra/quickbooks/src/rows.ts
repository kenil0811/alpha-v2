// QuickBooks's JSON as Alpha's rows: each entity a row keyed by its company and its own id (so
// several companies share the tables), and each report a row per line and column.
import type { Item, TableSpec } from '@alpha/connector-sdk'

// biome-ignore lint/suspicious/noExplicitAny: QuickBooks's entities are read field by field
export type Q = Record<string, any>

const yesNo = (b: unknown) => (b === undefined ? undefined : b ? 'yes' : 'no')
const ref = (r: Q | undefined): string | undefined => r?.name ?? r?.value
const money = (n: unknown, e: Q) =>
  n === undefined || n === null || n === ''
    ? undefined
    : { amount: Number(n), currency: e.CurrencyRef?.value ?? 'USD' }

// Only what is there: an empty email or phone is no value, not a wrong one.
function defined(values: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(values).filter(([, v]) => v !== undefined && v !== null && v !== ''),
  )
}

// A transaction's lines, one per line, each with its line id (what recategorize names).
export function lines(e: Q): string {
  return ((e.Line ?? []) as Q[])
    .filter((l) => l.DetailType !== 'SubTotalLineDetail')
    .map((l) => {
      const d = l[l.DetailType as string] ?? {}
      const account = d.AccountRef ? `${ref(d.AccountRef)} (account ${d.AccountRef.value})` : ''
      const item = d.ItemRef ? `${ref(d.ItemRef)} (item ${d.ItemRef.value})` : ''
      const what = [d.PostingType, account || item, l.Amount, l.Description && `— ${l.Description}`]
      return `${l.Id ?? '-'}: ${what.filter((x) => x !== undefined && x !== '').join(' ')}`
    })
    .join('\n')
}

interface Entity {
  entity: string // QuickBooks's name for it, as the query and CDC say it
  table: TableSpec
  values: (e: Q) => Record<string, unknown>
}

const f = (name: string, kind: TableSpec['fields'][number]['kind'] = 'text') => ({ name, kind })
const common = [f('Company'), f('QuickBooks ID')]

export const ENTITIES: Entity[] = [
  {
    entity: 'Account',
    table: {
      name: 'Accounts',
      fields: [
        ...common,
        f('Name'),
        f('Full name'),
        f('Type'),
        f('Subtype'),
        f('Classification'),
        f('Number'),
        f('Balance', 'money'),
        { name: 'Active', kind: 'choice', choices: ['yes', 'no'] },
      ],
    },
    values: (e) => ({
      Name: e.Name,
      'Full name': e.FullyQualifiedName,
      Type: e.AccountType,
      Subtype: e.AccountSubType,
      Classification: e.Classification,
      Number: e.AcctNum,
      Balance: money(e.CurrentBalance, e),
      Active: yesNo(e.Active),
    }),
  },
  ...(['Customer', 'Vendor'] as const).map(
    (entity): Entity => ({
      entity,
      table: {
        name: `${entity}s`,
        fields: [
          ...common,
          f('Name'),
          f('Company name'),
          f('Email', 'email'),
          f('Phone', 'phone'),
          f('Balance', 'money'),
          { name: 'Active', kind: 'choice', choices: ['yes', 'no'] },
          ...(entity === 'Vendor'
            ? [{ name: '1099', kind: 'choice' as const, choices: ['yes', 'no'] }]
            : []),
        ],
      },
      values: (e) => ({
        Name: e.DisplayName,
        'Company name': e.CompanyName,
        Email: e.PrimaryEmailAddr?.Address,
        Phone: e.PrimaryPhone?.FreeFormNumber,
        Balance: money(e.Balance, e),
        Active: yesNo(e.Active),
        ...(entity === 'Vendor' ? { '1099': yesNo(e.Vendor1099 ?? false) } : {}),
      }),
    }),
  ),
  {
    entity: 'Invoice',
    table: {
      name: 'Invoices',
      fields: [
        ...common,
        f('Number'),
        f('Customer'),
        f('Date', 'date'),
        f('Due date', 'date'),
        f('Total', 'money'),
        f('Balance', 'money'),
        f('Email status'),
        f('Bill email', 'email'),
        f('Lines', 'notes'),
      ],
    },
    values: (e) => ({
      Number: e.DocNumber,
      Customer: ref(e.CustomerRef),
      Date: e.TxnDate,
      'Due date': e.DueDate,
      Total: money(e.TotalAmt, e),
      Balance: money(e.Balance, e),
      'Email status': e.EmailStatus,
      'Bill email': e.BillEmail?.Address,
      Lines: lines(e),
    }),
  },
  {
    entity: 'Bill',
    table: {
      name: 'Bills',
      fields: [
        ...common,
        f('Number'),
        f('Vendor'),
        f('Date', 'date'),
        f('Due date', 'date'),
        f('Total', 'money'),
        f('Balance', 'money'),
        f('Lines', 'notes'),
      ],
    },
    values: (e) => ({
      Number: e.DocNumber,
      Vendor: ref(e.VendorRef),
      Date: e.TxnDate,
      'Due date': e.DueDate,
      Total: money(e.TotalAmt, e),
      Balance: money(e.Balance, e),
      Lines: lines(e),
    }),
  },
  {
    entity: 'Payment',
    table: {
      name: 'Payments',
      fields: [
        ...common,
        f('Customer'),
        f('Date', 'date'),
        f('Amount', 'money'),
        f('Unapplied', 'money'),
        f('Reference'),
        f('Applied to'),
      ],
    },
    values: (e) => ({
      Customer: ref(e.CustomerRef),
      Date: e.TxnDate,
      Amount: money(e.TotalAmt, e),
      Unapplied: money(e.UnappliedAmt, e),
      Reference: e.PaymentRefNum,
      'Applied to': ((e.Line ?? []) as Q[])
        .flatMap((l) => (l.LinkedTxn ?? []) as Q[])
        .map((t) => `${t.TxnType} ${t.TxnId}`)
        .join(', '),
    }),
  },
  {
    entity: 'Purchase',
    table: {
      name: 'Purchases',
      fields: [
        ...common,
        f('Number'),
        f('Date', 'date'),
        f('Payee'),
        f('Payment type'),
        f('Paid from'),
        f('Total', 'money'),
        f('Lines', 'notes'),
      ],
    },
    values: (e) => ({
      Number: e.DocNumber,
      Date: e.TxnDate,
      Payee: ref(e.EntityRef),
      'Payment type': e.PaymentType,
      'Paid from': ref(e.AccountRef),
      Total: money(e.TotalAmt, e),
      Lines: lines(e),
    }),
  },
  {
    entity: 'JournalEntry',
    table: {
      name: 'Journal entries',
      fields: [
        ...common,
        f('Number'),
        f('Date', 'date'),
        f('Total', 'money'),
        f('Memo'),
        f('Lines', 'notes'),
      ],
    },
    values: (e) => ({
      Number: e.DocNumber,
      Date: e.TxnDate,
      Total: money(e.TotalAmt, e),
      Memo: e.PrivateNote,
      Lines: lines(e),
    }),
  },
]

export const COMPANIES: TableSpec = {
  name: 'Companies',
  fields: [
    ...common,
    f('Name'),
    f('Legal name'),
    f('Country'),
    f('Fiscal year starts'),
    f('Email', 'email'),
    f('Phone', 'phone'),
  ],
}

export const REPORTS = {
  ProfitAndLoss: 'Profit and loss',
  BalanceSheet: 'Balance sheet',
  AgedReceivables: 'A/R aging',
  AgedPayables: 'A/P aging',
} as const

export const REPORT_ROWS: TableSpec = {
  name: 'Report rows',
  fields: [
    f('Company'),
    { name: 'Report', kind: 'choice', choices: Object.values(REPORTS) },
    f('Section'),
    f('Row'),
    f('Column'),
    f('Period'),
    f('Amount', 'money'),
    { name: 'Total', kind: 'choice', choices: ['yes', 'no'] },
  ],
}

export function entityItem(realm: string, entity: Entity, e: Q): Item {
  return {
    key: `${realm}:${entity.entity}:${e.Id}`,
    values: defined({ Company: realm, 'QuickBooks ID': String(e.Id), ...entity.values(e) }),
  }
}

export function companyItem(realm: string, e: Q): Item {
  return {
    key: `${realm}:CompanyInfo`,
    values: defined({
      Company: realm,
      'QuickBooks ID': String(e.Id ?? realm),
      Name: e.CompanyName,
      'Legal name': e.LegalName,
      Country: e.Country,
      'Fiscal year starts': e.FiscalYearStartMonth,
      Email: e.Email?.Address,
      Phone: e.PrimaryPhone?.FreeFormNumber,
    }),
  }
}

// A report's lines, each amount a row: its section path, the line's own name, the column (a
// month, an aging bucket, Total) and the period it covers. A report read again replaces its rows.
export function reportItems(realm: string, report: keyof typeof REPORTS, r: Q): Item[] {
  const currency = r.Header?.Currency ?? 'USD'
  const columns = ((r.Columns?.Column ?? []) as Q[]).map((c) => {
    const meta = Object.fromEntries(((c.MetaData ?? []) as Q[]).map((m) => [m.Name, m.Value]))
    const period = meta.StartDate
      ? String(meta.StartDate).slice(0, 7)
      : (r.Header?.EndPeriod ?? r.Header?.Time?.slice(0, 10) ?? '')
    return { title: String(c.ColTitle || 'Total'), period }
  })
  const out: Item[] = []
  const take = (cells: Q[], section: string[], total: boolean) => {
    const label = String(cells[0]?.value ?? '')
    cells.slice(1).forEach((cell, i) => {
      const col = columns[i + 1]
      if (!col || cell.value === undefined || cell.value === '') return
      const path = [...section, label].join(' › ')
      out.push({
        key: `${realm}:${report}:${path}:${col.title}`,
        values: defined({
          Company: realm,
          Report: REPORTS[report],
          Section: section.join(' › '),
          Row: label,
          Column: col.title,
          Period: col.period,
          Amount: { amount: Number(cell.value), currency },
          Total: total ? 'yes' : 'no',
        }),
      })
    })
  }
  const walk = (rows: Q[], section: string[]) => {
    for (const row of rows) {
      if (row.ColData) take(row.ColData, section, false)
      const name = row.Header?.ColData?.[0]?.value
      const inner = name ? [...section, String(name)] : section
      if (row.Rows?.Row) walk(row.Rows.Row, inner)
      if (row.Summary?.ColData) take(row.Summary.ColData, section, true)
    }
  }
  walk(r.Rows?.Row ?? [], [])
  return out
}
