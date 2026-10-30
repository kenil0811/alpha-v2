// Gmail by IMAP and SMTP with an app password (design §8, decision 10). Headers of the last 90
// days land in the Mail table; a message's body is read when asked. A draft is saved in the
// person's own Drafts (a write: it goes nowhere); a send leaves their world and waits on a card.
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { type Call, type Connector, defineTool, Problem, proxy } from '@alpha/connector-sdk'
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

// What withImap needs of a client: the real ImapFlow, or a stand-in in a test.
export interface ImapLike {
  connect(): Promise<unknown>
  logout(): Promise<unknown>
  on(event: 'error', listener: (err: unknown) => void): unknown
}

// A connection dropped mid-call ends that call with the error, never the process: ImapFlow
// emits 'error' outside any await, and an emitter with no listener throws it to the top (item 6
// of the problems list, 24 Oct; Alpha restarted itself for it on 22 and 23 Oct).
export async function withImapClient<T, C extends ImapLike>(
  client: C,
  fn: (client: C) => Promise<T>,
): Promise<T> {
  let fail: (err: Error) => void = () => undefined
  const dropped = new Promise<never>((_, reject) => {
    fail = reject
  })
  dropped.catch(() => undefined)
  client.on('error', (err) =>
    fail(err instanceof Error ? err : new Error(`Gmail's connection dropped: ${String(err)}`)),
  )
  try {
    await Promise.race([client.connect(), dropped])
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
    return await Promise.race([fn(client), dropped])
  } finally {
    await client.logout().catch(() => undefined)
  }
}

async function withImap<T>(c: Call, fn: (client: ImapFlow) => Promise<T>): Promise<T> {
  return withImapClient(
    new ImapFlow({
      host: 'imap.gmail.com',
      port: 993,
      secure: true,
      auth: { user: c.host.account, pass: await secret(c) },
      logger: false,
      // out of its sandbox only through the proxy (step 2, part 1, slice 2)
      ...(proxy() ? { proxy: proxy() } : {}),
    }),
    fn,
  )
}

async function mailbox(
  client: ImapFlow,
  use: '\\All' | '\\Drafts' | '\\Sent' | '\\Trash',
): Promise<string> {
  const found = (await client.list()).find((m) => m.specialUse === use)
  if (!found)
    throw new Problem(
      `This Gmail account has no ${{ '\\All': 'All Mail', '\\Drafts': 'Drafts', '\\Sent': 'Sent Mail', '\\Trash': 'Trash' }[use]} folder over IMAP.`,
    )
  return found.path
}

// The uids of a message in a folder, by its Message-ID.
async function uidsOf(client: ImapFlow, id: string): Promise<number[]> {
  const found = await client.search(
    { header: { 'message-id': id.replace(/^<|>$/g, '') } },
    { uid: true },
  )
  return Array.isArray(found) ? found : []
}

// A draft as it is in Drafts, by its Message-ID; none when it is no longer there.
async function draftIn(client: ImapFlow, id: string): Promise<Draft | null> {
  const lock = await client.getMailboxLock(await mailbox(client, '\\Drafts'))
  try {
    const uid = (await uidsOf(client, id)).at(-1)
    if (!uid) return null
    const source = ((await client.fetchOne(String(uid), { source: true }, { uid: true })) || null)
      ?.source
    if (!source) return null
    const p = await simpleParser(source)
    const list = (a: typeof p.to) =>
      (Array.isArray(a) ? a : a ? [a] : []).flatMap((x) =>
        x.value.map((v) => (v.address ?? '').toLowerCase()).filter(Boolean),
      )
    return {
      to: list(p.to),
      cc: list(p.cc),
      bcc: list(p.bcc),
      subject: p.subject ?? '',
      body: p.text ?? '',
      attachments: p.attachments.map((a) => a.filename ?? 'unnamed'),
      raw: source,
    }
  } finally {
    lock.release()
  }
}

// The draft in Drafts that is this very email (the newest of those to its first address with its
// subject), with its Message-ID; none when there is none.
async function sameDraftIn(
  client: ImapFlow,
  m: Parameters<typeof compose>[1],
): Promise<(Draft & { id: string }) | null> {
  const to = emailsIn(m.to)[0]
  if (!to) return null
  const ids: string[] = []
  const lock = await client.getMailboxLock(await mailbox(client, '\\Drafts'))
  try {
    const uids = (await client.search({ to, subject: m.subject }, { uid: true })) || []
    if (uids.length)
      for await (const x of client.fetch(uids.slice(-5), { envelope: true }, { uid: true }))
        if (x.envelope?.messageId) ids.unshift(x.envelope.messageId)
  } finally {
    lock.release()
  }
  for (const id of ids) {
    const d = await draftIn(client, id)
    if (d && !unlike(d, m).length) return { ...d, id }
  }
  return null
}

// A sent draft discarded, as Gmail's own Send leaves none (Kenil, 29 Oct: "lets do discard"). Over
// IMAP Gmail keeps a message taken out of a folder (archived, or in Trash, by the account's
// settings), so it is moved to Trash and deleted for good there, found by Gmail's own id for it:
// the sent copy shares its Message-ID and is never touched. A draft Gmail filed as the sent email
// itself only loses its Drafts label.
export async function discardDraft(client: ImapFlow, id: string): Promise<void> {
  const trash = await mailbox(client, '\\Trash')
  const gone: string[] = []
  const lock = await client.getMailboxLock(await mailbox(client, '\\Drafts'))
  try {
    const uids = await uidsOf(client, id)
    if (!uids.length) return
    const sent: number[] = []
    for await (const m of client.fetch(uids, { emailId: true, labels: true }, { uid: true }))
      if (m.labels?.has('\\Sent')) sent.push(m.uid)
      else if (m.emailId) gone.push(m.emailId)
    if (sent.length) {
      await client.messageFlagsRemove(sent, ['\\Draft'], { uid: true, useLabels: true })
      return
    }
    await client.messageMove(uids, trash, { uid: true })
  } finally {
    lock.release()
  }
  if (!gone.length) return
  const inTrash = await client.getMailboxLock(trash)
  try {
    for (const emailId of gone) {
      const uids = (await client.search({ emailId }, { uid: true })) || []
      if (uids.length) await client.messageDelete(uids, { uid: true })
    }
  } finally {
    inTrash.release()
  }
}

// One send, once (final plan, call A, 28 Oct). The email carries a Message-ID of Alpha's own, so
// when the connection drops before Gmail answers, Sent is looked in (now, and again a few seconds
// later, as Gmail files a sent message a moment after it takes it): there, it went; not there, it
// did not, and nothing is sent again. Gmail asking to slow down (421, 4.7.x) did nothing, so it is
// a busy problem the runtime waits out; a refusal (5xx, the day's sending limit) is said as it is.
// A send that names a draft (Kenil, 29 Oct) sends that draft as it is in Drafts, under its own
// Message-ID and dated now, then takes it out of Drafts; a draft that is not what the card showed,
// or is gone, is refused and nothing goes. A send that names none, of an email a draft in Drafts
// already is, sends that draft the same way (his run, 16:22: Alpha had the id and sent anew).
export interface SendHands {
  send: (mail: Record<string, unknown>) => Promise<unknown>
  inSent: (id: string) => Promise<boolean>
  wait: (ms: number) => Promise<void>
  draft?: (id: string) => Promise<Draft | null>
  sameDraft?: (m: Parameters<typeof compose>[1]) => Promise<(Draft & { id: string }) | null>
  removeDraft?: (id: string) => Promise<void>
}

// A draft as it is in Drafts: its recipients' addresses, words, files and the message itself.
export interface Draft {
  to: string[]
  cc: string[]
  bcc: string[]
  subject: string
  body: string
  attachments: string[]
  raw: Buffer
}

const emailsIn = (v: string | undefined) =>
  (v ?? '').match(/[^\s<>,;"']+@[^\s<>,;"']+/g)?.map((a) => a.toLowerCase()) ?? []
const sameList = (a: string[], b: string[]) =>
  JSON.stringify([...a].map((x) => x.toLowerCase()).sort()) === JSON.stringify([...b].sort())
const words = (v: string) =>
  v
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .trim()

// What of a draft is not what the card shows, in words; none: it is the same email.
function unlike(
  d: Draft,
  m: { to: string; cc?: string | undefined; subject: string; body: string },
) {
  return [
    !sameList(d.to, emailsIn(m.to)) && 'its To',
    !sameList(d.cc, emailsIn(m.cc)) && 'its Cc',
    d.bcc.length > 0 && 'its Bcc',
    d.subject.trim() !== m.subject.trim() && 'its subject',
    words(d.body) !== words(m.body) && 'its text',
    d.attachments.length > 0 && 'its attachments',
  ].filter((x): x is string => !!x)
}

// The draft's own message, dated when it goes.
function datedNow(raw: Buffer): Buffer {
  const text = raw.toString('latin1')
  const end = text.search(/\r?\n\r?\n/)
  const head = end < 0 ? text : text.slice(0, end)
  const date = `Date: ${new Date().toUTCString().replace('GMT', '+0000')}`
  const dated = /^Date:/im.test(head)
    ? head.replace(/^Date:.*(?:\r?\n[ \t].*)*/im, date)
    : `${date}\r\n${head}`
  return Buffer.from(dated + (end < 0 ? '' : text.slice(end)), 'latin1')
}

const DROPPED =
  /ECONNRESET|ETIMEDOUT|EPIPE|ECONNREFUSED|EAI_AGAIN|ESOCKET|ECONNECTION|socket hang up|timed? ?out|closed/i

export const messageIdFor = (account: string) =>
  `<alpha-${randomUUID()}@${account.split('@')[1] ?? 'alpha.local'}>`

type Sent = { sent: true; to: string; subject: string; id: string; words?: string }

export async function sendOnce(
  account: string,
  m: Parameters<typeof compose>[1] & { draft?: string | undefined },
  hands: SendHands,
): Promise<Sent> {
  let id = m.draft
  let d: Draft | null = null
  if (id) {
    d = (await hands.draft?.(id)) ?? null
    if (!d)
      throw new Problem(
        `That draft to ${m.to} is no longer in Drafts (sent or deleted), so nothing was sent.`,
        'gone',
      )
    const off = unlike(d, m)
    if (off.length)
      throw new Problem(
        `The draft in Gmail is not what the card showed (${off.join(', ')}), so nothing was sent. Read it again, then ask again.`,
      )
  } else {
    const same = (await hands.sameDraft?.(m)) ?? null
    if (same && !unlike(same, m).length) [id, d] = [same.id, same]
  }
  if (!id || !d) return sendMail(account, m, messageIdFor(account), hands, null)
  const out = await sendMail(account, m, id, hands, {
    envelope: { from: account, to: [...d.to, ...d.cc] },
    raw: datedNow(d.raw),
  })
  try {
    await hands.removeDraft?.(id)
    return { ...out, words: out.words ?? 'It was your draft: sent as it is, and out of Drafts.' }
  } catch (err) {
    const why = err instanceof Error ? err.message : String(err)
    return {
      ...out,
      words: `Sent your draft; it stays in Drafts, as it could not be taken out: ${why}`,
    }
  }
}

async function sendMail(
  account: string,
  m: Parameters<typeof compose>[1],
  id: string,
  hands: SendHands,
  draft: Record<string, unknown> | null,
): Promise<Sent> {
  try {
    await hands.send(draft ?? { ...compose(account, m), messageId: id })
    return { sent: true, to: m.to, subject: m.subject, id }
  } catch (err) {
    const e = err as { responseCode?: number; code?: string; message?: string }
    const said = e.message ?? String(err)
    if (
      e.responseCode === 421 ||
      (e.responseCode && e.responseCode < 500 && /\b4\.7\.\d/.test(said))
    )
      throw new Problem(`Gmail asked to slow down: ${said}`, 'busy')
    if (e.responseCode && e.responseCode >= 500)
      throw new Problem(
        /5\.4\.5|sending limit|quota/i.test(said)
          ? `Gmail's sending limit for today is reached on ${account}, so the email to ${m.to} was not sent.`
          : `Gmail refused the email to ${m.to}: ${said}`,
      )
    if (!DROPPED.test(`${e.code ?? ''} ${said}`)) throw err
    for (const ms of [0, 5000]) {
      await hands.wait(ms)
      if (await hands.inSent(id))
        return {
          sent: true,
          to: m.to,
          subject: m.subject,
          id,
          words: 'Gmail took it before the connection dropped; it is in Sent.',
        }
    }
    throw new Problem(
      `The email to ${m.to} was not sent: the connection to Gmail dropped and Sent has no such message. Nothing went, so it can be sent again.`,
    )
  }
}

async function inSent(client: ImapFlow, id: string): Promise<boolean> {
  const lock = await client.getMailboxLock(await mailbox(client, '\\Sent'))
  try {
    return (await uidsOf(client, id)).length > 0
  } finally {
    lock.release()
  }
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

const preview = (m: {
  to: string
  cc?: string | undefined
  subject: string
  body: string
  draft?: string | undefined
}) => ({
  words: `${m.draft ? 'Send your draft to' : 'Send an email to'} ${m.to}: “${m.subject}”`,
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
    reaches: ['imap.gmail.com:993', 'smtp.gmail.com:465'],
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
        'Save a draft in the person’s Gmail Drafts. It goes to no one. Its draft id is what send takes to send this very draft.',
      input: Message,
      effect: 'write',
      words: (m) => `Saved a draft to ${m.to}`,
      run: async (c, m) => {
        const id = messageIdFor(c.host.account)
        const saved = await c.call('draft', { to: m.to, subject: m.subject }, () =>
          withImap(c, async (client) => {
            const raw = await new MailComposer({ ...compose(c.host.account, m), messageId: id })
              .compile()
              .build()
            await client.append(await mailbox(client, '\\Drafts'), raw, ['\\Draft'])
            return { saved: true, to: m.to, subject: m.subject }
          }),
        )
        return { ...(saved as object), draft: id }
      },
      // taken back by Revert: the draft deleted again (step 2, part 2)
      undo: {
        kind: 'counter',
        said: 'Revert deletes the draft again.',
        words: (m) => `Deletes the draft to ${m.to}`,
        run: (c, m, result) => {
          const id = (result as { draft?: string } | null)?.draft
          if (!id) throw new Problem(`The draft to ${m.to} has no id to find it by.`, 'gone')
          return c.call('discard', { draft: id }, () =>
            withImap(c, async (client) => {
              await discardDraft(client, id)
              return { discarded: true }
            }),
          )
        },
      },
    }),
    send: defineTool({
      description:
        'Send an email from the person’s Gmail. It waits for their yes on a card first. To send a draft (one saved with draft, or one found in Drafts with search in:drafts, then read), give its id as draft and its to, cc, subject and body as the draft has them: that draft goes and leaves Drafts, and one changed since is refused.',
      input: { ...Message, draft: z.string().optional() },
      effect: 'outward',
      undo: 'final',
      preview,
      words: (m) => `${m.draft ? 'Send your draft to' : 'Send an email to'} ${m.to}`,
      run: async (c, m) =>
        c.call(
          'send',
          { to: m.to, subject: m.subject, ...(m.draft ? { draft: m.draft } : {}) },
          async () =>
            sendOnce(c.host.account, m, {
              draft: (id) => withImap(c, (client) => draftIn(client, id)),
              sameDraft: (mail) => withImap(c, (client) => sameDraftIn(client, mail)),
              removeDraft: (id) => withImap(c, (client) => discardDraft(client, id)),
              send: async (mail) => {
                const transport = nodemailer.createTransport({
                  host: 'smtp.gmail.com',
                  port: 465,
                  secure: true,
                  auth: { user: c.host.account, pass: await secret(c) },
                  ...(proxy() ? { proxy: proxy() } : {}),
                })
                return transport.sendMail(mail)
              },
              inSent: (id) => withImap(c, (client) => inSent(client, id)),
              wait: (ms) => new Promise((ok) => setTimeout(ok, ms)),
            }),
        ),
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
    const landed = await c.host.land(
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
    await c.host.land(
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
