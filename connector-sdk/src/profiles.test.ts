// Profiles per person and site: a site is its registrable name, each person's sign-ins are their
// own, and the folders of before (one per address) are gone. No browser is started.
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { BrowserEngine, siteOf } from './browser.ts'

let home: string
let engine: BrowserEngine
const pace = { minMs: 0, maxMs: 0 }

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), 'alpha-profiles-'))
  engine = new BrowserEngine({ browsers: join(home, 'b'), profiles: join(home, 'p'), pace })
})
afterEach(() => rmSync(home, { recursive: true, force: true }))

describe('profiles per person and site', () => {
  it('names a site by its registrable name, by the public suffix list', () => {
    expect(siteOf('drive.google.com')).toBe('google.com')
    expect(siteOf('docs.google.com')).toBe('google.com')
    expect(siteOf('www.acme.co.uk')).toBe('acme.co.uk')
    expect(siteOf('127.0.0.1:4790')).toBe('127.0.0.1:4790')
  })

  it('keeps each person’s sign-ins their own: one Google sign-in covers Drive and Docs', async () => {
    engine.as('u_ann').markSignedIn('https://drive.google.com/drive/my-drive')
    expect(engine.as('u_ann').signedIn('https://docs.google.com/document/d/1')).toBe(true)
    expect(engine.as('u_bob').signedIn('https://drive.google.com/')).toBe(false)
    expect(engine.signedIn('https://drive.google.com/')).toBe(false)
    expect(
      engine
        .as('u_ann')
        .sites()
        .map((s) => s.site),
    ).toEqual(['google.com'])
    expect(engine.as('u_bob').sites()).toEqual([])
    // signing out is one person's, and takes that profile
    engine.as('u_bob').markSignedIn('https://google.com/')
    await engine.as('u_ann').signOut('google.com')
    expect(engine.as('u_ann').sites()).toEqual([])
    expect(
      engine
        .as('u_bob')
        .sites()
        .map((s) => s.site),
    ).toEqual(['google.com'])
    expect(existsSync(join(home, 'p', 'u_bob', 'google.com'))).toBe(true)
  })

  it('a person’s name cannot reach another’s folder', () => {
    engine.as('../u_bob').markSignedIn('https://google.com/')
    expect(readdirSync(join(home, 'p'))).not.toContain('u_bob')
  })

  it('drops the folders of before, one per address, so each person signs in again', () => {
    mkdirSync(join(home, 'q', 'drive.google.com'), { recursive: true })
    mkdirSync(join(home, 'q', 'u_ann', 'google.com'), { recursive: true })
    new BrowserEngine({ browsers: join(home, 'b'), profiles: join(home, 'q'), pace })
    expect(readdirSync(join(home, 'q'))).toEqual(['u_ann'])
  })
})
