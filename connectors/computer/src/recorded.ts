// A recorded computer: a person's folder made up from a journey's recorded answers, for the readers
// to read where ALPHA_COMPUTER_HOME points (paths.ts), so a journey never reads the Mac it runs on.
// browsing/history-<any name>.json becomes the history of the browser it names (Chrome when it names
// none), each in its own Default profile, Safari's as Safari keeps it; ai-work/requests-any.json becomes Claude
// Code's sessions. Their times move together so the newest is a day before now, inside the days the
// readers read. A reader with no recorded answer finds nothing here.
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { claudeDir, macFolder } from './paths.ts'

const DAY = 86_400_000
const FROM_1601 = 11_644_473_600_000
const FROM_2001 = 978_307_200_000

interface Visits {
  browser?: string
  visits: { url: string; title: string; at: string }[]
}
interface Requests {
  requests: { request: string; project: string; at: string }[]
}

const read = <T>(file: string): T | null =>
  existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as T) : null

// How far the recorded times move: the newest lands a day before now.
const shiftOf = (times: string[], now: number) =>
  times.length ? now - DAY - Math.max(...times.map((t) => Date.parse(t))) : 0

// Safari's history as Safari keeps it: items and their visits, times in seconds since 2001.
function safariRecorded(home: string, visits: Visits, shift: number): void {
  mkdirSync(join(home, 'Library', 'Safari'), { recursive: true })
  const db = new DatabaseSync(join(home, 'Library', 'Safari', 'History.db'))
  db.exec(`CREATE TABLE IF NOT EXISTS history_items (id INTEGER PRIMARY KEY, url TEXT);
           CREATE TABLE IF NOT EXISTS history_visits (id INTEGER PRIMARY KEY, history_item INTEGER,
             visit_time REAL, title TEXT);
           DELETE FROM history_items; DELETE FROM history_visits;`)
  visits.visits.forEach((v, i) => {
    db.prepare('INSERT INTO history_items (id, url) VALUES (?, ?)').run(i + 1, v.url)
    db.prepare('INSERT INTO history_visits (history_item, visit_time, title) VALUES (?, ?, ?)').run(
      i + 1,
      (Date.parse(v.at) + shift - FROM_2001) / 1000,
      v.title,
    )
  })
  db.close()
}

export function recordedHome(answers: string, home: string, now = Date.now()): string {
  mkdirSync(home, { recursive: true })
  const there = join(answers, 'browsing')
  const histories = (existsSync(there) ? readdirSync(there) : [])
    .filter((n) => /^history-.*\.json$/.test(n))
    .map((n) => read<Visits>(join(there, n)) as Visits)
  // every browser's times move together, as one computer's do
  const shift = shiftOf(
    histories.flatMap((h) => h.visits.map((v) => v.at)),
    now,
  )
  for (const visits of histories) {
    if (visits.browser === 'Safari') {
      safariRecorded(home, visits, shift)
      continue
    }
    const profile = join(
      home,
      'Library',
      'Application Support',
      ...macFolder(visits.browser ?? 'Chrome').split('/'),
      'Default',
    )
    mkdirSync(profile, { recursive: true })
    const db = new DatabaseSync(join(profile, 'History'))
    db.exec(`CREATE TABLE IF NOT EXISTS urls (id INTEGER PRIMARY KEY, url TEXT, title TEXT);
             CREATE TABLE IF NOT EXISTS visits (id INTEGER PRIMARY KEY, url INTEGER, visit_time INTEGER);
             DELETE FROM urls; DELETE FROM visits;`)
    visits.visits.forEach((v, i) => {
      db.prepare('INSERT INTO urls (id, url, title) VALUES (?, ?, ?)').run(i + 1, v.url, v.title)
      const at = BigInt(Date.parse(v.at) + shift + FROM_1601) * 1000n
      db.prepare('INSERT INTO visits (url, visit_time) VALUES (?, ?)').run(i + 1, at)
    })
    db.close()
  }
  const asked = read<Requests>(join(answers, 'ai-work', 'requests-any.json'))
  if (asked) {
    const shift = shiftOf(
      asked.requests.map((r) => r.at),
      now,
    )
    const by = new Map<string, string[]>()
    asked.requests.forEach((r, i) => {
      const line = {
        type: 'user',
        uuid: `recorded-${i + 1}`,
        cwd: `/Users/someone/${r.project}`,
        timestamp: new Date(Date.parse(r.at) + shift).toISOString(),
        message: { role: 'user', content: r.request },
      }
      by.set(r.project, [...(by.get(r.project) ?? []), JSON.stringify(line)])
    })
    for (const [project, lines] of by) {
      const folder = join(claudeDir(home), `-Users-someone-${project}`)
      mkdirSync(folder, { recursive: true })
      writeFileSync(join(folder, 'session.jsonl'), `${lines.join('\n')}\n`)
    }
  }
  return home
}
