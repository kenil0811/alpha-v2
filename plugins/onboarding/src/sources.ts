// What the closer look reads (onboarding B, Kenil's yes 2 Nov), once a session, from what the
// person allowed: visits as sites and scrubbed titles, never addresses; each time an app was in
// front; every file's name and where each download came from; the never-use list already run in
// the connectors. Mail is its headers alone, calendar and contacts what their tables keep, never a
// phone number or a contact's address; a message or a meeting that touches the never-use list is
// not read at all (Kenil's yes 2 Nov, after a bank statement's subject reached the first run).
// Nothing here is sent: the tools pick from it.
import type { PluginHost, Row } from '@alpha/plugin-sdk'
import { ALL, type Choices } from './cards.ts'

export interface Visit {
  at: string
  site: string
  title: string
}
export interface Span {
  app: string
  start: string
  end: string
}
export interface AppUse {
  name: string
  launches?: number
  lastUsed?: string
  hoursWeek?: number
}
export interface Name {
  folder: string
  path: string
  kind: string
  modified: string
}
export interface Fetched {
  name: string
  sites: string[]
  at: string
}
export interface Message {
  at: string
  sent: boolean
  from: string // a name, else an address
  fromSite: string // the sender's domain
  automated: boolean // sent by a system, by the look of its address
  to: string[] // addresses
  subject: string
  attachments: string[]
}
export interface Meeting {
  starts: string
  ends: string
  allDay: boolean
  title: string
  people: string[] // everyone but the person
  location: string
}
export interface Contact {
  name: string
  company: string
  title: string
  me: boolean
}

export interface Sources {
  visits: Visit[] | null // null: not connected
  spans: Span[] | null
  apps: AppUse[] | null
  names: Name[] | null
  downloads: Fetched[] | null
  mail: Message[]
  meetings: Meeting[]
  contacts: Contact[]
}

const str = (v: unknown) => (v === null || v === undefined ? '' : String(v).trim())
const list = (v: unknown) =>
  str(v)
    .split(/,\s*/)
    .map((x) => x.trim())
    .filter(Boolean)

// Words without what could say who someone is: addresses, phone numbers, runs of five digits or
// more (an account, an order); the connectors do the same to page titles.
export function scrub(words: string): string {
  return words
    .replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, '')
    .replace(/\+?\d[\d\s().-]{6,}\d/g, '')
    .replace(/\d{5,}/g, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[\s|·:–-]+|[\s|·:–-]+$/g, '')
    .trim()
}

const AUTOMATED =
  /^(no-?reply|do-?not-?reply|notifications?|notify|alerts?|updates?|news(letter)?|mailer(-daemon)?|bounces?|digest|billing|invoices?|receipts?|statements?|orders?|marketing|info|support|team|hello|account|accounts|service|system|automated|calendar-notification)([+._-]|$)/i

// A name of someone from "Name <address>", or the address.
const who = (s: string) =>
  s
    .replace(/<[^>]*>/g, '')
    .replace(/^"|"$/g, '')
    .trim()

function message(v: Record<string, unknown>): Message {
  const address = str(v['From address']).toLowerCase()
  return {
    at: str(v.Date),
    sent: str(v.Direction) === 'sent',
    from: who(str(v.From)) || address,
    fromSite: address.split('@')[1] ?? '',
    automated: AUTOMATED.test(address.split('@')[0] ?? ''),
    to: list(v['To addresses']).map((a) => a.toLowerCase()),
    subject: scrub(str(v.Subject)),
    attachments: list(v.Attachments).map(scrub).filter(Boolean),
  }
}

function meeting(v: Record<string, unknown>): Meeting {
  const mine = str(v['Your address']).toLowerCase()
  return {
    starts: str(v.Starts),
    ends: str(v.Ends),
    allDay: str(v['All day']) === 'yes',
    title: scrub(str(v.Title)),
    people: list(v.Attendees)
      .filter((a) => !mine || !a.toLowerCase().includes(mine))
      .map(who)
      .filter(Boolean),
    location: scrub(str(v.Location)),
  }
}

const contact = (v: Record<string, unknown>): Contact => ({
  name: str(v.Name),
  company: str(v.Company),
  title: str(v.Title),
  me: str(v['Is you']) === 'yes',
})

// The messages that may leave: none whose subject, attachments, sender or recipients touch the
// never-use list.
export const mailRows = (host: PluginHost) =>
  host
    .rows('Mail', 'Mail')
    .filter(
      (r) =>
        !['Subject', 'Attachments', 'From', 'From address', 'To addresses'].some((f) =>
          host.never(str(r.values[f])),
        ),
    )

// The meetings that may leave: none whose title or place touches the never-use list.
export const meetingRows = (host: PluginHost) =>
  host
    .rows('Calendar', 'Events')
    .filter((r) => !['Title', 'Location'].some((f) => host.never(str(r.values[f]))))

// A connector's answer, or null where it is not connected.
async function read<T>(host: PluginHost, connector: string, tool: string, input = {}) {
  try {
    return (await host.connectorTool(connector, tool, input)) as T
  } catch {
    return null
  }
}

// What the person allowed on the cards decides what is read at all: a card said no to is a
// source never read, a browser or Screen Time left out is never opened.
export async function readSources(host: PluginHost, choices: Choices = ALL): Promise<Sources> {
  const values = (rows: Row[]) => rows.map((r) => r.values)
  const ok = (card: string) => !choices.skipped.includes(card)
  const browsing = !choices.browsers || choices.browsers.length > 0
  return {
    visits: browsing
      ? ((
          await read<{ visits: Visit[] }>(host, 'browsing', 'visits', {
            days: 90,
            ...(choices.browsers ? { browsers: choices.browsers } : {}),
          })
        )?.visits ?? null)
      : null,
    spans:
      ok('apps') && choices.screenTime
        ? ((await read<{ spans: Span[] }>(host, 'apps', 'spans', { days: 30 }))?.spans ?? null)
        : null,
    apps: ok('apps')
      ? ((
          await read<{ apps: AppUse[] }>(host, 'apps', 'apps', {
            days: 30,
            time: choices.screenTime,
          })
        )?.apps ?? null)
      : null,
    names: ok('files')
      ? ((await read<{ names: Name[] }>(host, 'filenames', 'names'))?.names ?? null)
      : null,
    downloads: ok('files')
      ? ((await read<{ downloads: Fetched[] }>(host, 'filenames', 'downloads'))?.downloads ?? null)
      : null,
    mail: ok('mail') ? values(mailRows(host)).map(message) : [],
    meetings: ok('calendar') ? values(meetingRows(host)).map(meeting) : [],
    contacts: ok('contacts') ? values(host.rows('Contacts', 'Contacts')).map(contact) : [],
  }
}
