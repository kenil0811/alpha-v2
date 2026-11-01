// The Chromium reader (onboarding step 1) on History files the test makes with Chrome's own two
// tables, one of them held locked as a running browser holds it: never a real browser's history.
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { chromiumVisits, fromChromium, profiles, toChromium } from './chromium.ts'

let root: string

function history(profile: string, visits: [string, string, string][]): DatabaseSync {
  mkdirSync(join(root, profile), { recursive: true })
  const db = new DatabaseSync(join(root, profile, 'History'))
  db.exec(`
    CREATE TABLE urls (id INTEGER PRIMARY KEY, url LONGVARCHAR, title LONGVARCHAR, visit_count INTEGER);
    CREATE TABLE visits (id INTEGER PRIMARY KEY, url INTEGER NOT NULL, visit_time INTEGER NOT NULL);
  `)
  visits.forEach(([url, title, at], i) => {
    db.prepare('INSERT OR IGNORE INTO urls (id, url, title, visit_count) VALUES (?, ?, ?, 1)').run(
      i + 1,
      url,
      title,
    )
    db.prepare('INSERT INTO visits (url, visit_time) VALUES (?, ?)').run(i + 1, toChromium(at))
  })
  return db
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'alpha-chrome-'))
})
afterEach(() => rmSync(root, { recursive: true, force: true }))

describe('the Chromium reader', () => {
  it('turns Chromium’s microseconds since 1601 into moments and back', () => {
    const at = '2026-10-31T09:15:00.000Z'
    expect(fromChromium(toChromium(at))).toBe(at)
  })

  it('reads every profile’s visits since a moment, oldest first, as raw rows', () => {
    history('Default', [
      [
        'https://www.bizbuysell.example/listing/1?ref=x',
        'A car wash for sale',
        '2026-10-20T10:00:00.000Z',
      ],
      ['https://old.example/', 'Too old', '2026-06-01T10:00:00.000Z'],
    ]).close()
    history('Profile 2', [
      ['https://docs.example/d/1', 'Q3 plan', '2026-10-25T08:00:00.000Z'],
    ]).close()
    mkdirSync(join(root, 'System Profile'))
    mkdirSync(join(root, 'Profile 3')) // no history kept
    expect(profiles(root)).toEqual(['Default', 'Profile 2'])
    expect(chromiumVisits(root, '2026-08-01T00:00:00.000Z')).toEqual([
      {
        profile: 'Default',
        url: 'https://www.bizbuysell.example/listing/1?ref=x',
        title: 'A car wash for sale',
        at: '2026-10-20T10:00:00.000Z',
      },
      {
        profile: 'Profile 2',
        url: 'https://docs.example/d/1',
        title: 'Q3 plan',
        at: '2026-10-25T08:00:00.000Z',
      },
    ])
  })

  it('reads a history the browser holds locked, from a copy, and leaves no copy behind', () => {
    const live = history('Default', [['https://a.example/', 'A', '2026-10-20T10:00:00.000Z']])
    live.exec('BEGIN EXCLUSIVE')
    live
      .prepare('INSERT INTO urls (id, url, title) VALUES (9, ?, ?)')
      .run('https://b.example/', 'B')
    try {
      expect(chromiumVisits(root, '2026-10-01T00:00:00.000Z').map((v) => v.url)).toEqual([
        'https://a.example/',
      ])
    } finally {
      live.exec('ROLLBACK')
      live.close()
    }
  })

  it('finds nothing where the browser is not there', () => {
    expect(chromiumVisits(join(root, 'nowhere'), '2026-10-01T00:00:00.000Z')).toEqual([])
  })
})
