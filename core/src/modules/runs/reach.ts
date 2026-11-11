// What a script may reach: any site, unless the firm asks before new sites; then the sites on its
// module's list, a new one on the person's yes (gate 1). An agent's list serves its web tools and
// its shell too (docs/rules.md L1).
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { parse, stringify } from 'yaml'
import { decide, refusedBy } from '../../gates/gates.ts'
import { one, run } from '../../world/db.ts'
import { Refused } from '../../world/kinds.ts'
import type { WriteCtx } from '../../world/shape/types.ts'
import type { World } from '../../world/world.ts'
import type { ScheduleRunner } from './runner.ts'
import type { RunFor, RunPlace } from './types.ts'

// Whether the firm asks before an agent or a script opens a site it was not shown and has not
// listed: off unless the owner turns it on in Settings › Permissions, since a card for every new
// site is too much asking. Off, every site opens, and a deny rule still closes one.
const ASK = 'ask_before_sites'
export const asksBeforeSites = (world: World) =>
  one<{ value: string }>(world.db, 'SELECT value FROM meta WHERE key = ?', ASK)?.value === '1'

export function setAskBeforeSites(world: World, on: boolean, ctx: WriteCtx): void {
  if (asksBeforeSites(world) === on) return
  run(
    world.db,
    'INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value',
    ASK,
    on ? '1' : '0',
  )
  world.line({
    ...ctx,
    kind: 'shaped',
    words: on
      ? 'Agents and their scripts now ask before opening a new site.'
      : 'Agents and their scripts now open any site without asking.',
    data: { ask_before_sites: on },
  })
}

// A module's sites are in its module.yaml; an agent's, in a file its check cannot reach.
const sitesFile = (place: RunPlace) => join(place.dir, place.id ? 'module.yaml' : 'sites.yaml')

export function moduleNetwork(module: RunPlace): string[] {
  const file = sitesFile(module)
  if (!existsSync(file)) return []
  const m = (parse(readFileSync(file, 'utf8')) ?? {}) as { network?: unknown }
  return Array.isArray(m.network) ? m.network.map(String) : []
}

export function allowHost(module: RunPlace, host: string): void {
  const file = sitesFile(module)
  const m = (existsSync(file) ? parse(readFileSync(file, 'utf8')) : {}) as Record<string, unknown>
  const list = Array.isArray(m.network) ? m.network.map(String) : []
  if (!list.includes(host)) writeFileSync(file, stringify({ ...m, network: [...list, host] }))
}

// A site taken off the list: a link to it written by the agent asks again.
export function removeHost(module: RunPlace, host: string): void {
  const file = sitesFile(module)
  if (!existsSync(file)) return
  const m = (parse(readFileSync(file, 'utf8')) ?? {}) as Record<string, unknown>
  const list = Array.isArray(m.network) ? m.network.map(String) : []
  writeFileSync(file, stringify({ ...m, network: list.filter((h) => h !== host) }))
}

export const onList = (list: string[], host: string) =>
  list.some((d) => host === d || host.endsWith(`.${d}`))

// Sites a module's scripts may read: its list, or a yes on a card for that site (gate 1), which
// puts the site on the list for good.
export function reach(
  runner: ScheduleRunner,
  module: RunPlace,
  url: string,
  runId: string,
  who: RunFor,
): void {
  let host: string
  try {
    host = new URL(url).host.toLowerCase()
  } catch {
    throw new Refused(`That is not a link: ${url}`)
  }
  // the schedule whose run it is, by name: a rule may be its own
  const schedule =
    one<{ name: string }>(
      runner.world.db,
      'SELECT a.name FROM runs r JOIN schedules a ON a.id = r.schedule_id WHERE r.id = ?',
      runId,
    )?.name ?? null
  // a deny rule closes a site even on the module's list
  const denied = runner.world.rules.judge({
    effect: 'outward',
    tool: 'network',
    to: [],
    site: host,
    table: null,
    module: module.id,
    schedule,
    own: false,
  }).deny
  if (denied) {
    runner.world.rules.used(
      denied,
      `Refused: ${module.name} reading ${host}. Your rule: ${denied.words}`,
      {
        actor: { kind: 'schedule', id: schedule ?? runId },
        user: who.user,
        turn: who.turn,
        run: runId,
      },
      true,
    )
    throw new Refused(refusedBy(denied))
  }
  if (onList(moduleNetwork(module), host) || !asksBeforeSites(runner.world)) return
  const verdict = decide(runner.world, {
    call: { tool: 'network', input: { module: module.id, host } },
    effect: 'outward',
    preview: `Let ${module.name} read ${host}?`,
    yes: 'Let it read',
    restsOn: [`a run of ${module.name}’s reader`],
    detail: `${module.name}'s readers would open pages on ${host} at a person's pace, keeping to its robots rules.`,
    cannotUndo: 'What a reader asks a site for leaves your world.',
    actor: { kind: 'schedule', id: runId },
    user: who.user,
    turn: who.turn,
    module: module.id,
    schedule,
    run: runId,
  })
  if (!verdict.pass)
    throw new Refused(
      `${host} is not on ${module.name}'s list: it waits for the person's yes on a card.`,
    )
  allowHost(module, host)
  runner.world.line({
    actor: { kind: 'system' },
    kind: 'shaped',
    words: `${module.name} may now read ${host}.`,
    data: { module: module.id, host },
    module: module.id,
  })
}

// A site that wants the person to sign in: a card with Sign in, which opens the site in a window
// of Alpha's browser where they sign in themselves; then the schedule runs again (api: sign-in).
export function wantsSignIn(
  runner: ScheduleRunner,
  module: RunPlace,
  url: string,
  label: string,
  runId: string,
  scheduleId: string | null,
  who: RunFor,
): void {
  const host = new URL(url).host.toLowerCase()
  runner.world.cards.open({
    kind: 'permission',
    gate: 'sign_in',
    words: `${host} wants you to sign in`,
    detail: `${label} could not read ${host} without your sign-in. Sign in opens the site in a window of Alpha's browser; you type your login there yourself, Alpha never sees it, and the reader reads as you from then on.`,
    restsOn: [`a run of ${label}`],
    options: ['Sign in', 'Not now'],
    call: { tool: 'site_sign_in', input: { host, url, schedule: scheduleId } },
    actor: { kind: 'schedule', id: runId },
    user: who.user ?? runner.owner,
    module: module.id,
    run: runId,
  })
}

export async function browse<T>(
  runner: ScheduleRunner,
  module: RunPlace,
  url: string,
  label: string,
  runId: string,
  scheduleId: string | null,
  who: RunFor,
  read: () => Promise<T>,
): Promise<T> {
  try {
    return await read()
  } catch (err) {
    if ((err as { kind?: string }).kind === 'sign_in')
      runner.wantsSignIn(module, url, label, runId, scheduleId, who)
    throw err
  }
}
