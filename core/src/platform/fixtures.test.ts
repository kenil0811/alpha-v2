// The helper's answers recorded on Kenil's Mac (onboarding step 1), replayed by the tests of the
// steps after it. A wall: they carry the shape and the counts of a real Mac, never a real name,
// site, title, path or app.
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const DIR = join(import.meta.dirname, 'fixtures', 'mac')
const read = (name: string) =>
  JSON.parse(readFileSync(join(DIR, `${name}.json`), 'utf8')) as Record<
    string,
    Record<string, unknown>[]
  >

describe('the Mac recordings', () => {
  it('are every source the trial read', () => {
    expect(readdirSync(DIR).sort()).toEqual([
      'app-time.json',
      'apps.json',
      'chrome.json',
      'files-desktop.json',
      'files-documents.json',
      'files-downloads.json',
      'safari-visits.json',
    ])
  })

  it('hold no real site, title, path or app', () => {
    for (const name of ['safari-visits', 'chrome'])
      for (const v of read(name).visits ?? []) {
        expect(String(v.url)).toMatch(/^https:\/\/site-\d{3}\.example\/page-\d{3}$/)
        expect(String(v.title)).toMatch(/^(title-\d{3})?$/)
      }
    for (const a of read('apps').apps ?? []) {
      expect(String(a.name)).toMatch(/^app-\d{3}$/)
      expect(String(a.id)).toMatch(/^(example\.bundle-\d{3})?$/)
    }
    for (const s of read('app-time').spans ?? [])
      expect(String(s.app)).toMatch(/^example\.bundle-\d{3}$/)
    for (const folder of ['documents', 'desktop', 'downloads'])
      for (const f of read(`files-${folder}`).files ?? [])
        for (const part of String(f.path).split('/'))
          expect(part).toMatch(/^(folder-\d{3}|file-\d{3}(\.[A-Za-z0-9]{1,5})?)$/)
  })
})
