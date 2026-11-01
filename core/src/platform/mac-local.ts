// The Mac's reader for onboarding (design §4): Chrome through the shared Chromium reader, the rest
// through Alpha's helper run as the app, so macOS asks naming Alpha. The helper's answers are raw
// rows; here they take the reader's shapes, its refusals the five access words with where macOS
// switches Alpha on, and Screen Time's spans the time in each app on each of the person's days.
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import {
  type Access,
  type AppSeen,
  type AppTime,
  type Browser,
  type FileSeen,
  type Folder,
  type LocalReader,
  Problem,
  type Visit,
} from '@alpha/connector-sdk'
import { dayOf } from '../world/day.ts'
import { chromiumVisits } from './readers/chromium.ts'

// The helper, run as the app: its answer, or a Problem with its own words.
export type RunHelper = (args: string[]) => Promise<unknown>

const DISK = 'System Settings › Privacy & Security › Full Disk Access'
const FILES = 'System Settings › Privacy & Security › Files & Folders'
const WHERE: Record<string, string> = {
  safari: DISK,
  'screen-time': DISK,
  documents: FILES,
  desktop: FILES,
  downloads: FILES,
}

// The helper's refusals as every platform says them.
export function accessOf(err: unknown): Access {
  const words = err instanceof Error ? err.message : String(err)
  if (/full disk access is off/.test(words)) return 'settings'
  if (/^absent$/.test(words)) return 'absent'
  if (/access (is off|was not given)/.test(words)) return 'refused'
  throw err
}

// Screen Time's spans as the time in each app on each of the person's days (a span is counted on
// the day it began).
export function timeByDay(
  spans: { app: string; start: string; end: string }[],
  zone?: string,
): AppTime[] {
  const by = new Map<string, AppTime>()
  for (const s of spans) {
    const seconds = (Date.parse(s.end) - Date.parse(s.start)) / 1000
    if (!s.app || !(seconds > 0)) continue
    const day = dayOf(new Date(s.start), zone)
    const key = `${s.app} ${day}`
    const was = by.get(key)
    if (was) was.seconds += seconds
    else by.set(key, { id: s.app, day, seconds })
  }
  return [...by.values()].map((t) => ({ ...t, seconds: Math.round(t.seconds) }))
}

// A name's kind: a project (a folder with its own version history), a folder, or its extension.
export function kindOf(row: { path: string; folder?: boolean; project?: boolean }): string {
  if (row.project) return 'project'
  if (row.folder) return 'folder'
  return /\.([A-Za-z0-9]{1,8})$/.exec(row.path)?.[1]?.toLowerCase() ?? ''
}

export class MacReader implements LocalReader {
  readonly run: RunHelper
  readonly chrome: string
  readonly zone: string | undefined

  constructor(run: RunHelper, home = homedir(), zone?: string) {
    this.run = run
    this.chrome = join(home, 'Library', 'Application Support', 'Google', 'Chrome')
    this.zone = zone
  }

  // the helper's answer, a refusal said with where to switch Alpha on
  private async ask<T>(part: string, args: string[]): Promise<T> {
    try {
      return (await this.run(args)) as T
    } catch (err) {
      const state = accessOf(err)
      throw new Problem(
        state === 'absent'
          ? `${part} is not on this Mac.`
          : `Alpha may not read ${part} yet: switch Alpha on in ${WHERE[part] ?? 'System Settings › Privacy & Security'}.`,
        state === 'absent' ? 'gone' : 'sign_in',
      )
    }
  }

  async access(part: string): Promise<{ state: Access; where?: string }> {
    if (part === 'chrome') return { state: existsSync(this.chrome) ? 'ready' : 'absent' }
    let state: Access
    try {
      state = ((await this.run(['access', part])) as { state: Access }).state
    } catch (err) {
      state = accessOf(err)
    }
    const where = WHERE[part]
    return state === 'settings' || state === 'refused'
      ? { state, ...(where ? { where } : {}) }
      : { state }
  }

  async browsers(): Promise<Browser[]> {
    return [
      ...(existsSync(this.chrome)
        ? [{ id: 'chrome', name: 'Google Chrome', format: 'chromium' as const }]
        : []),
      { id: 'safari', name: 'Safari', format: 'safari' },
    ]
  }

  async visits(browser: string, since: string): Promise<Visit[]> {
    if (browser === 'chrome')
      return chromiumVisits(this.chrome, since).map(({ url, title, at }) => ({ url, title, at }))
    if (browser !== 'safari')
      throw new Problem(`${browser} is not a browser Alpha reads on this Mac.`)
    const a = await this.ask<{ visits: Visit[] }>('safari', ['safari-visits', since])
    return a.visits.map((v) => ({ url: v.url, title: v.title ?? '', at: v.at }))
  }

  async apps(): Promise<AppSeen[]> {
    const a = await this.ask<{
      apps: { id: string; name: string; lastUsed: string; launches: number }[]
    }>('apps', ['apps'])
    return a.apps.map((x) => ({
      id: x.id || x.name,
      name: x.name,
      ...(x.lastUsed ? { lastUsed: x.lastUsed } : {}),
      ...(x.launches ? { launches: x.launches } : {}),
    }))
  }

  async appTime(since: string): Promise<AppTime[]> {
    const a = await this.ask<{ spans: { app: string; start: string; end: string }[] }>(
      'screen-time',
      ['app-time', since],
    )
    return timeByDay(a.spans, this.zone)
  }

  async files(folder: Folder): Promise<FileSeen[]> {
    const a = await this.ask<{
      files: { path: string; folder?: boolean; project?: boolean; modified: string }[]
    }>(folder, ['files', folder])
    return a.files.map((f) => ({ folder, path: f.path, kind: kindOf(f), modified: f.modified }))
  }

  showSettings(part: string): void {
    void this.run(['show-settings', part]).catch(() => undefined)
  }
}
