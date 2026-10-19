// The Mac's own Calendar and Contacts, read-only, through Alpha's helper (design §8). macOS asks
// the person the first time; nothing is ever written back.
import { readFileSync } from 'node:fs'
import { type Call, type Connector, defineTool, Problem, runHelper } from '@alpha/connector-sdk'
import { z } from 'zod'

// Where the helper app is: the core says, through the environment it gives this process.
function helper(): string {
  const app = process.env.ALPHA_HELPER_APP
  if (!app) throw new Problem("Alpha's helper is not built on this Mac.")
  return app
}

interface Event {
  id: string
  title: string
  start: string
  end: string
  allDay: boolean
  location: string
  calendar: string
  attendees: { name: string; email: string }[]
}

interface Contact {
  id: string
  given: string
  family: string
  company: string
  emails: string[]
  phones: string[]
}

const DAY = 86_400_000

async function events(c: Call, from: Date, to: Date): Promise<Event[]> {
  const args = { from: from.toISOString(), to: to.toISOString() }
  const out = await c.call('events', args, async () => {
    const answer = (await runHelper(helper(), ['calendar', args.from, args.to], {
      asApp: true,
    })) as {
      events: Event[]
    }
    return answer.events
  })
  return out
}

async function contacts(c: Call): Promise<Contact[]> {
  return c.call('contacts', {}, async () => {
    const answer = (await runHelper(helper(), ['contacts'], { asApp: true })) as {
      contacts: Contact[]
    }
    return answer.contacts
  })
}

const who = (a: { name: string; email: string }) =>
  a.name && a.email ? `${a.name} <${a.email}>` : a.name || a.email
const nameOf = (p: Contact) => [p.given, p.family].filter(Boolean).join(' ') || p.company

export const calendar: Connector = {
  manifest: {
    name: 'calendar',
    title: 'Calendar',
    auth: 'system',
    account: { label: 'This Mac' },
    pace: { perMinute: 30 },
    syncEveryMinutes: 30,
  },
  guide: readFileSync(new URL('../GUIDE-calendar.md', import.meta.url), 'utf8'),
  module: 'Calendar',
  tables: [
    {
      name: 'Events',
      fields: [
        { name: 'Title', kind: 'text' },
        { name: 'Starts', kind: 'date' },
        { name: 'Ends', kind: 'date' },
        { name: 'All day', kind: 'choice', choices: ['yes', 'no'] },
        { name: 'Location', kind: 'text' },
        { name: 'Calendar', kind: 'text' },
        { name: 'Attendees', kind: 'text' },
      ],
    },
  ],
  tools: {
    events: defineTool({
      description:
        'The events on the person’s Mac calendar between two times (ISO 8601), with their attendees.',
      input: { from: z.string(), to: z.string() },
      effect: 'read',
      run: async (c, { from, to }) => {
        const f = new Date(from)
        const t = new Date(to)
        if (Number.isNaN(f.getTime()) || Number.isNaN(t.getTime()))
          throw new Problem('from and to are times like 2026-10-20T09:00:00Z.')
        return events(c, f, t)
      },
    }),
  },
  check: async (c) => {
    await events(c, new Date(), new Date(Date.now() + DAY))
  },
  // The last 90 days and the next 60, by each event's own id and start (a repeating event's
  // occurrences share an id).
  sync: async (c) => {
    const now = Date.now()
    const all = await events(c, new Date(now - 90 * DAY), new Date(now + 60 * DAY))
    const landed = c.host.land(
      'Events',
      all.map((e) => ({
        key: `${e.id}@${e.start}`,
        values: {
          Title: e.title,
          Starts: e.start,
          Ends: e.end,
          'All day': e.allDay ? 'yes' : 'no',
          Location: e.location,
          Calendar: e.calendar,
          Attendees: e.attendees.map(who).join(', '),
        },
      })),
    )
    return { rows: all.length, sawNew: landed.added > 0 }
  },
}

export const contactsConnector: Connector = {
  manifest: {
    name: 'contacts',
    title: 'Contacts',
    auth: 'system',
    account: { label: 'This Mac' },
    pace: { perMinute: 10 },
    syncEveryMinutes: 24 * 60,
  },
  guide: readFileSync(new URL('../GUIDE-contacts.md', import.meta.url), 'utf8'),
  module: 'Contacts',
  tables: [
    {
      name: 'Contacts',
      fields: [
        { name: 'Name', kind: 'text' },
        { name: 'Company', kind: 'text' },
        { name: 'Emails', kind: 'text' },
        { name: 'Phones', kind: 'text' },
      ],
    },
  ],
  tools: {
    find: defineTool({
      description:
        'Find people in the person’s Mac contacts by any words: a name, a company, an email or a number.',
      input: { words: z.string() },
      effect: 'read',
      run: async (c, { words }) => {
        const w = words.toLowerCase()
        return (await contacts(c))
          .filter((p) =>
            [nameOf(p), p.company, ...p.emails, ...p.phones].some((x) =>
              x.toLowerCase().includes(w),
            ),
          )
          .slice(0, 50)
      },
    }),
  },
  check: async (c) => {
    await contacts(c)
  },
  sync: async (c) => {
    const all = await contacts(c)
    const landed = c.host.land(
      'Contacts',
      all.map((p) => ({
        key: p.id,
        values: {
          Name: nameOf(p),
          Company: p.company,
          Emails: p.emails.join(', '),
          Phones: p.phones.join(', '),
        },
      })),
    )
    return { rows: all.length, sawNew: landed.added > 0 }
  },
}
