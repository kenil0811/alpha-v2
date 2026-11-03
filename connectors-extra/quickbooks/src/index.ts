// QuickBooks Online by Intuit's accounting API (design §8), signed in by OAuth with the person's
// own Intuit app. One connection is one company (its realm ID is the account); an accountant
// with many clients makes one connection each. The sync lands the company, its accounts,
// customers, vendors and transactions (paged queries, then Change Data Capture), and four
// reports as rows. Its writes put entries in the books; sending an invoice reaches a customer.
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { basename, extname } from 'node:path'
import {
  accessToken,
  type Call,
  type Connector,
  defineTool,
  type OAuthApp,
  type OAuthTokens,
  Problem,
} from '@alpha/connector-sdk'
import { z } from 'zod'
import {
  COMPANIES,
  companyItem,
  ENTITIES,
  entityItem,
  type Q,
  REPORT_ROWS,
  type REPORTS,
  reportItems,
} from './rows.ts'

export const INTUIT: OAuthApp = {
  authorize: 'https://appcenter.intuit.com/connect/oauth2',
  token: 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer',
  scope: 'com.intuit.quickbooks.accounting',
}
const MINOR = '75'
const PAGE = 1000
const DAY = 86_400_000
const SHAPE = 'v1'

// The account is the company's realm ID; "sandbox:<id>" is a company in Intuit's sandbox.
export function company(account: string): { realm: string; base: string } {
  const m = /^(sandbox:)?\s*(\d+)$/.exec(account.trim())
  if (!m?.[2])
    throw new Problem(
      'The account is the company’s ID (Settings › Account and settings › Billing), or sandbox:<ID>.',
    )
  const host = m[1] ? 'sandbox-quickbooks.api.intuit.com' : 'quickbooks.api.intuit.com'
  return { realm: m[2], base: `https://${host}/v3/company/${m[2]}` }
}

// Intuit allows 10 calls a second per company beside the 500 a minute the SDK paces.
const lastCall = new Map<string, number>()
async function spaced(realm: string) {
  const wait = (lastCall.get(realm) ?? 0) + 100 - Date.now()
  lastCall.set(realm, Date.now() + Math.max(0, wait))
  if (wait > 0) await new Promise((r) => setTimeout(r, wait))
}

interface Request {
  method?: 'GET' | 'POST'
  query?: Record<string, string>
  json?: unknown
  form?: FormData
  body?: string // as is, with its own content type (an invoice's send)
}

// One call to the company, through the SDK (paced, retried, journaled, recorded or replayed).
// A write carries a request id made once, so a retry after a dropped answer is not a second entry.
async function api<T = Q>(c: Call, name: string, path: string, r: Request = {}): Promise<T> {
  const { realm, base } = company(c.host.account)
  const requestid = r.method === 'POST' ? randomUUID() : undefined
  const args = { path, query: r.query, json: r.json }
  return c.call(name, args, async () => {
    await spaced(realm)
    const { token, tokens } = await accessToken(c, INTUIT)
    signedInTo(tokens, realm)
    const url = new URL(`${base}${path}`)
    url.search = new URLSearchParams({
      ...r.query,
      minorversion: MINOR,
      ...(requestid ? { requestid } : {}),
    }).toString()
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    }
    if (r.json !== undefined) headers['Content-Type'] = 'application/json'
    if (r.body !== undefined) headers['Content-Type'] = 'application/octet-stream'
    const res = await fetch(url, {
      method: r.method ?? 'GET',
      headers,
      ...(r.json !== undefined ? { body: JSON.stringify(r.json) } : {}),
      ...(r.form ? { body: r.form } : {}),
      ...(r.body !== undefined ? { body: r.body } : {}),
    })
    // "temporarily": the SDK retries it, waiting longer each time
    if (res.status === 429) throw new Error('QuickBooks is temporarily limiting calls (429).')
    if (res.status >= 500) throw new Error(`QuickBooks is temporarily unavailable (${res.status}).`)
    if (res.status === 401)
      throw new Problem('QuickBooks needs this company connected again.', 'sign_in')
    const out = (await res.json().catch(() => ({}))) as Q
    if (!res.ok || out.Fault) {
      const e = out.Fault?.Error?.[0] ?? {}
      throw new Problem(`QuickBooks said: ${e.Detail ?? e.Message ?? res.statusText}`)
    }
    return out as T
  })
}

function signedInTo(tokens: OAuthTokens, realm: string) {
  const signed = tokens.extra?.realmId
  if (signed && signed !== realm)
    throw new Problem(
      `This sign-in is for company ${signed}, not ${realm}: connect each company on its own.`,
      'sign_in',
    )
}

// Every row of one entity, a page of a thousand at a time.
async function all(c: Call, entity: string): Promise<Q[]> {
  const out: Q[] = []
  for (let start = 1; ; start += PAGE) {
    const q = `select * from ${entity} startposition ${start} maxresults ${PAGE}`
    const page = ((await api(c, 'query', '/query', { query: { query: q } })).QueryResponse?.[
      entity
    ] ?? []) as Q[]
    out.push(...page)
    if (page.length < PAGE) return out
  }
}

// What changed since, by entity; null when a change list is full (a thousand, CDC's most),
// so the whole entity is read instead.
async function changed(c: Call, since: string): Promise<Record<string, Q[]>> {
  const out = await api(c, 'cdc', '/cdc', {
    query: { entities: ENTITIES.map((e) => e.entity).join(','), changedSince: since },
  })
  const by: Record<string, Q[]> = {}
  for (const resp of (out.CDCResponse?.[0]?.QueryResponse ?? []) as Q[])
    for (const [k, v] of Object.entries(resp)) if (Array.isArray(v)) by[k] = v as Q[]
  return by
}

function monthsAgo(n: number, now = new Date()): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - n, 1))
    .toISOString()
    .slice(0, 10)
}

const short = (v: string, n = 60) => (v.length > n ? `${v.slice(0, n - 1)}…` : v)
const sum = (xs: { amount: number }[]) => Math.round(xs.reduce((a, x) => a + x.amount, 0) * 100)
const amount = z.number().positive()
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

const MIME: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.csv': 'text/csv',
  '.txt': 'text/plain',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
}

export const quickbooks: Connector = {
  manifest: {
    name: 'quickbooks',
    title: 'QuickBooks',
    auth: 'oauth',
    icon: 'plug',
    setup: { sub: 'So Alpha can read your books and make the entries you say yes to' },
    account: { label: 'Company ID', placeholder: '9130 3570 1234 5678, or sandbox:<ID>' },
    oauth: {
      ...INTUIT,
      help: 'Make an app at developer.intuit.com with the Accounting scope, add Alpha’s address as its redirect, and type its client ID and secret here. Alpha keeps them, and the sign-in, in your Mac’s Keychain.',
      url: 'https://developer.intuit.com/app/developer/dashboard',
    },
    warning:
      'Alpha has no Intuit app of its own yet: you connect through an app you make in your own Intuit developer account. Entries Alpha makes go straight into your books, skipping the bank feed’s For Review.',
    pace: { perMinute: 500 },
    syncEveryMinutes: 60,
  },
  guide: readFileSync(new URL('../GUIDE.md', import.meta.url), 'utf8'),
  module: 'Accounting',
  tables: [COMPANIES, ...ENTITIES.map((e) => e.table), REPORT_ROWS],
  tools: {
    query: defineTool({
      description:
        'Run a QuickBooks query (select only), for what the tables do not keep: Item, Class, Department, TaxCode, Term, Estimate. Example: select Id, Name from Item where Active = true.',
      input: { query: z.string() },
      effect: 'read',
      words: ({ query }) => `Looked in QuickBooks: “${short(query)}”`,
      run: async (c, { query }) => {
        if (!/^\s*select\b/i.test(query)) throw new Problem('Only a select can be run.')
        return (await api(c, 'query', '/query', { query: { query } })).QueryResponse ?? {}
      },
    }),
    recategorize: defineTool({
      description:
        'Move one line of an expense (Purchase) or a Bill to another account. line is the line’s id as the Lines field shows it; account is the account’s QuickBooks ID.',
      input: {
        kind: z.enum(['Purchase', 'Bill']),
        id: z.string(),
        line: z.string(),
        account: z.string(),
        account_name: z.string().optional(),
      },
      effect: 'write',
      preview: (i) => ({
        words: `Move line ${i.line} of ${i.kind.toLowerCase()} ${i.id} to ${i.account_name ?? `account ${i.account}`}`,
        yes: 'Move it',
      }),
      words: (i) =>
        `Moved a ${i.kind.toLowerCase()} line to ${i.account_name ?? 'another account'}`,
      run: async (c, i) => {
        const path = `/${i.kind.toLowerCase()}`
        const e = (await api(c, 'read', `${path}/${i.id}`))[i.kind] as Q
        const lines = ((e.Line ?? []) as Q[]).map((l) => {
          if (String(l.Id) !== i.line) return l
          if (l.DetailType !== 'AccountBasedExpenseLineDetail')
            throw new Problem('That line is for an item; its account comes from the item.')
          return {
            ...l,
            AccountBasedExpenseLineDetail: {
              ...l.AccountBasedExpenseLineDetail,
              AccountRef: { value: i.account },
            },
          }
        })
        if (!lines.some((l) => String(l.Id) === i.line))
          throw new Problem(`That ${i.kind.toLowerCase()} has no line ${i.line}.`, 'gone')
        // a sparse update replaces the whole list of lines, so every line goes back
        const body = { Id: e.Id, SyncToken: e.SyncToken, sparse: true, Line: lines }
        const out = await api(c, 'recategorize', path, { method: 'POST', json: body })
        return { moved: true, id: out[i.kind]?.Id, syncToken: out[i.kind]?.SyncToken }
      },
    }),
    'create-invoice': defineTool({
      description:
        'Make an invoice in QuickBooks (not sent: send-invoice sends it). customer is the customer’s QuickBooks ID; each line names an item’s ID (query Item to find them).',
      input: {
        customer: z.string(),
        customer_name: z.string().optional(),
        lines: z
          .array(z.object({ item: z.string(), amount, description: z.string().optional() }))
          .min(1),
        date: date.optional(),
        due_date: date.optional(),
        number: z.string().optional(),
        email: z.string().email().optional(),
      },
      effect: 'write',
      preview: (i) => ({
        words: `Make an invoice for ${i.customer_name ?? `customer ${i.customer}`}: ${(sum(i.lines) / 100).toFixed(2)}`,
        detail: i.lines
          .map((l) => `${l.amount.toFixed(2)}  ${l.description ?? `item ${l.item}`}`)
          .join('\n'),
        yes: 'Make it',
      }),
      words: (i) => `Made an invoice for ${i.customer_name ?? 'a customer'}`,
      run: async (c, i) => {
        const body = {
          CustomerRef: { value: i.customer },
          Line: i.lines.map((l) => ({
            DetailType: 'SalesItemLineDetail',
            Amount: l.amount,
            ...(l.description ? { Description: l.description } : {}),
            SalesItemLineDetail: { ItemRef: { value: l.item } },
          })),
          ...(i.date ? { TxnDate: i.date } : {}),
          ...(i.due_date ? { DueDate: i.due_date } : {}),
          ...(i.number ? { DocNumber: i.number } : {}),
          ...(i.email ? { BillEmail: { Address: i.email } } : {}),
        }
        const out = await api(c, 'create-invoice', '/invoice', { method: 'POST', json: body })
        return { id: out.Invoice?.Id, number: out.Invoice?.DocNumber, total: out.Invoice?.TotalAmt }
      },
    }),
    'create-bill': defineTool({
      description:
        'Enter a bill from a vendor. vendor is the vendor’s QuickBooks ID; each line names an expense account’s ID.',
      input: {
        vendor: z.string(),
        vendor_name: z.string().optional(),
        lines: z
          .array(z.object({ account: z.string(), amount, description: z.string().optional() }))
          .min(1),
        date: date.optional(),
        due_date: date.optional(),
        number: z.string().optional(),
      },
      effect: 'write',
      preview: (i) => ({
        words: `Enter a bill from ${i.vendor_name ?? `vendor ${i.vendor}`}: ${(sum(i.lines) / 100).toFixed(2)}`,
        detail: i.lines
          .map((l) => `${l.amount.toFixed(2)}  account ${l.account}  ${l.description ?? ''}`)
          .join('\n'),
        yes: 'Enter it',
      }),
      words: (i) => `Entered a bill from ${i.vendor_name ?? 'a vendor'}`,
      run: async (c, i) => {
        const body = {
          VendorRef: { value: i.vendor },
          Line: i.lines.map((l) => ({
            DetailType: 'AccountBasedExpenseLineDetail',
            Amount: l.amount,
            ...(l.description ? { Description: l.description } : {}),
            AccountBasedExpenseLineDetail: { AccountRef: { value: l.account } },
          })),
          ...(i.date ? { TxnDate: i.date } : {}),
          ...(i.due_date ? { DueDate: i.due_date } : {}),
          ...(i.number ? { DocNumber: i.number } : {}),
        }
        const out = await api(c, 'create-bill', '/bill', { method: 'POST', json: body })
        return { id: out.Bill?.Id, total: out.Bill?.TotalAmt }
      },
    }),
    'create-journal-entry': defineTool({
      description:
        'Make a journal entry. Its debits and credits must come to the same amount; each line names an account’s QuickBooks ID.',
      input: {
        lines: z
          .array(
            z.object({
              posting: z.enum(['Debit', 'Credit']),
              account: z.string(),
              amount,
              description: z.string().optional(),
            }),
          )
          .min(2),
        date: date.optional(),
        number: z.string().optional(),
        memo: z.string().optional(),
      },
      effect: 'write',
      preview: (i) => ({
        words: `Make a journal entry of ${(sum(i.lines.filter((l) => l.posting === 'Debit')) / 100).toFixed(2)}${i.memo ? `: ${short(i.memo)}` : ''}`,
        detail: i.lines
          .map(
            (l) =>
              `${l.posting}  ${l.amount.toFixed(2)}  account ${l.account}  ${l.description ?? ''}`,
          )
          .join('\n'),
        yes: 'Make it',
      }),
      words: () => 'Made a journal entry',
      run: async (c, i) => {
        const debits = sum(i.lines.filter((l) => l.posting === 'Debit'))
        const credits = sum(i.lines.filter((l) => l.posting === 'Credit'))
        if (debits !== credits)
          throw new Problem(
            `The debits (${(debits / 100).toFixed(2)}) and credits (${(credits / 100).toFixed(2)}) differ.`,
          )
        const body = {
          Line: i.lines.map((l) => ({
            DetailType: 'JournalEntryLineDetail',
            Amount: l.amount,
            ...(l.description ? { Description: l.description } : {}),
            JournalEntryLineDetail: { PostingType: l.posting, AccountRef: { value: l.account } },
          })),
          ...(i.date ? { TxnDate: i.date } : {}),
          ...(i.number ? { DocNumber: i.number } : {}),
          ...(i.memo ? { PrivateNote: i.memo } : {}),
        }
        const out = await api(c, 'create-journal-entry', '/journalentry', {
          method: 'POST',
          json: body,
        })
        return { id: out.JournalEntry?.Id }
      },
    }),
    'attach-file': defineTool({
      description:
        'Attach a file on this Mac (a receipt, a contract) to a transaction or a name in QuickBooks: kind is its entity (Purchase, Bill, Invoice, JournalEntry, Vendor, Customer), id its QuickBooks ID.',
      input: {
        path: z.string(),
        kind: z.enum([
          'Purchase',
          'Bill',
          'Invoice',
          'JournalEntry',
          'Payment',
          'Vendor',
          'Customer',
        ]),
        id: z.string(),
        note: z.string().optional(),
      },
      effect: 'write',
      preview: (i) => ({
        words: `Attach ${basename(i.path)} to ${i.kind.toLowerCase()} ${i.id}`,
        yes: 'Attach it',
      }),
      words: (i) => `Attached ${basename(i.path)} in QuickBooks`,
      run: async (c, i) => {
        const name = basename(i.path)
        const mime = MIME[extname(name).toLowerCase()] ?? 'application/octet-stream'
        const meta = {
          AttachableRef: [{ EntityRef: { type: i.kind, value: i.id } }],
          FileName: name,
          ContentType: mime,
          ...(i.note ? { Note: i.note } : {}),
        }
        const form = new FormData()
        form.append(
          'file_metadata_01',
          new Blob([JSON.stringify(meta)], { type: 'application/json' }),
          'attachment.json',
        )
        form.append('file_content_01', new Blob([readFileSync(i.path)], { type: mime }), name)
        const out = await api(c, 'attach-file', '/upload', {
          method: 'POST',
          form,
        })
        return { id: out.AttachableResponse?.[0]?.Attachable?.Id, name }
      },
    }),
    'send-invoice': defineTool({
      description:
        'Email an invoice to the customer from QuickBooks. email: to that address instead of the invoice’s own. It waits for the person’s yes on a card first.',
      input: {
        id: z.string(),
        number: z.string().optional(),
        email: z.string().email().optional(),
      },
      effect: 'outward',
      preview: (i) => ({
        words: `Send invoice ${i.number ?? i.id}${i.email ? ` to ${i.email}` : ' to its customer'}`,
        yes: 'Send it',
      }),
      words: (i) => `Sent invoice ${i.number ?? i.id}`,
      run: async (c, i) => {
        const out = await api(c, 'send-invoice', `/invoice/${i.id}/send`, {
          method: 'POST',
          body: '',
          ...(i.email ? { query: { sendTo: i.email } } : {}),
        })
        return {
          sent: true,
          id: i.id,
          to: out.Invoice?.BillEmail?.Address ?? i.email,
          status: out.Invoice?.EmailStatus,
        }
      },
    }),
  },
  check: async (c) => {
    const { realm } = company(c.host.account)
    await api(c, 'companyinfo', `/companyinfo/${realm}`)
  },
  // First every row of each entity; then what changed since the last sync (CDC looks back 30
  // days at most, so older than that, or a full change list, reads everything again). The
  // company and the four reports are read each time. The cursor is the shape and when it began.
  sync: async (c) => {
    const { realm } = company(c.host.account)
    const began = new Date().toISOString()
    const [shape, since] = (c.host.cursor() ?? '').split('|')
    const fresh = shape !== SHAPE || !since || Date.now() - Date.parse(since) > 29 * DAY
    const by = fresh ? null : await changed(c, since)
    let added = 0
    for (const entity of ENTITIES) {
      const list = by?.[entity.entity]
      const rows = by && (list?.length ?? 0) < PAGE ? (list ?? []) : await all(c, entity.entity)
      const items = rows
        .filter((e) => e.status !== 'Deleted')
        .map((e) => entityItem(realm, entity, e))
      added += c.host.land(entity.table.name, items).added
    }
    const info = await api(c, 'companyinfo', `/companyinfo/${realm}`)
    c.host.land(COMPANIES.name, [companyItem(realm, info.CompanyInfo ?? {})])
    const today = began.slice(0, 10)
    const reports: [keyof typeof REPORTS, Record<string, string>][] = [
      [
        'ProfitAndLoss',
        { start_date: monthsAgo(11), end_date: today, summarize_column_by: 'Month' },
      ],
      ['BalanceSheet', { date_macro: 'Today' }],
      ['AgedReceivables', { report_date: today }],
      ['AgedPayables', { report_date: today }],
    ]
    for (const [name, query] of reports) {
      const r = await api(c, 'report', `/reports/${name}`, { query })
      c.host.land(REPORT_ROWS.name, reportItems(realm, name, r))
    }
    c.host.setCursor(`${SHAPE}|${began}`)
    const rows = ENTITIES.reduce(
      (n, e) =>
        n + (c.host.keys?.(e.table.name).filter((k) => k.startsWith(`${realm}:`)).length ?? 0),
      0,
    )
    return { rows, sawNew: added > 0 }
  },
}

export const connector = quickbooks
