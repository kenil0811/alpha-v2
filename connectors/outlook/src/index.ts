// Outlook: the person's Microsoft 365 mail through Microsoft Graph, signed in as them with their
// organisation's own sign-in app (step 2, part 5, Kenil's yes 30 Oct), so it reaches only their
// own mailbox. It reads, and writes nothing (drafts and sends come with Dell's step): Inbox and
// Sent Items land in the same Mail table as Gmail's, with the same fields, so what reads Mail
// reads both. The first read goes back 90 days; each one after asks Graph only what changed.
import { readFileSync } from 'node:fs'
import { type Call, type Connector, defineTool, type ItemFile, Problem } from '@alpha/connector-sdk'
import { z } from 'zod'

const GRAPH = 'https://graph.microsoft.com/v1.0'
const DAY = 86_400_000
const SHAPE = 'o1' // the cursor's shape: a newer one reads from scratch
const FOLDERS = [
  { id: 'inbox', name: 'Inbox' },
  { id: 'sentitems', name: 'Sent Items' },
] as const
const SELECT =
  'id,internetMessageId,conversationId,subject,from,toRecipients,ccRecipients,receivedDateTime,isRead,flag,hasAttachments,categories'

interface Ask {
  method?: 'GET' | 'POST'
  body?: unknown
  prefer?: string[]
}

// One Graph call as the person, with the short-lived token the core renews. path is Graph's own
// next address, or one under v1.0.
export async function graph<T>(c: Call, path: string, ask: Ask = {}): Promise<T> {
  const token = await c.host.secret()
  if (!token) throw new Problem('Sign in with Microsoft to finish connecting.', 'sign_in')
  const res = await fetch(path.startsWith('https://') ? path : `${GRAPH}${path}`, {
    method: ask.method ?? 'GET',
    headers: {
      authorization: `Bearer ${token}`,
      accept: 'application/json',
      ...(ask.body ? { 'content-type': 'application/json' } : {}),
      ...(ask.prefer?.length ? { prefer: ask.prefer.join(', ') } : {}),
    },
    ...(ask.body ? { body: JSON.stringify(ask.body) } : {}),
    signal: AbortSignal.timeout(60_000),
  })
  if (res.ok) return (await res.json()) as T
  const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } }
  const said = body.error?.message ?? `${res.status} ${res.statusText}`
  if (res.status === 401)
    throw new Problem(`Microsoft no longer takes this sign-in: sign in again. (${said})`, 'sign_in')
  if (res.status === 429 || res.status === 503) {
    const after = Number(res.headers.get('retry-after'))
    throw new Problem(`Microsoft asked Alpha to wait: ${said}`, 'busy', {
      ...(after > 0 ? { retryAfterMs: after * 1000 } : {}),
    })
  }
  if (res.status === 403)
    throw new Problem(`Microsoft does not let Alpha do that for this account: ${said}`, 'blocked')
  if (res.status === 404) throw new Problem(`Microsoft has no such thing: ${said}`, 'gone')
  throw new Problem(`Microsoft said no: ${said}`)
}

interface Address {
  emailAddress?: { name?: string; address?: string }
}

interface Message {
  id: string
  internetMessageId?: string
  conversationId?: string
  subject?: string
  from?: Address
  toRecipients?: Address[]
  ccRecipients?: Address[]
  receivedDateTime?: string
  isRead?: boolean
  flag?: { flagStatus?: string }
  hasAttachments?: boolean
  categories?: string[]
  body?: { contentType?: string; content?: string }
  '@removed'?: unknown
}

interface Page<T> {
  value: T[]
  '@odata.nextLink'?: string
  '@odata.deltaLink'?: string
}

// As Gmail writes them: "Name <address>", and the addresses alone.
const named = (list: Address[] | undefined) =>
  (list ?? [])
    .map(({ emailAddress: a }) =>
      a?.name && a.name !== a.address ? `${a.name} <${a.address ?? ''}>` : (a?.address ?? ''),
    )
    .filter(Boolean)
    .join(', ')
const plain = (list: Address[] | undefined) =>
  (list ?? [])
    .map(({ emailAddress: a }) => a?.address ?? '')
    .filter(Boolean)
    .join(', ')

// A message as a row of Mail, the same fields as Gmail's.
function row(m: Message, folder: string, account: string, files: string[]) {
  const from = m.from?.emailAddress?.address ?? ''
  const sent = folder === 'Sent Items' || from.toLowerCase() === account.toLowerCase()
  const id = m.internetMessageId || m.id
  return {
    key: id,
    values: {
      From: named(m.from ? [m.from] : []),
      'From address': from,
      To: named(m.toRecipients),
      Cc: named(m.ccRecipients),
      Subject: m.subject ?? '',
      Date: new Date(m.receivedDateTime ?? Date.now()).toISOString(),
      Labels: [folder, ...(m.categories ?? [])].join(', '),
      Thread: m.conversationId ?? '',
      'Message ID': id,
      Direction: sent ? 'sent' : 'received',
      'To addresses': plain(m.toRecipients),
      'Cc addresses': plain(m.ccRecipients),
      Attachments: files.join(', '),
      Unread: m.isRead ? 'no' : 'yes',
      Starred: m.flag?.flagStatus === 'flagged' ? 'yes' : 'no',
    },
  }
}

// The names of the files the messages carry (not the pictures in their text), twenty to a batch.
async function fileNames(c: Call, ids: string[]): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>()
  for (let i = 0; i < ids.length; i += 20) {
    const part = ids.slice(i, i + 20)
    const answer = await graph<{
      responses: {
        id: string
        status: number
        body?: { value?: { name?: string; isInline?: boolean }[] }
      }[]
    }>(c, '/$batch', {
      method: 'POST',
      body: {
        requests: part.map((id, n) => ({
          id: String(n),
          method: 'GET',
          url: `/me/messages/${encodeURIComponent(id)}/attachments?$select=name,isInline`,
        })),
      },
    })
    for (const r of answer.responses) {
      const id = part[Number(r.id)]
      if (id && r.status === 200)
        out.set(
          id,
          (r.body?.value ?? []).filter((a) => !a.isInline && a.name).map((a) => a.name as string),
        )
    }
  }
  return out
}

// One folder's messages since its last read (Graph's delta), page after page, and where the next
// read starts.
async function changed(c: Call, folder: string, from: string | undefined) {
  const since = new Date(Date.now() - 90 * DAY).toISOString().replace(/\.\d+Z$/, 'Z')
  let next: string | undefined =
    from ??
    `/me/mailFolders/${folder}/messages/delta?$select=${SELECT}&$filter=${encodeURIComponent(`receivedDateTime ge ${since}`)}`
  const messages: Message[] = []
  let delta = ''
  while (next) {
    const page: Page<Message> = await graph<Page<Message>>(c, next, {
      prefer: ['odata.maxpagesize=100'],
    })
    messages.push(...page.value.filter((m) => !m['@removed']))
    next = page['@odata.nextLink']
    delta = page['@odata.deltaLink'] ?? delta
  }
  return { messages, delta }
}

// The one message with this Message ID in the mailbox, by Graph's own id.
async function find(c: Call, message: string, select: string): Promise<Message> {
  const q = `internetMessageId eq '${message.replace(/'/g, "''")}'`
  const found = await graph<Page<Message>>(
    c,
    `/me/messages?$filter=${encodeURIComponent(q)}&$select=${select}`,
    { prefer: ['outlook.body-content-type="text"'] },
  )
  const m = found.value[0]
  if (!m) throw new Problem('That message is not in this mailbox.', 'gone')
  return m
}

interface Me {
  displayName?: string
  mail?: string | null
  userPrincipalName?: string
}

export const outlook: Connector = {
  manifest: {
    name: 'outlook',
    title: 'Outlook',
    auth: 'oauth',
    oauth: { provider: 'microsoft', scopes: ['User.Read', 'Mail.Read'] },
    icon: 'mail',
    account: { label: 'Work address', placeholder: 'you@yourcompany.com' },
    pace: { perMinute: 60 },
    syncEveryMinutes: 10,
    reaches: ['graph.microsoft.com'],
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
        'Search the person’s Outlook mail with Microsoft’s search words (from:, to:, subject:, received>=2026-10-01, hasattachments:yes, a phrase). Returns the headers of the matches.',
      input: { query: z.string(), limit: z.number().int().positive().optional() },
      effect: 'read',
      words: ({ query }) =>
        `Searched Outlook for “${query.length > 60 ? `${query.slice(0, 59)}…` : query}”`,
      run: async (c, { query, limit }) =>
        c.call('search', { query, limit }, async () => {
          const found = await graph<Page<Message>>(
            c,
            `/me/messages?$search=${encodeURIComponent(`"${query.replace(/"/g, '\\"')}"`)}&$top=${Math.min(limit ?? 25, 50)}&$select=${SELECT}`,
          )
          return found.value.map((m) => row(m, '', c.host.account, []).values)
        }),
    }),
    read: defineTool({
      description:
        'Read one message in full: its text and the names of its attachments. message is its Message ID.',
      input: { message: z.string() },
      effect: 'read',
      words: () => 'Read an email',
      run: async (c, { message }) =>
        c.call('read', { message }, async () => {
          const m = await find(c, message, `${SELECT},body`)
          const files = m.hasAttachments
            ? (
                await graph<Page<{ name?: string; isInline?: boolean }>>(
                  c,
                  `/me/messages/${encodeURIComponent(m.id)}/attachments?$select=name,isInline`,
                )
              ).value
                .filter((a) => !a.isInline && a.name)
                .map((a) => a.name as string)
            : []
          const v = row(m, '', c.host.account, files).values
          return {
            from: v.From,
            to: v.To,
            subject: v.Subject,
            date: v.Date,
            text: (m.body?.content ?? '').slice(0, 20_000),
            attachments: files,
          }
        }),
    }),
  },
  // who they signed in as: the account this connection is for, or sign in again as that one
  check: async (c) => {
    const me = await c.call('me', {}, () =>
      graph<Me>(c, '/me?$select=displayName,mail,userPrincipalName'),
    )
    const want = c.host.account.trim().toLowerCase()
    const is = [me.mail, me.userPrincipalName].flatMap((a) => (a ? [a.toLowerCase()] : []))
    if (!is.includes(want))
      throw new Problem(
        `You signed in to Microsoft as ${me.mail ?? me.userPrincipalName}, and this connection is for ${c.host.account}: sign in again as ${c.host.account}.`,
        'sign_in',
      )
  },
  // A message's files, by its Message ID: read only, never marked read or moved.
  files: {
    table: 'Mail',
    field: 'Attachments',
    fetch: async (c, item) => {
      const files = await c.call('files', { message: item }, async () => {
        const m = await find(c, item, 'id')
        const all = await graph<
          Page<{
            '@odata.type'?: string
            name?: string
            contentType?: string
            contentBytes?: string
            isInline?: boolean
          }>
        >(c, `/me/messages/${encodeURIComponent(m.id)}/attachments`)
        // as text, so a recorded answer is plain JSON; a message attached to a message is not a file
        return all.value
          .filter((a) => a['@odata.type'] === '#microsoft.graph.fileAttachment' && a.contentBytes)
          .map((a) => ({
            name: a.name ?? 'unnamed',
            mime: a.contentType ?? 'application/octet-stream',
            base64: a.contentBytes as string,
            inline: !!a.isInline,
          }))
      })
      return files.map(
        (f): ItemFile => ({
          name: f.name,
          mime: f.mime,
          bytes: new Uint8Array(Buffer.from(f.base64, 'base64')),
          inline: f.inline,
        }),
      )
    },
  },
  // Inbox and Sent Items: the first read 90 days back, then what changed since, by the places
  // Graph said to ask next (kept as the cursor).
  sync: async (c) => {
    const cursor = c.host.cursor()
    const out = await c.call('sync', { cursor }, async () => {
      const seen = (() => {
        try {
          const v = JSON.parse(cursor ?? '{}') as Record<string, string>
          return v.shape === SHAPE ? v : {}
        } catch {
          return {}
        }
      })()
      const next: Record<string, string> = { shape: SHAPE }
      const rows: ReturnType<typeof row>[] = []
      let total = 0
      for (const f of FOLDERS) {
        const { messages, delta } = await changed(c, f.id, seen[f.id])
        const names = await fileNames(
          c,
          messages.filter((m) => m.hasAttachments).map((m) => m.id),
        )
        rows.push(...messages.map((m) => row(m, f.name, c.host.account, names.get(m.id) ?? [])))
        if (delta) next[f.id] = delta
        total +=
          (
            await graph<{ totalItemCount?: number }>(
              c,
              `/me/mailFolders/${f.id}?$select=totalItemCount`,
            )
          ).totalItemCount ?? 0
      }
      return { rows, next: JSON.stringify(next), total }
    })
    const landed = await c.host.land('Mail', out.rows)
    c.host.setCursor(out.next)
    return { rows: out.total, sawNew: landed.added > 0 }
  },
}

export const connector = outlook
