// The Mac's reader (onboarding step 2) on the helper's answers recorded on Kenil's Mac in step 1,
// names replaced: the helper is faked, so no test touches a Mac. The plain platform has no reader.
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Problem } from '@alpha/connector-sdk'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { accessOf, kindOf, MacReader, timeByDay } from './mac-local.ts'
import { PlainPlatform } from './plain.ts'

const recorded = (name: string) =>
  JSON.parse(readFileSync(join(import.meta.dirname, 'fixtures', 'mac', `${name}.json`), 'utf8'))

let home: string
const asked: string[][] = []
// the helper as step 1 recorded it; a part named in `refuse` answers as macOS refuses it
const fake =
  (refuse: Record<string, string> = {}) =>
  async (args: string[]) => {
    asked.push(args)
    const [cmd, arg] = args
    const no = refuse[arg ?? ''] ?? refuse[cmd ?? '']
    if (no) throw new Problem(no, 'other')
    if (cmd === 'files') return recorded(`files-${arg}`)
    if (cmd === 'access') return { ok: true, state: 'ready' }
    if (cmd === 'show-settings') return { ok: true }
    return recorded(cmd === 'safari-visits' ? 'safari-visits' : String(cmd))
  }

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), 'alpha-mac-'))
  asked.length = 0
})
afterEach(() => rmSync(home, { recursive: true, force: true }))

describe('the Mac reader', () => {
  it('names Chrome only where it is, and Safari always', async () => {
    expect((await new MacReader(fake(), home).browsers()).map((b) => b.id)).toEqual(['safari'])
    mkdirSync(join(home, 'Library', 'Application Support', 'Google', 'Chrome'), { recursive: true })
    expect(await new MacReader(fake(), home).browsers()).toEqual([
      { id: 'chrome', name: 'Google Chrome', format: 'chromium' },
      { id: 'safari', name: 'Safari', format: 'safari' },
    ])
  })

  it('reads Safari, the apps, Screen Time and the folders through the helper, in the reader’s shapes', async () => {
    const r = new MacReader(fake(), home, 'UTC')
    const visits = await r.visits('safari', '2026-08-01T00:00:00Z')
    expect(visits.length).toBe(recorded('safari-visits').visits.length)
    expect(Object.keys(visits[0] ?? {}).sort()).toEqual(['at', 'title', 'url'])
    const apps = await r.apps()
    expect(apps.length).toBe(recorded('apps').apps.length)
    expect(apps.every((a) => a.id && a.name)).toBe(true)
    expect(apps.filter((a) => a.lastUsed).length).toBe(
      recorded('apps').apps.filter((a: { lastUsed: string }) => a.lastUsed).length,
    )
    const time = await r.appTime('2026-10-01T00:00:00Z')
    expect(time.length).toBeGreaterThan(0)
    expect(time.every((t) => /^\d{4}-\d{2}-\d{2}$/.test(t.day) && t.seconds > 0)).toBe(true)
    const files = await r.files('downloads')
    expect(files.every((f) => f.folder === 'downloads')).toBe(true)
    expect(new Set(files.map((f) => f.kind)).has('folder')).toBe(true)
    expect(asked.map((a) => a[0])).toEqual(['safari-visits', 'apps', 'app-time', 'files'])
  })

  it('says each part’s state in the five words, with where macOS switches Alpha on', async () => {
    const r = new MacReader(
      fake({
        safari: 'full disk access is off',
        'safari-visits': 'full disk access is off',
        'screen-time': 'absent',
        desktop: 'desktop access is off',
      }),
      home,
    )
    expect(await r.access('safari')).toEqual({
      state: 'settings',
      where: 'System Settings › Privacy & Security › Full Disk Access',
    })
    expect(await r.access('screen-time')).toEqual({ state: 'absent' })
    expect(await r.access('desktop')).toEqual({
      state: 'refused',
      where: 'System Settings › Privacy & Security › Files & Folders',
    })
    expect(await r.access('documents')).toEqual({ state: 'ready' })
    expect(await r.access('chrome')).toEqual({ state: 'absent' })
    await expect(r.visits('safari', '2026-08-01T00:00:00Z')).rejects.toThrow(
      /switch Alpha on in System Settings › Privacy & Security › Full Disk Access/,
    )
    expect(() => accessOf(new Error('something else'))).toThrow('something else')
  })

  it('counts Screen Time by app and the person’s day, a folder with its own history as a project', () => {
    expect(
      timeByDay(
        [
          { app: 'a', start: '2026-10-31T09:00:00Z', end: '2026-10-31T09:30:00Z' },
          { app: 'a', start: '2026-10-31T23:50:00Z', end: '2026-11-01T00:20:00Z' },
          { app: 'b', start: '2026-10-31T10:00:00Z', end: '2026-10-31T10:00:00Z' },
        ],
        'UTC',
      ),
    ).toEqual([{ id: 'a', day: '2026-10-31', seconds: 3600 }])
    // in Chicago the late span is still the 31st; in Singapore both are the 1st
    expect(
      timeByDay(
        [{ app: 'a', start: '2026-10-31T23:50:00Z', end: '2026-11-01T00:20:00Z' }],
        'Asia/Singapore',
      ),
    ).toEqual([{ id: 'a', day: '2026-11-01', seconds: 1800 }])
    expect([
      kindOf({ path: 'Deals/LOI draft.DOCX' }),
      kindOf({ path: 'alpha', folder: true, project: true }),
      kindOf({ path: 'Deals', folder: true }),
      kindOf({ path: 'README' }),
    ]).toEqual(['docx', 'project', 'folder', ''])
  })

  it('is none on the plain platform, where Windows plugs in later', () => {
    expect(new PlainPlatform().local(null)).toBeNull()
    expect(new PlainPlatform().local('/anywhere')).toBeNull()
  })
})
