// What the Interviewer reads (the redesign of 22 Nov, calls 15 and 16; one page, 23 Nov):
// connecting a source is the permission to read it, so there is no second list of
// switches. Every connected source is read together in the background as soon as What I learned
// opens, again when another is connected, never one the person turned off in Your work's Interview
// sources (rules I3); then one draft is written in the background (draft.ts) and What I learned
// fills in place. The person never waits on it.
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Input, PluginHost } from '@alpha/plugin-sdk'
import { z } from 'zod'
import { config } from './config.ts'
import { think } from './draft.ts'
import { readSite } from './site.ts'
import { connected, SOURCES } from './sources.ts'

// One person's way through the interview chapters, kept in the plugin's own folder.
export interface Story {
  reading: boolean
  read: string | null // when the sources were last read
  // what each source gave: its words for the draft, and the few the person sees
  found: { key: string; name: string; on: boolean; words: string; shown?: string[] }[]
  site: { url: string; text: string }[] // the workspace's own pages read
  drafting: boolean
  rounds: number
  problem: string | null // why the last draft did not come
  since: string | null // what changed since the last interview, as the regular check found it
}

const NONE: Story = {
  reading: false,
  read: null,
  found: [],
  site: [],
  drafting: false,
  rounds: 0,
  problem: null,
  since: null,
}

const file = (host: PluginHost) => join(host.dir, 'story.json')
const all = (host: PluginHost): Record<string, Story> =>
  existsSync(file(host)) ? JSON.parse(readFileSync(file(host), 'utf8')) : {}
export const storyOf = (host: PluginHost, person: string): Story => ({
  ...NONE,
  ...all(host)[person],
})
// At start nothing is being read or drafted: what a restart cut off is said, so the person can
// read again (Back to Get to know you) and the draft is not waited on for ever.
export function settleStories(host: PluginHost): void {
  const now = all(host)
  let changed = false
  for (const [id, st] of Object.entries(now))
    if (st.reading || st.drafting) {
      now[id] = {
        ...NONE,
        ...st,
        reading: false,
        drafting: false,
        // a reading cut off is read again when What I learned next opens
        ...(st.reading ? { read: null } : {}),
        problem: st.reading ? null : 'Alpha restarted while it was writing: press Try again.',
      }
      changed = true
    }
  if (changed) writeFileSync(file(host), JSON.stringify(now, null, 2))
}

export function keepStory(host: PluginHost, person: string, change: Partial<Story>): Story {
  const now = all(host)
  now[person] = { ...storyOf(host, person), ...change }
  writeFileSync(file(host), JSON.stringify(now, null, 2))
  return now[person] as Story
}

// MIME kinds as a person says them.
const KINDS: Record<string, string> = {
  'text/csv': 'CSV',
  'text/plain': 'text',
  'application/pdf': 'PDF',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'Excel',
  'application/vnd.ms-excel': 'Excel',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Word',
  'application/msword': 'Word',
  'image/jpeg': 'picture',
  'image/png': 'picture',
}

// What a source found, as the person reads it on Get to know you: its first line is on the row
// already, so the next two at most, the few that come back with how often, and none of the ids a
// line may cite (those are for the draft).
export function shownOf(words: string): string[] {
  return words
    .split('\n')
    .slice(1)
    .filter((l) => !/^line \d+:/.test(l))
    .map((l) =>
      l
        .replace(/\s*\((\d+);[^)]*\)/g, ' ($1)')
        .replace(/\s*\(file [0-9a-f]+\)/g, '')
        .replace(/[a-z]+\/[\w.+-]+/g, (k) => KINDS[k] ?? k.split('/')[1] ?? k)
        .replace(/<[^>]*>/g, '')
        .replace(/\s+/g, ' ')
        .trim(),
    )
    .map((l) => {
      // the first three of a list
      const [head, rest] = l.split(/:\s(.*)/s)
      if (!rest) return l
      const items = rest.replace(/\.$/, '').split('; ')
      return `${head}: ${items.slice(0, 3).join(', ')}${items.length > 3 ? ', and more' : ''}.`
    })
    .filter(Boolean)
    .slice(0, 2)
}

// The person as the Interviewer's rows name them.
export type Who = Input['person']

// Every source the person has, and the workspace's site for the owner.
export function sourcesFor(host: PluginHost, who: Who) {
  const site = who.owner ? host.workspace().site : null
  const days = config.lookback_days
  const list = SOURCES.map((s) => {
    const ready = connected(host, s)
    // the computer's readers read only on the allow; the others say what they hold now
    const has = s.atInterview
      ? ready
        ? 'Read from your computer'
        : 'Turned on in Alpha Bridge on your computer'
      : (s.read(host, who.id, days).words.split('\n')[0] ?? '')
    const there = s.atInterview ? ready : !/^No |^Nothing /.test(has)
    return { key: s.key, name: s.name, reads: s.reads, has, available: there }
  })
  return site
    ? [
        {
          key: 'site',
          name: 'Your website',
          reads:
            'Its public pages, read in the background: what you do, who for, who else is in it.',
          has: new URL(site).host,
          available: true,
        },
        ...list,
      ]
    : list
}

// The sources the person turned off, by key: Skipped in Your work's Interview sources.
function turnedOff(host: PluginHost, who: Who): string[] {
  const off = new Set(
    host.own
      .rows('Interview sources')
      .filter((r) => r.values.Person === who.name && r.values.State === 'Skipped')
      .map((r) => String(r.values.Source)),
  )
  return sourcesFor(host, who)
    .filter((s) => off.has(s.name))
    .map((s) => s.key)
}

// Read in the background when What I learned is drawn: the first time, and again once a source
// was connected since; then the draft. Nothing waits on it.
// A source's rows that come after it was read are not read again here: the monthly check finds them.
export function startReading(host: PluginHost, who: Who): void {
  const st = storyOf(host, who.id)
  if (st.reading || st.drafting) return
  const off = turnedOff(host, who)
  const ready = sourcesFor(host, who).filter((s) => s.available && !off.includes(s.key))
  const read = new Set(st.found.filter((f) => f.on).map((f) => f.key))
  if (st.read && ready.every((s) => read.has(s.key))) return
  if (!ready.length) {
    if (!st.read) keepStory(host, who.id, { read: new Date().toISOString() })
    return
  }
  void readThenDraft(host, who, off)
}

// Every connected source read, then the draft, when anything was read.
export async function readThenDraft(host: PluginHost, who: Who, off: string[]): Promise<void> {
  await readAll(host, who, [...new Set([...off, ...turnedOff(host, who)])])
  if (storyOf(host, who.id).found.some((f) => f.on)) await think(host, who)
}

// Every source read together, turned-off ones never; what was found kept as it comes.
async function readAll(host: PluginHost, who: Who, off: string[]): Promise<void> {
  keepStory(host, who.id, { reading: true, found: [], site: [], problem: null })
  const found: Story['found'] = []
  const mine = host.own.rows('Interview sources').filter((r) => r.values.Person === who.name)
  const mark = (name: string, state: 'Allowed' | 'Skipped', words: string) => {
    const row = mine.find((r) => r.values.Source === name)
    const values = { State: state, Found: words }
    const why = state === 'Allowed' ? 'connected, so read' : 'turned off by them'
    if (row) host.own.change('Interview sources', row.id, values, why)
    else
      host.own.add('Interview sources', [
        { values: { Source: name, Person: who.name, ...values }, basis: why },
      ])
  }
  try {
    for (const s of sourcesFor(host, who)) {
      const on = s.available && !off.includes(s.key)
      if (!on) {
        // only what the person turned off is marked so; one not connected is simply not read
        if (s.key !== 'site' && s.available) mark(s.name, 'Skipped', '')
        found.push({ key: s.key, name: s.name, on: false, words: 'Not read.' })
        keepStory(host, who.id, { found })
        continue
      }
      if (s.key === 'site') {
        const site = host.workspace().site
        if (!site) continue
        const read = await readSite(site)
        keepStory(host, who.id, { site: read.pages })
        found.push({
          key: s.key,
          name: s.name,
          on: true,
          words: read.found.words,
          shown: [read.found.words],
        })
        keepStory(host, who.id, { found })
        continue
      }
      const source = SOURCES.find((x) => x.key === s.key)
      if (!source) continue
      const why: string[] = []
      // a reader that reads at the interview, never on a clock, reads now (call 20)
      if (source.atInterview)
        for (const c of source.connectors) {
          const not = await host.read(c)
          if (not) why.push(not)
        }
      const words = [...why, source.read(host, who.id, config.lookback_days).words].join('\n')
      mark(source.name, 'Allowed', words)
      found.push({ key: s.key, name: s.name, on: true, words, shown: [...why, ...shownOf(words)] })
      keepStory(host, who.id, { found })
    }
  } finally {
    keepStory(host, who.id, { reading: false, read: new Date().toISOString() })
  }
  host.journal(
    `Read ${found.filter((f) => f.on).length} sources for an interview, ${found.filter((f) => !f.on).length} left unread.`,
    { person: who.id },
  )
}

// Read again now, leaving out these sources (marked turned off in Interview sources).
export const ReadBody = z.object({ off: z.array(z.string()).default([]) })
