// Gmail by IMAP and SMTP with an app password (design §8, decision 10). Headers of the last 90
// days land in the Mail table; a message's body is read when asked. A draft is saved in the
// person's own Drafts (a write: it goes nowhere); a send leaves their world and waits on a card.
import { readFileSync } from 'node:fs'
import { type Call, type Connector, defineTool, Problem } from '@alpha/connector-sdk'
import { type FetchMessageObject, ImapFlow, type MessageStructureObject } from 'imapflow'
import { simpleParser } from 'mailparser'
import nodemailer from 'nodemailer'
import MailComposer from 'nodemailer/lib/mail-composer/index.js'
import { z } from 'zod'

const DAY = 86_400_000
const BATCH = 200

export interface Header {
  id: string // the Message-ID, else Gmail's own id
  thread: string
  from: string
  fromAddress: string
  to: string
  cc: string
  subject: string
  date: string
  labels: string
  direction?: 'sent' | 'received'
  toAddresses?: string // each address on its own, so they can become people
  ccAddresses?: string
  attachments?: string // the files' names
  unread?: boolean
  starred?: boolean
}

// What changed about a message already kept: only its unread and starred marks.
export interface Marks {
  id: string
  unread: boolean
  starred: boolean
}

// The shape of what a sync keeps; a newer shape reads the 90 days again so older mail has it too.
const SHAPE = 'v2'

async function secret(c: Call): Promise<string> {
  const s = await c.host.secret()
  if (!s) throw new Problem('Gmail needs its app password again.', 'sign_in')
  return s
}

async function withImap<T>(c: Call, fn: (client: ImapFlow) => Promise<T>): Promise<T> {
  const client = new ImapFlow({
    host: 'imap.gmail.com',
    port: 993,
    secure: true,
    auth: { user: c.host.account, pass: await secret(c) },
    logger: false,
  })
  try {
    await client.connect()
  } catch (err) {
    const words = err instanceof Error ? err.message : String(err)
    if (
      /auth|credential|invalid|login/i.test(words) ||
      (err as { authenticationFailed?: boolean }).authenticationFailed
    )
      throw new Problem(
        'Gmail did not accept the app password: make a new one and connect again.',
        'sign_in',
      )
    throw err
  }
  try {
    return await fn(client)
  } finally {
    await client.logout().catch(() => undefined)
  }
}

async function mailbox(client: ImapFlow, use: '\\All' | '\\Drafts'): Promise<string> {
  const found = (await client.list()).find((m) => m.specialUse === use)
  if (!found)
    throw new Problem(
      `This Gmail account has no ${use === '\\All' ? 'All Mail' : 'Drafts'} folder over IMAP.`,
    )
  return found.path
}

// Only the values a message has: a recorded answer from an older shape lacks the newer ones.
function defined(values: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(values).filter(([, v]) => v !== undefined))
}

function addresses(
  list: { name?: string | undefined; address?: string | undefined }[] | undefined,
): string {
  return (list ?? [])
    .map((a) => (a.name ? `${a.name} <${a.address ?? ''}>` : (a.address ?? '')))
    .join(', ')
}

function plain(list: { address?: string | undefined }[] | undefined): string {
  return (list ?? [])
    .map((a) => a.address ?? '')
    .filter(Boolean)
    .join(', ')
}

// The names of the files a message carries, from its structure (no download).
function attachmentNames(node: MessageStructureObject | undefined, out: string[] = []): string[] {
  if (!node) return out
  const name = node.dispositionParameters?.filename ?? node.parameters?.name
  if (
    name &&
    (node.disposition === 'attachment' ||
      node.disposition === 'inline' ||
      !node.type.startsWith('text/'))
  )
    out.push(name)
  for (const child of node.childNodes ?? []) attachmentNames(child, out)
  return out
}

function header(m: FetchMessageObject, account: string): Header {
  const e = m.envelope
  const labels = [...(m.labels ?? [])]
  const from = e?.from?.[0]?.address ?? ''
  const sent = labels.includes('\\Sent') || from.toLowerCase() === account.toLowerCase()
  return {
    id: e?.messageId || m.emailId || String(m.uid),
    thread: m.threadId ?? '',
    from: addresses(e?.from),
    fromAddress: from,
    to: addresses(e?.to),
    cc: addresses(e?.cc),
    subject: e?.subject ?? '',
    date: new Date(e?.date ?? m.internalDate ?? Date.now()).toISOString(),
    labels: labels.filter((l) => !l.startsWith('\\')).join(', '),
    direction: sent ? 'sent' : 'received',
    toAddresses: plain(e?.to),
    ccAddresses: plain(e?.cc),
    attachments: attachmentNames(m.bodyStructure).join(', '),
    unread: !(m.flags?.has('\\Seen') ?? false),
    starred: m.flags?.has('\\Flagged') ?? false,
  }
}

async function headers(
  client: ImapFlow,
  uids: number[],
  account: string,
): Promise<{ uid: number; header: Header }[]> {
  const out: { uid: number; header: Header }[] = []
  for (let i = 0; i < uids.length; i += BATCH) {
    const range = uids.slice(i, i + BATCH).join(',')
    for await (const m of client.fetch(
      range,
      {
        envelope: true,
        uid: true,
        threadId: true,
        emailId: true,
        labels: true,
        internalDate: true,
        flags: true,
        bodyStructure: true,
      },
      { uid: true },
    ))
      out.push({ uid: m.uid, header: header(m, account) })
  }
  return out
}

const Message = {
  to: z.string(),
  cc: z.string().optional(),
  subject: z.string(),
  body: z.string(),
  in_reply_to: z.string().optional(), // the Message-ID it answers
}

function compose(
  from: string,
  m: {
    to: string
    cc?: string | undefined
    subject: string
    body: string
    in_reply_to?: string | undefined
  },
) {
  return {
    from,
    to: m.to,
    ...(m.cc ? { cc: m.cc } : {}),
    subject: m.subject,
    text: m.body,
    ...(m.in_reply_to ? { inReplyTo: m.in_reply_to, references: m.in_reply_to } : {}),
  }
}

const short = (v: string, n = 80) => (v.length > n ? `${v.slice(0, n - 1)}…` : v)

const preview = (m: { to: string; cc?: string | undefined; subject: string; body: string }) => ({
  words: `Send an email to ${m.to}: “${m.subject}”`,
  detail: `To: ${m.to}${m.cc ? `\nCc: ${m.cc}` : ''}\nSubject: ${m.subject}\n\n${m.body}`,
  yes: 'Send it',
})

export const gmail: Connector = {
  manifest: {
    name: 'gmail',
    title: 'Gmail',
    auth: 'secret',
    icon: 'mail',
    setup: { sub: 'So Alpha can read your mail and send what you say yes to' },
    account: { label: 'Gmail address', placeholder: 'you@gmail.com' },
    secret: {
      label: 'App password',
      help: 'With 2-Step Verification on, make an app password for Alpha in your Google account and paste it here. Alpha keeps it in your Mac’s Keychain.',
      url: 'https://myaccount.google.com/apppasswords',
    },
    pace: { perMinute: 60 },
    syncEveryMinutes: 10,
  },
  guide: readFileSync(new URL('../GUIDE.md', import.meta.url), 'utf8'),
  module: 'Mail',
  tables: [
    {
      name: 'Mail',
      fields: [
        { name: 'From', kind: 'text' },
        { name: 'From address', kind: 'email' },
        { name: 'To', kind: 'text' },
        { name: 'Cc', kind: 'text' },
        { name: 'Subject', kind: 'text' },
        { name: 'Date', kind: 'date' },
        { name: 'Labels', kind: 'text' },
        { name: 'Thread', kind: 'text' },
        { name: 'Message ID', kind: 'text' },
        { name: 'Direction', kind: 'choice', choices: ['sent', 'received'] },
        { name: 'To addresses', kind: 'text' },
        { name: 'Cc addresses', kind: 'text' },
        { name: 'Attachments', kind: 'text' },
        { name: 'Unread', kind: 'choice', choices: ['yes', 'no'] },
        { name: 'Starred', kind: 'choice', choices: ['yes', 'no'] },
      ],
      // those the person writes to become their people; every message counts as contact
      people: {
        each: 'exchange',
        channel: 'mail',
        at: 'Date',
        from: 'From',
        to: ['To', 'Cc'],
        sent: { field: 'Direction', is: 'sent' },
        about: 'Subject',
      },
    },
  ],
  tools: {
    search: defineTool({
      description:
        'Search the person’s Gmail with Gmail’s own search words (from:, to:, subject:, after:2026/10/01, has:attachment, a phrase). Returns the headers of the newest matches.',
      input: { query: z.string(), limit: z.number().int().positive().optional() },
      effect: 'read',
      words: ({ query }) => `Searched Gmail for “${short(query, 60)}”`,
      run: async (c, { query, limit }) =>
        c.call('search', { query, limit }, () =>
          withImap(c, async (client) => {
            const lock = await client.getMailboxLock(await mailbox(client, '\\All'))
            try {
              const uids = (await client.search({ gmraw: query }, { uid: true })) || []
              const newest = uids.slice(-(limit ?? 25))
              return (await headers(client, newest, c.host.account)).map((h) => h.header).reverse()
            } finally {
              lock.release()
            }
          }),
        ),
    }),
    read: defineTool({
      description:
        'Read one message in full: its text and the names of its attachments. message is its Message ID.',
      input: { message: z.string() },
      effect: 'read',
      words: () => 'Read an email',
      run: async (c, { message }) =>
        c.call('read', { message }, () =>
          withImap(c, async (client) => {
            const lock = await client.getMailboxLock(await mailbox(client, '\\All'))
            try {
              const id = message.replace(/^<|>$/g, '')
              const uids =
                (await client.search({ header: { 'message-id': id } }, { uid: true })) || []
              const uid = uids.at(-1)
              if (!uid) throw new Problem('That message is not in this Gmail account.', 'gone')
              const m = await client.fetchOne(
                String(uid),
                { source: true, envelope: true },
                { uid: true },
              )
              const source = m ? m.source : undefined
              if (!source) throw new Problem('That message could not be read.')
              const parsed = await simpleParser(source)
              return {
                from: parsed.from?.text ?? '',
                to: Array.isArray(parsed.to)
                  ? parsed.to.map((t) => t.text).join(', ')
                  : (parsed.to?.text ?? ''),
                subject: parsed.subject ?? '',
                date: parsed.date?.toISOString() ?? '',
                text: (parsed.text ?? '').slice(0, 20_000),
                attachments: parsed.attachments.map((a) => a.filename ?? 'unnamed'),
              }
            } finally {
              lock.release()
            }
          }),
        ),
    }),
    draft: defineTool({
      description:
        'Save a draft in the person’s Gmail Drafts, for them to send themselves. It goes to no one.',
      input: Message,
      effect: 'write',
      words: (m) => `Saved a draft to ${m.to}`,
      run: async (c, m) =>
        c.call('draft', { to: m.to, subject: m.subject }, () =>
          withImap(c, async (client) => {
            const raw = await new MailComposer(compose(c.host.account, m)).compile().build()
            await client.append(await mailbox(client, '\\Drafts'), raw, ['\\Draft'])
            return { saved: true, to: m.to, subject: m.subject }
          }),
        ),
    }),
    send: defineTool({
      description: 'Send an email from the person’s Gmail. It waits for their yes on a card first.',
      input: Message,
      effect: 'outward',
      preview,
      words: (m) => `Send an email to ${m.to}`,
      run: async (c, m) =>
        c.call('send', { to: m.to, subject: m.subject }, async () => {
          const transport = nodemailer.createTransport({
            host: 'smtp.gmail.com',
            port: 465,
            secure: true,
            auth: { user: c.host.account, pass: await secret(c) },
          })
          const info = await transport.sendMail(compose(c.host.account, m))
          return { sent: true, to: m.to, subject: m.subject, id: info.messageId }
        }),
    }),
  },
  check: async (c) => {
    await c.call('check', {}, () => withImap(c, async (client) => mailbox(client, '\\All')))
  },
  // A message's attachments, by its Message ID: read only, never marked read or moved.
  files: {
    table: 'Mail',
    field: 'Attachments',
    fetch: async (c, item) => {
      const files = await c.call('files', { message: item }, () =>
        withImap(c, async (client) => {
          const lock = await client.getMailboxLock(await mailbox(client, '\\All'))
          try {
            const id = item.replace(/^<|>$/g, '')
            const uids =
              (await client.search({ header: { 'message-id': id } }, { uid: true })) || []
            const uid = uids.at(-1)
            if (!uid) throw new Problem('That message is not in this Gmail account.', 'gone')
            const m = await client.fetchOne(String(uid), { source: true }, { uid: true })
            const source = m ? m.source : undefined
            if (!source) throw new Problem('That message could not be read.')
            const parsed = await simpleParser(source)
            // as text, so a recorded answer is plain JSON
            return parsed.attachments.map((a) => ({
              name: a.filename ?? 'unnamed',
              mime: a.contentType,
              base64: a.content.toString('base64'),
              inline: a.contentDisposition === 'inline' || !!a.related,
            }))
          } finally {
            lock.release()
          }
        }),
      )
      return files.map((f) => ({
        name: f.name,
        mime: f.mime,
        bytes: new Uint8Array(Buffer.from(f.base64, 'base64')),
        inline: f.inline,
      }))
    },
  },
  // First the last 90 days; then what came after the last message seen, and the unread and
  // starred marks that changed since (IMAP's CONDSTORE). The cursor is the shape, the mailbox's
  // UID validity, the last UID landed and the mailbox's mod-sequence.
  sync: async (c) => {
    const cursor = c.host.cursor()
    const out = await c.call('sync', { cursor }, () =>
      withImap(c, async (client) => {
        const path = await mailbox(client, '\\All')
        const lock = await client.getMailboxLock(path)
        try {
          const box = client.mailbox
          const validity = box && typeof box === 'object' ? String(box.uidValidity) : ''
          const modseq = box && typeof box === 'object' ? String(box.highestModseq ?? '') : ''
          const [shape, seenValidity, seenUid, seenModseq] = (cursor ?? '').split(':')
          const fresh = shape !== SHAPE || seenValidity !== validity
          const since = Number(seenUid ?? 0)
          const uids = fresh
            ? (await client.search({ since: new Date(Date.now() - 90 * DAY) }, { uid: true })) || []
            : (await client.search({ uid: `${since + 1}:*` }, { uid: true })) || []
          const fetched = await headers(
            client,
            uids.filter((u) => fresh || u > since),
            c.host.account,
          )
          const marks: Marks[] = []
          if (!fresh && seenModseq && since > 0)
            for await (const m of client.fetch(
              `1:${since}`,
              { uid: true, flags: true, envelope: true, emailId: true },
              { uid: true, changedSince: BigInt(seenModseq) },
            ))
              marks.push({
                id: m.envelope?.messageId || m.emailId || String(m.uid),
                unread: !(m.flags?.has('\\Seen') ?? false),
                starred: m.flags?.has('\\Flagged') ?? false,
              })
          const status = await client.status(path, { messages: true })
          return {
            validity,
            modseq,
            last: Math.max(fresh ? 0 : since, ...fetched.map((f) => f.uid)),
            headers: fetched.map((f) => f.header),
            marks,
            total: status ? (status.messages ?? 0) : 0,
          }
        } finally {
          lock.release()
        }
      }),
    )
    const yesNo = (b: boolean | undefined) => (b === undefined ? undefined : b ? 'yes' : 'no')
    const landed = c.host.land(
      'Mail',
      out.headers.map((h) => ({
        key: h.id,
        values: defined({
          From: h.from,
          'From address': h.fromAddress || undefined,
          To: h.to,
          Cc: h.cc,
          Subject: h.subject,
          Date: h.date,
          Labels: h.labels,
          Thread: h.thread,
          'Message ID': h.id,
          Direction: h.direction,
          'To addresses': h.toAddresses,
          'Cc addresses': h.ccAddresses,
          Attachments: h.attachments,
          Unread: yesNo(h.unread),
          Starred: yesNo(h.starred),
        }),
      })),
    )
    c.host.land(
      'Mail',
      (out.marks ?? []).map((m) => ({
        key: m.id,
        values: { Unread: yesNo(m.unread), Starred: yesNo(m.starred) },
      })),
      { existing: true },
    )
    c.host.setCursor(`${SHAPE}:${out.validity}:${out.last}:${out.modseq ?? ''}`)
    return { rows: out.total, sawNew: landed.added > 0 }
  },
}

// What a folder of this connector exports for Alpha to load.
export const connector = gmail
