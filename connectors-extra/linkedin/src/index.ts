// LinkedIn, read as the person (Kenil, 21 Oct): they sign in themselves in Google Chrome, in a
// profile of its own, and their connections are read from their own connections page the way they
// would scroll it, at a person's pace, newest first. LinkedIn's robots rules ask crawlers not to
// read it; this is the person reading their own page, by their choice, and any check page stops
// it. Nothing is ever written to LinkedIn.
import { readFileSync } from 'node:fs'
import { type Call, type Connector, type Item, Problem } from '@alpha/connector-sdk'

const SITE = 'https://www.linkedin.com'
export const CONNECTIONS = `${SITE}/mynetwork/invite-connect/connections/`
const PROFILE = '^/in/[^/]+/?$'

// A profile's address as it is kept: https://www.linkedin.com/in/<name>/
export function profileOf(href: string): string | null {
  const m = /linkedin\.com\/in\/([^/?#]+)/i.exec(href)
  return m ? `${SITE}/in/${decodeURIComponent(m[1] as string).toLowerCase()}/` : null
}

const NOT_WORDS =
  /^(message|remove connection|more|follow|connect|pending|view profile|\d+(st|nd|rd|th)?)$/i

// One connection from what its card says: its name, its headline, and when they connected; the
// headline's position and company when it says "<position> at <company>".
export function connectionOf(link: { href: string; text: string; card: string }): Item | null {
  const profile = profileOf(link.href)
  if (!profile) return null
  const lines = link.card
    .split('\n')
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(
      (l) => l && !NOT_WORDS.test(l) && !/^view .*profile$/i.test(l) && !/['’]s profile$/i.test(l),
    )
    .filter((l) => l !== '·')
  const name = (lines[0] ?? link.text.split('\n')[0] ?? '').replace(/['’]s profile$/i, '').trim()
  if (!name) return null
  const connected = lines.map((l) => /^connected (?:on )?(.+)$/i.exec(l)?.[1]).find(Boolean)
  const headline = lines.find((l, i) => i > 0 && l !== name && !/^connected /i.test(l)) ?? ''
  const at = /^(.*?)\s+(?:at|@)\s+(.+?)(?:\s+[|·•].*)?$/i.exec(headline)
  const when = connected ? new Date(`${connected} 12:00 UTC`) : null
  return {
    key: profile,
    values: {
      Name: name,
      Profile: profile,
      ...(headline ? { Headline: headline } : {}),
      ...(at ? { Position: (at[1] as string).trim(), Company: (at[2] as string).trim() } : {}),
      ...(when && !Number.isNaN(when.getTime())
        ? { 'Connected on': when.toISOString().slice(0, 10) }
        : {}),
    },
  }
}

function browser(c: Call) {
  const b = c.host.browser?.()
  if (!b) throw new Problem("Alpha's browser is not set up in this core.")
  return b
}

export const linkedin: Connector = {
  manifest: {
    name: 'linkedin',
    title: 'LinkedIn',
    auth: 'browser',
    icon: 'network',
    account: { label: 'Your LinkedIn', placeholder: 'linkedin.com' },
    warning:
      'LinkedIn opens in its own window of Google Chrome: sign in there yourself, then quit that Chrome. Alpha then reads your connections the way you would, slowly, once a day, and stops at any check page. It never writes to LinkedIn. LinkedIn asks that its pages not be read automatically; reading them is your choice.',
    pace: { perMinute: 6 },
    syncEveryMinutes: 24 * 60,
    signIn: `${SITE}/login`,
  },
  guide: readFileSync(new URL('../GUIDE.md', import.meta.url), 'utf8'),
  module: 'LinkedIn',
  tables: [
    {
      name: 'LinkedIn connections',
      fields: [
        { name: 'Name', kind: 'text' },
        { name: 'Profile', kind: 'link' },
        { name: 'Headline', kind: 'text' },
        { name: 'Position', kind: 'text' },
        { name: 'Company', kind: 'text' },
        { name: 'Connected on', kind: 'date' },
      ],
      // each connection is one of the person's people, by their profile link
      people: {
        each: 'person',
        name: 'Name',
        profile: 'Profile',
        title: 'Position',
        company: 'Company',
      },
    },
  ],
  tools: {},
  check: async (c) => {
    if (!browser(c).signedIn(CONNECTIONS))
      throw new Problem('Sign in to LinkedIn in Google Chrome first.', 'sign_in')
  },
  // The newest first: once one read has reached the end of the list, a round of only connections
  // already kept ends the next.
  sync: async (c) => {
    const kept = c.host.keys?.('LinkedIn connections') ?? []
    const whole = c.host.cursor()?.startsWith('whole:') ?? false
    const known = whole ? kept : []
    const read = await c.call('connections', { known: known.length }, () =>
      browser(c).scrollLinks(CONNECTIONS, { pattern: PROFILE, known, asPerson: true }),
    )
    if (read.ended === 'end') c.host.setCursor(`whole:${new Date().toISOString().slice(0, 10)}`)
    const items = read.links
      .map(connectionOf)
      .filter((i): i is Item => !!i)
      .filter((i, n, all) => all.findIndex((x) => x.key === i.key) === n)
    const landed = c.host.land('LinkedIn connections', items)
    c.host.journal(
      `Read ${items.length} connections in ${read.rounds} scrolls${read.ended === 'end' ? ', to the end of the list' : read.ended === 'known' ? ', up to those already kept' : ''}.`,
    )
    return { rows: kept.length + landed.added, sawNew: landed.added > 0 }
  },
}

// What a folder of this connector exports for Alpha to load.
export const connector = linkedin
