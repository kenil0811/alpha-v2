// QuickBooks against Intuit's recorded answers (fixtures/): never the real API. fetch is stood in
// for, and every request it was asked to make is kept, to read its address and body.
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { checkConnector, type Host, type Item, makeCall } from '@alpha/connector-sdk'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { quickbooks } from './index.ts'
import { reportItems } from './rows.ts'

const fixture = (name: string) =>
  JSON.parse(readFileSync(new URL(`../fixtures/${name}.json`, import.meta.url), 'utf8'))
const REQUESTS = fixture('requests')
const REALM = '9130357012345678'
const judgements = { retries: 2, fewerRowsRatio: 0.5, quietDays: 7 }

interface Sent {
  url: URL
  method: string
  headers: Record<string, string>
  body: unknown
}
let sent: Sent[]
let answer: (s: Sent) => { status?: number; json: unknown }

beforeEach(() => {
  sent = []
  vi.stubGlobal('fetch', async (input: string | URL, init: RequestInit = {}) => {
    const s: Sent = {
      url: new URL(String(input)),
      method: init.method ?? 'GET',
      headers: (init.headers ?? {}) as Record<string, string>,
      body: init.body,
    }
    sent.push(s)
    const a = answer(s)
    return new Response(JSON.stringify(a.json), { status: a.status ?? 200 })
  })
})
afterEach(() => vi.unstubAllGlobals())

const live = (refresh = 'refresh-1', expiresAt = Date.now() + 3_600_000) =>
  JSON.stringify({
    clientId: 'client',
    clientSecret: 'shh',
    refreshToken: refresh,
    accessToken: 'access-1',
    expiresAt,
    extra: { realmId: REALM },
  })

function host(over: Partial<Host> = {}) {
  const landed: Record<string, Item[]> = {}
  let secret = live()
  let cursor: string | null = null
  const h: Host = {
    account: REALM,
    secret: async () => secret,
    setSecret: async (s) => {
      secret = s
    },
    cursor: () => cursor,
    setCursor: (c) => {
      cursor = c
    },
    land: (table, items) => {
      landed[table] = [...(landed[table] ?? []), ...items]
      return { added: items.length, changed: 0, same: 0 }
    },
    keys: (table) => (landed[table] ?? []).map((i) => i.key),
    journal: () => {},
    ...over,
  }
  return { h, landed, secret: () => secret }
}

const call = (h: Host) => makeCall(quickbooks.manifest, h, { judgements, sleep: async () => {} })

// The company's answers by address: a query by its entity, the change list, a report by name.
function books(s: Sent): { status?: number; json: unknown } {
  const p = s.url.pathname
  if (p.endsWith('/query')) {
    const q = s.url.searchParams.get('query') ?? ''
    if (q.includes('from Invoice')) return { json: fixture('query-invoice') }
    if (q.includes('from Vendor')) return { json: fixture('query-vendor') }
    return { json: { QueryResponse: {} } }
  }
  if (p.endsWith('/cdc')) return { json: fixture('cdc') }
  if (p.includes('/companyinfo/')) return { json: fixture('companyinfo') }
  if (p.endsWith('/reports/ProfitAndLoss')) return { json: fixture('report-profit-and-loss') }
  if (p.includes('/reports/')) return { json: { Header: { Currency: 'USD' }, Rows: {} } }
  return { status: 404, json: { Fault: { Error: [{ Message: `nothing at ${p}` }] } } }
}

describe('the QuickBooks connector', () => {
  it('passes the SDK’s check', () => {
    expect(checkConnector(quickbooks)).toEqual([])
  })

  it('reads every row on its first sync, a page of a thousand at a time', async () => {
    const { h, landed } = host()
    answer = (s) => {
      const q = s.url.searchParams.get('query') ?? ''
      if (q.includes('from Customer')) {
        const start = Number(/startposition (\d+)/.exec(q)?.[1])
        const n = start === 1 ? 1000 : 3
        return {
          json: {
            QueryResponse: {
              Customer: Array.from({ length: n }, (_, i) => ({
                Id: String(start + i),
                DisplayName: `C${start + i}`,
              })),
            },
          },
        }
      }
      return books(s)
    }
    const out = await quickbooks.sync?.(call(h))
    expect(sent.every((s) => s.url.host === 'quickbooks.api.intuit.com')).toBe(true)
    expect(sent.every((s) => s.headers.Authorization === 'Bearer access-1')).toBe(true)
    expect(sent.every((s) => s.url.searchParams.get('minorversion') === '75')).toBe(true)
    expect(landed.Customers).toHaveLength(1003)
    expect(landed.Invoices?.[0]).toEqual({
      key: `${REALM}:Invoice:130`,
      values: {
        Company: REALM,
        'QuickBooks ID': '130',
        Number: '1037',
        Customer: 'Sonnenschein Family Store',
        Date: '2026-10-03',
        'Due date': '2026-11-02',
        Total: { amount: 362.07, currency: 'USD' },
        Balance: { amount: 362.07, currency: 'USD' },
        'Email status': 'NotSet',
        'Bill email': 'Familiystore@intuit.com',
        Lines:
          '1: Rock Fountain (item 5) 275 — Rock Fountain\n2: Pump (item 11) 12.75 — Fountain Pump',
      },
    })
    // an empty email is no value; the 1099 flag is kept
    expect(landed.Vendors?.[0]?.values).toMatchObject({ '1099': 'yes', Phone: '(973) 555-3827' })
    expect(landed.Vendors?.[0]?.values).not.toHaveProperty('Email')
    expect(landed.Companies?.[0]?.values.Name).toBe("Craig's Design and Landscaping Services")
    expect(landed['Report rows']?.length).toBeGreaterThan(0)
    expect(h.cursor()).toMatch(/^v1\|\d{4}-/)
    expect(out).toEqual({ rows: 1003 + 2, sawNew: true })
  })

  it('reads only what changed when it last read within 30 days, and leaves deleted rows', async () => {
    const { h, landed } = host()
    h.setCursor(`v1|${new Date(Date.now() - 2 * 86_400_000).toISOString()}`)
    answer = books
    await quickbooks.sync?.(call(h))
    expect(sent.some((s) => s.url.pathname.endsWith('/query'))).toBe(false)
    const cdc = sent.find((s) => s.url.pathname.endsWith('/cdc'))
    expect(cdc?.url.searchParams.get('entities')).toBe(
      'Account,Customer,Vendor,Invoice,Bill,Payment,Purchase,JournalEntry',
    )
    expect(landed.Invoices?.map((i) => i.key)).toEqual([`${REALM}:Invoice:130`])
    expect(landed.Payments?.[0]?.values['Applied to']).toBe('Invoice 130')
  })

  it('reads everything again when it last read over 30 days ago', async () => {
    const { h } = host()
    h.setCursor(`v1|${new Date(Date.now() - 40 * 86_400_000).toISOString()}`)
    answer = books
    await quickbooks.sync?.(call(h))
    expect(sent.some((s) => s.url.pathname.endsWith('/cdc'))).toBe(false)
    expect(sent.filter((s) => s.url.pathname.endsWith('/query'))).toHaveLength(8)
  })

  it('lands a monthly report a row per line and month', () => {
    const rows = reportItems(REALM, 'ProfitAndLoss', fixture('report-profit-and-loss'))
    expect(
      rows.find((r) => r.values.Row === 'Landscaping Services' && r.values.Period === '2026-09'),
    ).toEqual({
      key: `${REALM}:ProfitAndLoss:Income › Landscaping Services:Sep 2026`,
      values: {
        Company: REALM,
        Report: 'Profit and loss',
        Section: 'Income',
        Row: 'Landscaping Services',
        Column: 'Sep 2026',
        Period: '2026-09',
        Amount: { amount: 1200, currency: 'USD' },
        Total: 'no',
      },
    })
    const net = rows.find((r) => r.values.Row === 'Net Income' && r.values.Column === 'Oct 2026')
    expect(net?.values).toMatchObject({ Amount: { amount: -64.5, currency: 'USD' }, Total: 'yes' })
    // an empty cell is no row
    expect(rows.filter((r) => r.values.Row === 'Landscaping Services')).toHaveLength(2)
  })

  it('waits and tries again when QuickBooks says too many calls (429)', async () => {
    const { h } = host()
    let n = 0
    answer = (s) =>
      ++n === 1
        ? { status: 429, json: { Fault: { Error: [{ Message: 'ThrottleExceeded' }] } } }
        : books(s)
    await quickbooks.check?.(call(h))
    expect(sent).toHaveLength(2)
    expect(sent[1]?.url.pathname).toBe(`/v3/company/${REALM}/companyinfo/${REALM}`)
  })

  it('refreshes a lapsed sign-in and keeps the rotated refresh token', async () => {
    const { h, secret } = host()
    await h.setSecret?.(live('refresh-1', Date.now() - 1000))
    answer = (s) =>
      s.url.host === 'oauth.platform.intuit.com' ? { json: fixture('token') } : books(s)
    await quickbooks.check?.(call(h))
    const token = sent[0]
    expect(token?.url.toString()).toBe('https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer')
    expect(token?.headers.Authorization).toBe(
      `Basic ${Buffer.from('client:shh').toString('base64')}`,
    )
    expect(String(token?.body)).toBe('grant_type=refresh_token&refresh_token=refresh-1')
    expect(sent[1]?.headers.Authorization).toBe('Bearer access-2')
    const kept = JSON.parse(secret())
    expect(kept).toMatchObject({
      refreshToken: 'refresh-2',
      accessToken: 'access-2',
      extra: { realmId: REALM },
    })
    expect(kept.expiresAt).toBeGreaterThan(Date.now() + 3_000_000)
    // the next call uses the kept token, no second refresh
    await quickbooks.check?.(call(h))
    expect(sent.filter((s) => s.url.host === 'oauth.platform.intuit.com')).toHaveLength(1)
  })

  it('will not refresh where the newest token could not be kept', async () => {
    const { h } = host()
    delete h.setSecret
    const lapsed = live('refresh-1', Date.now() - 1000)
    await expect(quickbooks.check?.(call({ ...h, secret: async () => lapsed }))).rejects.toThrow(
      /cannot keep/,
    )
    expect(sent).toHaveLength(0)
  })

  it('refuses a sign-in for another company', async () => {
    const { h } = host({ account: '123' })
    answer = books
    await expect(quickbooks.check?.(call(h))).rejects.toThrow(/connect each company on its own/)
  })
})

describe('its writes', () => {
  const run = async (tool: string, input: Record<string, unknown>) => {
    const t = quickbooks.tools[tool]
    if (!t) throw new Error(`no tool ${tool}`)
    return t.run(call(host().h), input)
  }
  const posted = () => sent.filter((s) => s.method === 'POST')
  const body = (s: Sent | undefined) => JSON.parse(String(s?.body))

  it('declare their effects; only sending an invoice reaches someone', () => {
    const effects = Object.fromEntries(
      Object.entries(quickbooks.tools).map(([k, t]) => [k, t.effect]),
    )
    expect(effects).toEqual({
      query: 'read',
      recategorize: 'write',
      'create-invoice': 'write',
      'create-bill': 'write',
      'create-journal-entry': 'write',
      'attach-file': 'write',
      'send-invoice': 'outward',
    })
    for (const [name, t] of Object.entries(quickbooks.tools))
      if (t.effect !== 'read') expect(t.preview, name).toBeTypeOf('function')
  })

  it('recategorize sends every line back with the one line moved, and the SyncToken', async () => {
    answer = (s) =>
      s.method === 'GET'
        ? { json: fixture('purchase') }
        : { json: { Purchase: { Id: '252', SyncToken: '3' } } }
    const out = await run('recategorize', { kind: 'Purchase', id: '252', line: '1', account: '15' })
    expect(sent[0]?.url.pathname).toBe(`/v3/company/${REALM}/purchase/252`)
    expect(posted()[0]?.url.pathname).toBe(`/v3/company/${REALM}/purchase`)
    expect(body(posted()[0])).toEqual(REQUESTS.recategorize)
    expect(posted()[0]?.url.searchParams.get('requestid')).toMatch(/^[0-9a-f-]{36}$/)
    expect(out).toEqual({ moved: true, id: '252', syncToken: '3' })
  })

  it('create-invoice, create-bill and create-journal-entry post Intuit’s shapes', async () => {
    answer = () => ({
      json: { Invoice: { Id: '140' }, Bill: { Id: '141' }, JournalEntry: { Id: '142' } },
    })
    await run('create-invoice', {
      customer: '58',
      lines: [{ item: '5', amount: 275, description: 'Rock Fountain' }],
      date: '2026-11-02',
      due_date: '2026-12-02',
      email: 'familystore@example.com',
    })
    await run('create-bill', {
      vendor: '41',
      lines: [{ account: '17', amount: 900, description: 'November rent' }],
      due_date: '2026-11-30',
      number: 'R-11',
    })
    await run('create-journal-entry', {
      lines: [
        { posting: 'Debit', account: '64', amount: 100.1 },
        { posting: 'Credit', account: '35', amount: 100.1, description: "Owner's draw" },
      ],
      date: '2026-10-31',
      memo: 'Month-end',
    })
    const [inv, bill, je] = posted()
    expect(inv?.url.pathname.endsWith('/invoice')).toBe(true)
    expect(body(inv)).toEqual(REQUESTS['create-invoice'])
    expect(bill?.url.pathname.endsWith('/bill')).toBe(true)
    expect(body(bill)).toEqual(REQUESTS['create-bill'])
    expect(je?.url.pathname.endsWith('/journalentry')).toBe(true)
    expect(body(je)).toEqual(REQUESTS['create-journal-entry'])
  })

  it('a journal entry whose debits and credits differ is never sent', async () => {
    await expect(
      run('create-journal-entry', {
        lines: [
          { posting: 'Debit', account: '64', amount: 100 },
          { posting: 'Credit', account: '35', amount: 99.99 },
        ],
      }),
    ).rejects.toThrow(/differ/)
    expect(sent).toHaveLength(0)
  })

  it('attach-file uploads the file with its metadata as Intuit’s two parts', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'alpha-qbo-'))
    try {
      const path = join(dir, 'receipt.pdf')
      writeFileSync(path, '%PDF-1.4 receipt')
      answer = () => ({ json: { AttachableResponse: [{ Attachable: { Id: '5000' } }] } })
      const out = await run('attach-file', {
        path,
        kind: 'Purchase',
        id: '252',
        note: 'Staples receipt',
      })
      const form = posted()[0]?.body as FormData
      expect(posted()[0]?.url.pathname).toBe(`/v3/company/${REALM}/upload`)
      expect(JSON.parse(await (form.get('file_metadata_01') as Blob).text())).toEqual(
        REQUESTS['attach-file'],
      )
      const file = form.get('file_content_01') as File
      expect([file.name, file.type, await file.text()]).toEqual([
        'receipt.pdf',
        'application/pdf',
        '%PDF-1.4 receipt',
      ])
      expect(out).toEqual({ id: '5000', name: 'receipt.pdf' })
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('send-invoice posts to the invoice’s send address, to the address asked', async () => {
    answer = () => ({
      json: { Invoice: { Id: '130', EmailStatus: 'EmailSent', BillEmail: { Address: 'a@b.co' } } },
    })
    const out = await run('send-invoice', { id: '130', email: 'a@b.co' })
    const s = posted()[0]
    expect(s?.url.pathname).toBe(`/v3/company/${REALM}/invoice/130/send`)
    expect(s?.url.searchParams.get('sendTo')).toBe('a@b.co')
    expect(s?.headers['Content-Type']).toBe('application/octet-stream')
    expect(out).toEqual({ sent: true, id: '130', to: 'a@b.co', status: 'EmailSent' })
  })

  it('query runs a select and nothing else', async () => {
    answer = () => ({ json: { QueryResponse: { Item: [{ Id: '5', Name: 'Rock Fountain' }] } } })
    expect(await run('query', { query: 'select Id, Name from Item' })).toEqual({
      Item: [{ Id: '5', Name: 'Rock Fountain' }],
    })
    await expect(run('query', { query: 'delete from Item' })).rejects.toThrow(/Only a select/)
  })
})
