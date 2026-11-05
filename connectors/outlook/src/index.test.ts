// Outlook on made-up Microsoft Graph answers: never a real tenant. What Graph is asked, and how
// its answers become the Mail table's rows, a message's text and its files.
import { type Host, type Item, makeCall, Problem } from '@alpha/connector-sdk'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { outlook } from './index.ts'

const ME = 'test@bridge08.onmicrosoft.com'
const asked: { method: string; url: string; body?: unknown }[] = []
let answers: (
  url: URL,
  method: string,
  body: unknown,
) => { status?: number; json?: unknown; headers?: Record<string, string> }

beforeEach(() => {
  asked.length = 0
  vi.stubGlobal('fetch', async (input: string | URL, init?: RequestInit) => {
    const url = new URL(String(input))
    const method = init?.method ?? 'GET'
    const body = init?.body ? JSON.parse(String(init.body)) : undefined
    asked.push({ method, url: url.toString(), body })
    const a = answers(url, method, body)
    return new Response(JSON.stringify(a.json ?? {}), {
      status: a.status ?? 200,
      headers: { 'content-type': 'application/json', ...a.headers },
    })
  })
})
afterEach(() => vi.unstubAllGlobals())

function host(cursor: string | null = null) {
  const landed: { table: string; items: Item[] }[] = []
  const gone: { table: string; keys: string[]; by?: string | undefined }[] = []
  const h: Host & { now: string | null; landed: typeof landed; goneSaid: typeof gone } = {
    account: ME,
    now: cursor,
    landed,
    goneSaid: gone,
    secret: async () => 'short-lived',
    cursor: () => h.now,
    setCursor: (c) => {
      h.now = c
    },
    land: (table, items) => {
      landed.push({ table, items })
      return { added: items.length, changed: 0, same: 0 }
    },
    gone: (table, keys, options) => {
      gone.push({ table, keys, by: options?.by })
      return keys.length
    },
    journal: () => {},
  }
  return h
}
const call = (h: Host) =>
  makeCall(outlook.manifest, h, {
    judgements: { retries: 0, busyWaitMs: 60_000, fewerRowsRatio: 0.5, quietDays: 7 },
    sleep: async () => {},
  })

const message = (o: Record<string, unknown>) => ({
  id: 'AAMk1',
  internetMessageId: '<m1@harbor.example>',
  conversationId: 'conv1',
  subject: 'Harbor CIM',
  from: { emailAddress: { name: 'Priya', address: 'priya@harbor.example' } },
  toRecipients: [{ emailAddress: { name: 'Test', address: ME } }],
  ccRecipients: [],
  receivedDateTime: '2026-10-30T09:00:00Z',
  isRead: false,
  flag: { flagStatus: 'notFlagged' },
  hasAttachments: false,
  categories: [],
  ...o,
})

describe('reading the mail', () => {
  it('reads 90 days of Inbox and Sent Items into Mail, then only what changed', async () => {
    answers = (url, method, body) => {
      if (method === 'POST' && url.pathname.endsWith('/$batch'))
        return {
          json: {
            responses: (body as { requests: { id: string }[] }).requests.map((r) => ({
              id: r.id,
              status: 200,
              body: {
                value: [
                  { name: 'Harbor CIM.pdf', isInline: false },
                  { name: 'logo.png', isInline: true },
                ],
              },
            })),
          },
        }
      if (url.pathname.endsWith('/mailFolders/inbox')) return { json: { totalItemCount: 40 } }
      if (url.pathname.endsWith('/mailFolders/sentitems')) return { json: { totalItemCount: 2 } }
      if (
        url.searchParams.get('$deltatoken') === 'in2' ||
        url.searchParams.get('$deltatoken') === 'sent2'
      )
        return {
          json: {
            value: [{ id: 'AAMk1', '@removed': { reason: 'deleted' } }],
            '@odata.deltaLink': `${url.origin}${url.pathname}?$deltatoken=${url.searchParams.get('$deltatoken')}b`,
          },
        }
      if (url.pathname.includes('/mailFolders/inbox/messages/delta'))
        return url.searchParams.get('$skiptoken')
          ? {
              json: {
                value: [
                  message({
                    id: 'AAMk2',
                    internetMessageId: '<m2@grandbb.example>',
                    isRead: true,
                    flag: { flagStatus: 'flagged' },
                    from: { emailAddress: { name: 'Sam', address: 'sam@grandbb.example' } },
                    subject: 'Lunch?',
                  }),
                ],
                '@odata.deltaLink': `${url.origin}${url.pathname}?$deltatoken=in2`,
              },
            }
          : {
              json: {
                value: [message({ hasAttachments: true, categories: ['Deals'] })],
                '@odata.nextLink': `${url.origin}${url.pathname}?$skiptoken=page2`,
              },
            }
      if (url.pathname.includes('/mailFolders/sentitems/messages/delta'))
        return {
          json: {
            value: [
              message({
                id: 'AAMk3',
                internetMessageId: '<s1@bridge08.onmicrosoft.com>',
                from: { emailAddress: { name: 'Test', address: ME } },
                toRecipients: [
                  { emailAddress: { name: 'Priya', address: 'priya@harbor.example' } },
                ],
                ccRecipients: [{ emailAddress: { address: 'ann@harbor.example' } }],
                subject: 'Re: Harbor CIM',
                isRead: true,
              }),
            ],
            '@odata.deltaLink': `${url.origin}${url.pathname}?$deltatoken=sent2`,
          },
        }
      return { status: 404, json: { error: { message: `nothing at ${url.pathname}` } } }
    }
    const h = host()
    const out = await outlook.sync?.(call(h))
    expect(out).toEqual({ rows: 42, sawNew: true })
    // the first read goes back 90 days, newest first, with the token the core renewed
    const first = new URL(asked.find((a) => a.url.includes('/inbox/messages/delta'))?.url ?? '')
    expect(first.searchParams.get('$filter')).toMatch(/^receivedDateTime ge 20\d\d-\d\d-\d\dT/)
    const rows = h.landed.flatMap((l) => l.items)
    expect(h.landed.every((l) => l.table === 'Mail')).toBe(true)
    expect(rows.map((r) => r.key)).toEqual([
      '<m1@harbor.example>',
      '<m2@grandbb.example>',
      '<s1@bridge08.onmicrosoft.com>',
    ])
    expect(rows[0]?.values).toEqual({
      From: 'Priya <priya@harbor.example>',
      'From address': 'priya@harbor.example',
      To: `Test <${ME}>`,
      Cc: '',
      Subject: 'Harbor CIM',
      Date: '2026-10-30T09:00:00.000Z',
      Labels: 'Inbox, Deals',
      Thread: 'conv1',
      'Message ID': '<m1@harbor.example>',
      Direction: 'received',
      'To addresses': ME,
      'Cc addresses': '',
      Attachments: 'Harbor CIM.pdf',
      Unread: 'yes',
      Starred: 'no',
      'Outlook ID': 'AAMk1',
    })
    expect(rows[1]?.values).toMatchObject({ Unread: 'no', Starred: 'yes', Attachments: '' })
    expect(rows[2]?.values).toMatchObject({
      Direction: 'sent',
      Labels: 'Sent Items',
      'To addresses': 'priya@harbor.example',
      Cc: 'ann@harbor.example',
      'Cc addresses': 'ann@harbor.example',
    })
    // the next read starts where Graph said, and a deleted message is not a new row
    asked.length = 0
    const again = await outlook.sync?.(call(h))
    expect(again).toEqual({ rows: 42, sawNew: false })
    expect(asked.some((a) => a.url.includes('$deltatoken=in2'))).toBe(true)
    expect(asked.some((a) => a.url.includes('$deltatoken=sent2'))).toBe(true)
    expect(h.landed.at(-1)?.items).toEqual([])
    // and is said gone, by the id Outlook keeps for it (rules D8)
    expect(h.goneSaid).toEqual([{ table: 'Mail', keys: ['AAMk1'], by: 'Outlook ID' }])
    expect(JSON.parse(h.now ?? '{}').inbox).toMatch(/\$deltatoken=in2b$/)
  })
})

describe('a message, its text and its files', () => {
  it('reads one message by its Message ID, as text', async () => {
    answers = (url) => {
      if (url.pathname.endsWith('/me/messages') && url.searchParams.get('$filter'))
        return {
          json: {
            value: [
              message({
                body: { contentType: 'text', content: 'Hi, the CIM is attached.' },
                hasAttachments: true,
              }),
            ],
          },
        }
      if (url.pathname.endsWith('/attachments'))
        return { json: { value: [{ name: 'Harbor CIM.pdf', isInline: false }] } }
      return { status: 404 }
    }
    const out = await outlook.tools.read?.run(call(host()), { message: '<m1@harbor.example>' })
    expect(new URL(asked[0]?.url ?? '').searchParams.get('$filter')).toBe(
      "internetMessageId eq '<m1@harbor.example>'",
    )
    expect(out).toEqual({
      from: 'Priya <priya@harbor.example>',
      to: `Test <${ME}>`,
      subject: 'Harbor CIM',
      date: '2026-10-30T09:00:00.000Z',
      text: 'Hi, the CIM is attached.',
      attachments: ['Harbor CIM.pdf'],
    })
  })

  it('fetches a message’s files, and says when it is not in this mailbox', async () => {
    answers = (url) => {
      if (url.pathname.endsWith('/me/messages'))
        return {
          json: {
            value: url.searchParams.get('$filter')?.includes('m1@') ? [{ id: 'AAMk1' }] : [],
          },
        }
      if (url.pathname.endsWith('/AAMk1/attachments'))
        return {
          json: {
            value: [
              {
                '@odata.type': '#microsoft.graph.fileAttachment',
                name: 'Harbor CIM.pdf',
                contentType: 'application/pdf',
                contentBytes: Buffer.from('%PDF').toString('base64'),
                isInline: false,
              },
              {
                '@odata.type': '#microsoft.graph.itemAttachment',
                name: 'Forwarded',
                isInline: false,
              },
            ],
          },
        }
      return { status: 404 }
    }
    const files = await outlook.files?.fetch(call(host()), '<m1@harbor.example>')
    expect(files?.map((f) => [f.name, f.mime, Buffer.from(f.bytes).toString(), f.inline])).toEqual([
      ['Harbor CIM.pdf', 'application/pdf', '%PDF', false],
    ])
    await expect(outlook.files?.fetch(call(host()), '<gone@x>')).rejects.toThrow(
      /not in this mailbox/,
    )
  })
})

describe('what Microsoft says back', () => {
  it('asks the person to sign in as the account this connection is for', async () => {
    answers = () => ({
      json: {
        mail: 'kenil@bridge08.onmicrosoft.com',
        userPrincipalName: 'kenil@bridge08.onmicrosoft.com',
      },
    })
    await expect(outlook.check?.(call(host()))).rejects.toThrow(/sign in again as test@bridge08/)
  })

  it('a sign-in Microsoft no longer takes needs the person; too many requests is waited out', async () => {
    answers = () => ({ status: 401, json: { error: { message: 'Lifetime validation failed.' } } })
    const err = await outlook.check?.(call(host())).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(Problem)
    expect((err as Problem).kind).toBe('sign_in')
    let tries = 0
    answers = () =>
      ++tries === 1
        ? {
            status: 429,
            json: { error: { message: 'Too many requests' } },
            headers: { 'retry-after': '3' },
          }
        : { json: { mail: ME } }
    await outlook.check?.(call(host()))
    expect(tries).toBe(2)
  })
})
