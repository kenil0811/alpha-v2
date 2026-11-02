// The closer look's tools for people (onboarding B): mail headers, meetings and contacts, and one
// search across everything read. Read-only, in the person's own zone, never a size of ours.
import type { PluginHost, PluginTool } from '@alpha/plugin-sdk'
import { z } from 'zod'
import { hours, matches, type Timed, tally, weekdays } from './count.ts'
import type { Message, Sources } from './sources.ts'

// A subject without its replies and forwards, its numbers as #: what comes back.
const subjectOf = (s: string) =>
  s
    .replace(/^((re|fwd?|aw|sv)\s*:\s*)+/i, '')
    .replace(/\d+/g, '#')
    .trim()

type Matcher = (words: string) => unknown[]

export function search(
  sites: Matcher,
  names: Matcher,
  mail: (test: (m: Timed<Message>) => boolean) => unknown[],
  meetings: Matcher,
  contacts: Matcher,
): PluginTool {
  return {
    name: 'search',
    description:
      'Where some words come up across everything read: page titles and sites, file names, mail subjects and attachments, meetings and contacts.',
    input: { words: z.string() },
    run: async ({ words }) => {
      const w = String(words)
      const m = matches(w)
      return {
        pages: sites(w),
        files: names(w),
        mail: mail((x) => m(x.subject, x.from, ...x.attachments)),
        meetings: meetings(w),
        contacts: contacts(w),
      }
    },
  }
}

// Mail, calendar and contacts: who the person deals with and what comes back.
export function peopleTools(
  s: Sources,
  host: PluginHost,
  x: {
    mail: Timed<Message>[]
    meetings: Timed<Sources['meetings'][number]>[]
    mailMatching: (test: (m: Timed<Message>) => boolean) => unknown[]
    meetingsMatching: Matcher
    contactsMatching: Matcher
  },
): PluginTool[] {
  const { mail, meetings } = x
  const mailTool: PluginTool = {
    name: 'mail',
    description:
      'Mail headers only, never what a message says. Without input, who writes to the person (people, companies, automated senders), who they write to, and the subjects that come back; with someone (a name, an address or a company’s domain), every message with them; with words, the messages whose subject or attachments have them.',
    input: { who: z.string().optional(), words: z.string().optional() },
    run: async ({ who, words }) => {
      if (who) {
        const m = matches(String(who))
        return { messages: x.mailMatching((e) => m(e.from, e.fromSite, ...e.to)) }
      }
      if (words) {
        const m = matches(String(words))
        return { messages: x.mailMatching((e) => m(e.subject, ...e.attachments)) }
      }
      const received = mail.filter((m) => !m.sent)
      const sent = mail.filter((m) => m.sent)
      const dates = mail.map((m) => m.w.day).sort()
      const senders = tally(received, (m) => `${m.from}\u0000${m.fromSite}`)
      return {
        messages: mail.length,
        received: received.length,
        sent: sent.length,
        first: dates[0],
        last: dates.at(-1),
        senders: senders
          .filter(([, n]) => n > 1)
          .map(([k, n]) => {
            const [from, domain] = k.split('\u0000')
            return {
              from,
              domain,
              messages: n,
              ...(received.some((m) => m.from === from && m.automated) ? { automated: true } : {}),
            }
          }),
        sendersOnce: senders.filter(([, n]) => n === 1).length,
        youWriteTo: tally(
          sent.flatMap((m) => m.to),
          (a) => a,
        ).map(([address, n]) => ({ address, messages: n })),
        companies: tally(mail, (m) => (m.sent ? (m.to[0]?.split('@')[1] ?? null) : m.fromSite))
          .filter(([, n]) => n > 1)
          .map(([domain, n]) => ({ domain, messages: n })),
        subjectsThatComeBack: tally(mail, (m) => subjectOf(m.subject) || null)
          .filter(([, n]) => n > 1)
          .map(([subject, n]) => {
            const these = mail.filter((m) => subjectOf(m.subject) === subject)
            return {
              subject,
              messages: n,
              sent: these.filter((m) => m.sent).length,
              last: these
                .map((m) => m.w.day)
                .sort()
                .at(-1),
            }
          }),
      }
    },
  }

  const calendar: PluginTool = {
    name: 'calendar',
    description:
      'The person’s meetings. Without input, the meetings that come back (with their weekdays, usual time and people), the people met most, and the weekdays and hours that hold meetings; with words, every meeting whose title, place or people have them.',
    input: { words: z.string().optional() },
    run: async ({ words }) => {
      if (words) return { meetings: x.meetingsMatching(String(words)) }
      const timed = meetings.filter((m) => !m.allDay)
      const dates = meetings.map((m) => m.w.day).sort()
      return {
        meetings: meetings.length,
        first: dates[0],
        last: dates.at(-1),
        comeBack: tally(meetings, (m) => m.title || null)
          .filter(([, n]) => n > 1)
          .map(([title, n]) => {
            const these = timed.filter((m) => m.title === title)
            return {
              title,
              times: n,
              weekdays: weekdays(these.map((m) => m.w)),
              usualTime: tally(these, (m) => m.w.time)[0]?.[0],
              with: tally(
                these.flatMap((m) => m.people),
                (p) => p,
              ).map(([p]) => p),
            }
          }),
        people: tally(
          meetings.flatMap((m) => m.people),
          (p) => p,
        ).map(([name, n]) => ({ name, meetings: n })),
        weekdays: weekdays(timed.map((m) => m.w)),
        hours: hours(timed.map((m) => m.w)),
      }
    },
  }

  const contacts: PluginTool = {
    name: 'contacts',
    description:
      'The person’s contacts (names, companies and titles; never phone numbers or addresses) and the people they deal with most by meetings and messages. With words, the contacts whose name, company or title have them.',
    input: { words: z.string().optional() },
    run: async ({ words }) => {
      if (words) return { contacts: x.contactsMatching(String(words)) }
      const me = s.contacts.find((c) => c.me)
      return {
        contacts: s.contacts.length,
        ...(me ? { yourCard: { name: me.name, company: me.company, title: me.title } } : {}),
        companies: tally(s.contacts, (c) => c.company || null)
          .filter(([, n]) => n > 1)
          .map(([company, n]) => ({ company, contacts: n })),
        titles: tally(s.contacts, (c) => c.title || null)
          .filter(([, n]) => n > 1)
          .map(([title, n]) => ({ title, contacts: n })),
        dealtWithMost: host.people().filter((p) => p.contact > 0),
      }
    },
  }

  return [mailTool, calendar, contacts]
}
