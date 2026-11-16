// The tables every calendar and every address book lands in, whichever system keeps them (a Mac's
// own Calendar and Contacts, Outlook, Google), as Gmail and Outlook share Mail: what reads Events or
// Contacts reads them all, and People joins the same person across them. Each row keeps its source.
import type { TableSpec } from './connector.ts'

export const EVENTS: TableSpec = {
  name: 'Events',
  module: 'Calendar',
  fields: [
    { name: 'Title', kind: 'text' },
    { name: 'Starts', kind: 'date' },
    { name: 'Ends', kind: 'date' },
    { name: 'All day', kind: 'choice', choices: ['yes', 'no'] },
    { name: 'Location', kind: 'text' },
    { name: 'Calendar', kind: 'text' },
    { name: 'Attendees', kind: 'text' },
    { name: 'Organizer', kind: 'text' },
    { name: 'Your address', kind: 'text' },
  ],
  people: {
    each: 'exchange',
    channel: 'meeting',
    at: 'Starts',
    with: ['Attendees'],
    by: 'Organizer',
    you: 'Your address',
    about: 'Title',
  },
}

export const CONTACTS: TableSpec = {
  name: 'Contacts',
  module: 'Contacts',
  fields: [
    { name: 'Name', kind: 'text' },
    { name: 'Company', kind: 'text' },
    { name: 'Emails', kind: 'text' },
    { name: 'Phones', kind: 'text' },
    { name: 'Title', kind: 'text' },
    { name: 'Profile', kind: 'text' },
    { name: 'Is you', kind: 'choice', choices: ['yes', 'no'] },
  ],
  people: {
    each: 'person',
    name: 'Name',
    company: 'Company',
    title: 'Title',
    emails: 'Emails',
    phones: 'Phones',
    profile: 'Profile',
    you: { field: 'Is you', is: 'yes' },
  },
}

// An attendee or an organizer as a cell reads it: Priya <priya@harbor.example>.
export const who = (a: { name?: string | undefined; email?: string | undefined }) =>
  a.name && a.email ? `${a.name} <${a.email}>` : a.name || a.email || ''
