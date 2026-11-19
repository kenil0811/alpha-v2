// Where each person's interview stands, and its routes (the onboarding plan, calls 6, 9 and 24):
// Home asks to get to know them until they finish or Decline; Start begins the interview in
// the Interviewer's chat, and again carries on where it stopped; Finish now is always there once
// it is under way. When each was pressed is kept per person in the plugin's own folder; what was
// said is in the Interviewer's chat and the report's rows.
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Input, PluginHost } from '@alpha/plugin-sdk'
import { config } from './config.ts'
import type { HomeView } from './home-view.ts'
import { SOURCES } from './sources.ts'

interface Pressed {
  started?: string
  declined?: string
  finished?: string
  last?: 'started' | 'declined' | 'finished' // the latest of them
}

export const TITLE = 'Let Alpha get to know you'
const AGENT = 'interviewer'
const CLOSED = new Set(['Agreed', 'Not worth building'])

const file = (host: PluginHost) => join(host.dir, 'interviews.json')
const all = (host: PluginHost): Record<string, Pressed> =>
  existsSync(file(host)) ? JSON.parse(readFileSync(file(host), 'utf8')) : {}
const pressed = (host: PluginHost, person: string): Pressed => all(host)[person] ?? {}
function press(host: PluginHost, person: string, change: Pressed): void {
  const now = all(host)
  now[person] = { ...now[person], ...change }
  writeFileSync(file(host), JSON.stringify(now, null, 2))
}

// Where one person's interview stands, from what they pressed and what Your work holds of theirs.
export function homeOf(host: PluginHost, who: Input['person']): HomeView {
  const p = pressed(host, who.id)
  const mine = (table: string) => host.own.rows(table).filter((r) => r.values.Person === who.name)
  const flows = mine('Workflows')
  const answered = mine('Interview sources').filter((r) => r.values.State !== 'Asked').length
  const closed = flows.filter((w) => CLOSED.has(String(w.values.Status))).length
  const about = mine('About you')
  // the report has no blanks: every workflow closed and every line about them decided
  const complete =
    flows.length > 0 && closed === flows.length && about.every((a) => a.values.State !== 'Proposed')
  return {
    title: TITLE,
    state:
      p.last === 'finished' || (p.last === 'started' && complete)
        ? 'done'
        : p.last === 'declined'
          ? 'declined'
          : p.last === 'started'
            ? 'part way'
            : 'start',
    sources: { answered, of: SOURCES.length },
    workflows: { all: flows.length, closed },
    agent: 'Interviewer',
  }
}

const brief = (words: string, name: string) => words.replaceAll('{name}', name).trim()

export function homeRoutes(host: PluginHost): void {
  host.route('GET', '/home', async ({ person }) => homeOf(host, person))
  // Start, or Start again: in the Interviewer's chat, carrying on where it stopped
  host.route('POST', '/start', async ({ person }) => {
    const again = !!pressed(host, person.id).started
    press(host, person.id, { started: new Date().toISOString(), last: 'started' })
    host.converse(
      person.id,
      AGENT,
      again ? 'Carried on from Home' : 'Started from Home',
      brief(again ? config.briefs.carry_on : config.briefs.start, person.name),
    )
    host.journal(again ? 'Carried on an interview.' : 'Started an interview.', {
      person: person.id,
    })
    return homeOf(host, person)
  })
  host.route('POST', '/decline', async ({ person }) => {
    press(host, person.id, { declined: new Date().toISOString(), last: 'declined' })
    host.journal('Declined an interview on Home.', { person: person.id })
    return homeOf(host, person)
  })
  host.route('POST', '/finish', async ({ person }) => {
    press(host, person.id, { finished: new Date().toISOString(), last: 'finished' })
    host.converse(person.id, AGENT, 'Finished from Home', brief(config.briefs.finish, person.name))
    host.journal('Finished an interview: Finish now.', { person: person.id })
    return homeOf(host, person)
  })
}
