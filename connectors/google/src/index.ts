// Google: the person's Google Calendar and Google Contacts, signed in as them with the firm's own
// Google app, so it reaches only their own, read only, into the Events and Contacts every source
// shares. Gmail stays its own connector, on its app password.
import { readFileSync } from 'node:fs'
import {
  type Call,
  CONTACTS,
  type Connector,
  EVENTS,
  GOOGLE_SCOPES,
  type Item,
  Problem,
  who,
} from '@alpha/connector-sdk'

const DAY = 86_400_000
const CALENDAR = 'https://www.googleapis.com/calendar/v3'
const PEOPLE = 'https://people.googleapis.com/v1'

// One Google GET as the person, with the short-lived token the core renews.
async function get<T>(c: Call, url: string): Promise<T> {
  const token = await c.host.secret()
  if (!token) throw new Problem('Sign in with Google to finish connecting.', 'sign_in')
  const res = await fetch(url, {
    headers: { authorization: `Bearer ${token}`, accept: 'application/json' },
    signal: AbortSignal.timeout(60_000),
  })
  if (res.ok) return (await res.json()) as T
  const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } }
  const said = body.error?.message ?? `${res.status} ${res.statusText}`
  if (res.status === 401)
    throw new Problem(`Google no longer takes this sign-in: sign in again. (${said})`, 'sign_in')
  if (res.status === 429 || res.status === 503)
    throw new Problem(`Google asked Alpha to wait: ${said}`, 'busy')
  if (res.status === 403)
    throw new Problem(`Google does not let Alpha read that for this account: ${said}`, 'blocked')
  if (res.status === 404) throw new Problem(`Google has no such thing: ${said}`, 'gone')
  throw new Problem(`Google said no: ${said}`)
}

interface Who {
  email?: string
  displayName?: string
  self?: boolean
}

interface GoogleEvent {
  id: string
  status?: string
  summary?: string
  start?: { dateTime?: string; date?: string }
  end?: { dateTime?: string; date?: string }
  location?: string
  attendees?: Who[]
  organizer?: Who
}

interface GooglePerson {
  resourceName: string
  names?: { displayName?: string }[]
  emailAddresses?: { value?: string }[]
  phoneNumbers?: { value?: string }[]
  organizations?: { name?: string; title?: string }[]
  urls?: { value?: string }[]
}

// Every page of a list, by Google's nextPageToken.
async function pages<T>(c: Call, url: string, key: string): Promise<T[]> {
  const out: T[] = []
  let token: string | undefined
  do {
    const page = await get<Record<string, unknown>>(
      c,
      token ? `${url}&pageToken=${encodeURIComponent(token)}` : url,
    )
    out.push(...((page[key] as T[] | undefined) ?? []))
    token = page.nextPageToken as string | undefined
  } while (token)
  return out
}

const when = (t: { dateTime?: string; date?: string } | undefined) =>
  new Date(t?.dateTime ?? t?.date ?? Date.now()).toISOString()
const person = (w: Who | undefined) => ({ name: w?.displayName, email: w?.email })

export async function events(c: Call, now = Date.now()): Promise<Item[]> {
  const from = new Date(now - 90 * DAY).toISOString()
  const to = new Date(now + 60 * DAY).toISOString()
  const calendars = await pages<{ id: string; summary?: string }>(
    c,
    `${CALENDAR}/users/me/calendarList?maxResults=250`,
    'items',
  )
  const out: Item[] = []
  for (const cal of calendars) {
    const list = await pages<GoogleEvent>(
      c,
      `${CALENDAR}/calendars/${encodeURIComponent(cal.id)}/events?singleEvents=true&maxResults=250&timeMin=${from}&timeMax=${to}`,
      'items',
    )
    for (const e of list.filter((x) => x.status !== 'cancelled')) {
      const all = [...(e.attendees ?? []), ...(e.organizer ? [e.organizer] : [])]
      out.push({
        key: `${cal.id}/${e.id}`,
        values: {
          Title: e.summary ?? '',
          Starts: when(e.start),
          Ends: when(e.end),
          'All day': e.start?.date ? 'yes' : 'no',
          Location: e.location ?? '',
          Calendar: cal.summary ?? cal.id,
          Attendees: (e.attendees ?? []).map((a) => who(person(a))).join(', '),
          Organizer: e.organizer ? who(person(e.organizer)) : '',
          'Your address': all.find((a) => a.self)?.email ?? '',
        },
      })
    }
  }
  return out
}

export async function contacts(c: Call): Promise<Item[]> {
  const list = await pages<GooglePerson>(
    c,
    `${PEOPLE}/people/me/connections?pageSize=1000&personFields=names,emailAddresses,phoneNumbers,organizations,urls`,
    'connections',
  )
  return list.map((p) => {
    const org = p.organizations?.[0]
    return {
      key: p.resourceName,
      values: {
        Name: p.names?.[0]?.displayName || org?.name || '',
        Company: org?.name ?? '',
        Emails: (p.emailAddresses ?? [])
          .map((e) => e.value ?? '')
          .filter(Boolean)
          .join(', '),
        Phones: (p.phoneNumbers ?? [])
          .map((x) => x.value ?? '')
          .filter(Boolean)
          .join(', '),
        Title: org?.title ?? '',
        Profile:
          (p.urls ?? []).find((u) => /linkedin\.com\/in\//i.test(u.value ?? ''))?.value ?? '',
        'Is you': 'no',
      },
    }
  })
}

export const google: Connector = {
  manifest: {
    name: 'google',
    title: 'Google',
    auth: 'oauth',
    oauth: { provider: 'google', scopes: ['openid', 'email', ...GOOGLE_SCOPES] },
    icon: 'calendar',
    account: { label: 'Google address', placeholder: 'you@gmail.com' },
    pace: { perMinute: 60 },
    syncEveryMinutes: 15,
    reaches: ['www.googleapis.com', 'people.googleapis.com', 'openidconnect.googleapis.com'],
  },
  guide: readFileSync(new URL('../GUIDE.md', import.meta.url), 'utf8'),
  module: 'Calendar',
  tables: [EVENTS, CONTACTS],
  tools: {},
  // who they signed in as: the account this connection is for, or sign in again as that one
  check: async (c) => {
    const me = await c.call('me', {}, () =>
      get<{ email?: string }>(c, 'https://openidconnect.googleapis.com/v1/userinfo'),
    )
    if ((me.email ?? '').toLowerCase() !== c.host.account.trim().toLowerCase())
      throw new Problem(
        `You signed in to Google as ${me.email}, and this connection is for ${c.host.account}: sign in again as ${c.host.account}.`,
        'sign_in',
      )
  },
  // the events 90 days back and 60 ahead from every calendar they see, and their contacts
  sync: async (c) => {
    const read = await c.call('sync', {}, async () => ({
      events: await events(c),
      contacts: await contacts(c),
    }))
    const e = await c.host.land('Events', read.events)
    const p = await c.host.land('Contacts', read.contacts)
    return { rows: read.events.length + read.contacts.length, sawNew: e.added + p.added > 0 }
  },
}

export const connector = google
