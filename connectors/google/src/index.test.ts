// Google on made-up Calendar and People answers: never a real account. What Google is asked, and
// how its answers become rows of the Events and Contacts every source shares.
import { type Host, type Item, makeCall } from '@alpha/connector-sdk'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { google } from './index.ts'

const ME = 'test@gmail.example'
const asked: string[] = []
let answers: (url: URL) => { status?: number; json?: unknown }

beforeEach(() => {
  asked.length = 0
  vi.stubGlobal('fetch', async (input: string | URL) => {
    const url = new URL(String(input))
    asked.push(url.toString())
    const a = answers(url)
    return new Response(JSON.stringify(a.json ?? {}), {
      status: a.status ?? 200,
      headers: { 'content-type': 'application/json' },
    })
  })
})
afterEach(() => vi.unstubAllGlobals())

function host() {
  const landed: { table: string; items: Item[] }[] = []
  const h: Host & { landed: typeof landed } = {
    account: ME,
    landed,
    secret: async () => 'short-lived',
    cursor: () => null,
    setCursor: () => {},
    land: (table, items) => {
      landed.push({ table, items })
      return { added: items.length, changed: 0, same: 0 }
    },
    journal: () => {},
  }
  return h
}
const call = (h: Host) =>
  makeCall(google.manifest, h, {
    judgements: { retries: 0, busyWaitMs: 60_000, fewerRowsRatio: 0.5, quietDays: 7 },
    sleep: async () => {},
  })

describe('Google', () => {
  it('reads every calendar’s events and the contacts into Events and Contacts', async () => {
    answers = (url) => {
      if (url.pathname.endsWith('/calendarList'))
        return {
          json: {
            items: [
              { id: 'primary', summary: 'Kenil' },
              { id: 'work@x', summary: 'Work' },
            ],
          },
        }
      if (url.pathname.includes('/calendars/primary/events'))
        return url.searchParams.get('pageToken')
          ? { json: { items: [{ id: 'e2', status: 'cancelled' }] } }
          : {
              json: {
                items: [
                  {
                    id: 'e1',
                    summary: 'Harbor call',
                    start: { dateTime: '2026-11-17T15:00:00Z' },
                    end: { dateTime: '2026-11-17T15:30:00Z' },
                    attendees: [
                      { email: 'priya@harbor.example', displayName: 'Priya' },
                      { email: ME, self: true },
                    ],
                    organizer: { email: ME, self: true },
                  },
                ],
                nextPageToken: 'p2',
              },
            }
      if (url.pathname.includes('/calendars/work%40x/events'))
        return {
          json: {
            items: [
              {
                id: 'w1',
                summary: 'Offsite',
                start: { date: '2026-11-20' },
                end: { date: '2026-11-21' },
              },
            ],
          },
        }
      if (url.pathname.endsWith('/people/me/connections'))
        return {
          json: {
            connections: [
              {
                resourceName: 'people/c1',
                names: [{ displayName: 'Priya Shah' }],
                emailAddresses: [{ value: 'priya@harbor.example' }],
                phoneNumbers: [{ value: '+1 555 0100' }],
                organizations: [{ name: 'Harbor Mills', title: 'Owner' }],
                urls: [{ value: 'https://www.linkedin.com/in/priyashah' }],
              },
            ],
          },
        }
      return { status: 404, json: { error: { message: `nothing at ${url.pathname}` } } }
    }
    const h = host()
    const out = await google.sync?.(call(h))
    expect(out).toEqual({ rows: 3, sawNew: true })
    const events = h.landed.find((l) => l.table === 'Events')?.items ?? []
    expect(events.map((e) => [e.key, e.values.Calendar, e.values['All day']])).toEqual([
      ['primary/e1', 'Kenil', 'no'],
      ['work@x/w1', 'Work', 'yes'],
    ])
    expect(events[0]?.values).toMatchObject({
      Attendees: `Priya <priya@harbor.example>, ${ME}`,
      Organizer: ME,
      'Your address': ME,
    })
    expect(h.landed.find((l) => l.table === 'Address book')?.items[0]?.values).toMatchObject({
      Name: 'Priya Shah',
      Company: 'Harbor Mills',
      Title: 'Owner',
      Profile: 'https://www.linkedin.com/in/priyashah',
    })
    // the events 90 days back and 60 ahead, every occurrence of a repeating one
    const first = new URL(asked.find((u) => u.includes('/calendars/primary/events')) ?? '')
    expect(first.searchParams.get('singleEvents')).toBe('true')
  })

  it('asks to sign in again as the connection’s own account', async () => {
    answers = () => ({ json: { email: 'someone@else.example' } })
    await expect(google.check?.(call(host()))).rejects.toThrow(/sign in again as test@gmail/)
  })
})
