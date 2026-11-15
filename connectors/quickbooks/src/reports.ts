// QuickBooks' reports as rows. A report is a header, its columns (each with its title and, for a
// month, its first and last day), and nested rows: a section (Income, an account with
// sub-accounts) holds a header, its rows and a summary (its total); a data row is one account, one
// customer, or one transaction line. Only data rows are kept: a total is the sum of its rows,
// which the Accounting module works out, and checks against.

export interface Cell {
  value?: string
  id?: string
}
export interface ReportRow {
  type?: string // Section or Data
  group?: string // Income, COGS, Expenses, OtherIncome, OtherExpenses, … on a top section
  Header?: { ColData?: Cell[] }
  Rows?: { Row?: ReportRow[] }
  Summary?: { ColData?: Cell[] }
  ColData?: Cell[]
}
export interface Report {
  Header?: {
    ReportName?: string
    StartPeriod?: string
    EndPeriod?: string
    ReportBasis?: string
    Currency?: string
    Option?: { Name?: string; Value?: string }[]
  }
  Columns?: {
    Column?: {
      ColTitle?: string
      ColType?: string
      MetaData?: { Name?: string; Value?: string }[]
    }[]
  }
  Rows?: { Row?: ReportRow[] }
}

export interface Column {
  title: string
  key: string // the column's own key (tx_date, subt_nat_amount, total, the month's title)
  start?: string // a month's first day, YYYY-MM-DD
  end?: string // its last day
}

export function columns(r: Report): Column[] {
  return (r.Columns?.Column ?? []).map((c) => {
    const meta = Object.fromEntries((c.MetaData ?? []).map((m) => [m.Name ?? '', m.Value ?? '']))
    return {
      title: c.ColTitle ?? '',
      key: meta.ColKey ?? c.ColTitle ?? '',
      ...(meta.StartDate ? { start: meta.StartDate } : {}),
      ...(meta.EndDate ? { end: meta.EndDate } : {}),
    }
  })
}

// A data row with where it sits: the innermost section whose group QuickBooks names (Income,
// Liabilities), and the account whose section holds it (a parent account, or the account in a
// general ledger).
export interface Found {
  cells: Cell[]
  group: string
  under: Cell | null
}

export function dataRows(r: Report): Found[] {
  const out: Found[] = []
  const walk = (rows: ReportRow[] | undefined, group: string, under: Cell | null) => {
    for (const row of rows ?? []) {
      if (row.ColData) {
        out.push({ cells: row.ColData, group, under })
        continue
      }
      const head = row.Header?.ColData?.[0]
      walk(
        row.Rows?.Row,
        row.group && row.group in GROUPS ? row.group : group,
        head?.id ? head : under,
      )
    }
  }
  walk(r.Rows?.Row, '', null)
  return out
}

// "1,234.56", "-12.00", "(12.00)" as a number; empty and words are none.
export function amount(text: string | undefined): number | null {
  const t = (text ?? '').replace(/,/g, '').trim()
  if (!t) return null
  const neg = /^\(.*\)$/.test(t)
  const n = Number(t.replace(/[()]/g, ''))
  if (!Number.isFinite(n)) return null
  return neg ? -n : n
}

// A report Intuit cut short says so: "Unable to display more data. Please reduce the date range."
export const cutShort = (r: unknown): boolean => /reduce the date range/i.test(JSON.stringify(r))

// Intuit's group names in plain words.
const GROUPS: Record<string, string> = {
  Income: 'Income',
  COGS: 'Cost of goods sold',
  GrossProfit: 'Gross profit',
  Expenses: 'Expenses',
  NetOperatingIncome: 'Net operating income',
  OtherIncome: 'Other income',
  OtherExpenses: 'Other expenses',
  NetOtherIncome: 'Net other income',
  NetIncome: 'Net income',
  TotalAssets: 'Assets',
  Liabilities: 'Liabilities',
  Equity: 'Equity',
  TotalLiabilitiesAndEquity: 'Liabilities and equity',
}
export const groupWords = (g: string): string => GROUPS[g] ?? g
