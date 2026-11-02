// The three connectors for this computer in the core (onboarding step 3): each in its own process,
// asking the core's reader for raw rows across the pipe and counting them there; kept from the
// model; the person's never-use list honoured; "Not on this computer" where the core has no
// reader. The reader is made up here: never a real computer's.
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { type Connector, type LocalReader, MemorySecrets } from '@alpha/connector-sdk'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { World } from '../world/world.ts'
import { loadSet, STANDARD_DIR } from './discover.ts'
import { ConnectorService } from './service.ts'

let home: string
let world: World
let known: Connector[]
const day = (d: number, h = 12) => new Date(2026, 9, d, h).toISOString()

// a computer with Chrome and Safari, Safari's history locked, and three folders
const reader: LocalReader = {
  access: async (part) =>
    part === 'safari' ? { state: 'settings', where: 'its settings' } : { state: 'ready' },
  browsers: async () => [
    { id: 'chrome', name: 'Google Chrome', format: 'chromium' },
    { id: 'safari', name: 'Safari', format: 'safari' },
  ],
  visits: async (browser) =>
    browser === 'chrome'
      ? [
          { url: 'https://www.bizbuysell.com/a', title: 'Car wash for sale', at: day(20) },
          { url: 'https://bizbuysell.com/b', title: 'Laundromat', at: day(21) },
          { url: 'https://docs.example.org/1', title: 'Q3 plan', at: day(20) },
          { url: 'https://docs.example.org/2', title: 'Q3 plan', at: day(22) },
        ]
      : [{ url: 'https://never.example/', title: 'Locked', at: day(20) }],
  apps: async () => [{ id: 'com.example.sheets', name: 'Sheets', launches: 9 }],
  appTime: async () => [{ id: 'com.example.sheets', day: '2026-10-30', seconds: 7200 }],
  files: async (folder) => [
    { folder, path: 'Deals/Harbor/CIM.pdf', kind: 'pdf', modified: day(29) },
  ],
  showSettings: () => undefined,
}

beforeEach(async () => {
  home = mkdtempSync(join(tmpdir(), 'alpha-this-computer-'))
  world = await World.open(join(home, 'tenants', 't_test'))
  known = (await loadSet(STANDARD_DIR)).connectors
})
afterEach(() => {
  world.close()
  rmSync(home, { recursive: true, force: true })
})

describe('the connectors for this computer', () => {
  it('count what the core’s reader gives them across their own process, part by part', async () => {
    const svc = new ConnectorService(world, { secrets: new MemorySecrets(), known, local: reader })
    try {
      for (const name of ['browsing', 'apps', 'filenames'])
        await svc.connect(name, 'This computer', null, 'u_1')
      const browsing = (await svc.runTool('browsing', 'sites', { days: 400 })) as {
        parts: Record<string, string>
        sites: { site: string; visits: number; days: number }[]
      }
      expect(browsing.parts).toEqual({ chrome: 'ready', safari: 'settings' })
      // Safari's history is not read while it is locked
      expect(browsing.sites.map((s) => [s.site, s.visits, s.days])).toEqual([
        ['bizbuysell.com', 2, 2],
        ['docs.example.org', 2, 2],
      ])
      const apps = (await svc.runTool('apps', 'apps', { days: 7 })) as {
        apps: { name: string; hoursWeek?: number }[]
      }
      expect(apps.apps).toEqual([
        { id: 'com.example.sheets', name: 'Sheets', launches: 9, hoursWeek: 2 },
      ])
      const files = (await svc.runTool('filenames', 'files', {})) as {
        recent: { folder: string; path: string }[]
      }
      expect(files.recent.map((f) => f.folder)).toEqual(['documents', 'desktop', 'downloads'])
    } finally {
      svc.close()
    }
  })

  it('never count what the person left out', async () => {
    const svc = new ConnectorService(world, { secrets: new MemorySecrets(), known, local: reader })
    try {
      const conn = await svc.connect('browsing', 'This computer', null, 'u_1')
      world.connections.setNever(conn.id, ['BizBuySell.com'], {
        actor: { kind: 'person', id: 'u_1' },
      })
      const { sites } = (await svc.runTool('browsing', 'sites', { days: 400 })) as {
        sites: { site: string }[]
      }
      expect(sites.map((s) => s.site)).toEqual(['docs.example.org'])
      expect(world.lines({ kinds: ['connection'] }).at(-1)?.words).toMatch(
        /set 1 thing This computer never counts\.$/,
      )
    } finally {
      svc.close()
    }
  })

  it('are kept from the model: no tool, no tile', async () => {
    const svc = new ConnectorService(world, { secrets: new MemorySecrets(), known, local: reader })
    try {
      expect(svc.toolNames().filter((t) => /browsing|apps|filenames/.test(t))).toEqual([])
      expect(
        svc
          .entries()
          .map((e) => e.name)
          .filter((n) => /browsing|filenames/.test(n)),
      ).toEqual([])
      expect(svc.isTool('mcp__browsing__sites')).toBe(false)
    } finally {
      svc.close()
    }
  })

  it('say "Not on this computer" where the core has no reader for it', async () => {
    const svc = new ConnectorService(world, { secrets: new MemorySecrets(), known })
    try {
      await expect(svc.connect('browsing', 'This computer', null, 'u_1')).rejects.toThrow(
        /Not on this computer/,
      )
    } finally {
      svc.close()
    }
  })
})
