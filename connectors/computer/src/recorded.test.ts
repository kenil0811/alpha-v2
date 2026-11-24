// A recorded computer: a journey's readers read a home made up from its recorded answers, never
// the Mac the journey runs on; with no recorded answer there is nothing to read.
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, expect, it } from 'vitest'
import { visitsIn } from './history.ts'
import { browserName, claudeDir, historyFiles } from './paths.ts'
import { claudeRequests, webConversations } from './read.ts'
import { recordedHome } from './recorded.ts'

let dir: string
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'alpha-recorded-'))
})
afterEach(() => rmSync(dir, { recursive: true, force: true }))

const NOW = Date.parse('2026-11-22T12:00:00Z')
const DAY = 86_400_000
// where a Mac keeps Chrome (the readers look there on a Mac only; this test runs anywhere)
const chrome = (home: string) => join(home, 'Library', 'Application Support', 'Google', 'Chrome')

function answers(files: Record<string, unknown>): string {
  const at = join(dir, 'answers')
  for (const [name, body] of Object.entries(files)) {
    mkdirSync(join(at, name.split('/')[0] ?? ''), { recursive: true })
    writeFileSync(join(at, name), JSON.stringify(body))
  }
  mkdirSync(at, { recursive: true })
  return at
}

it('makes the browsing history and Claude Code sessions from the recorded answers, newest a day back', () => {
  const home = recordedHome(
    answers({
      'browsing/history-any.json': {
        browser: 'Chrome',
        visits: [
          { url: 'https://chatgpt.com/c/1', title: 'Quote wording', at: '2026-01-10T10:00:00Z' },
          { url: 'https://timbermart.example/orders', title: 'Orders', at: '2026-01-12T10:00:00Z' },
        ],
      },
      'ai-work/requests-any.json': {
        requests: [{ request: 'Total the lumber', project: 'jobs', at: '2026-01-11T10:00:00Z' }],
      },
    }),
    join(dir, 'home'),
    NOW,
  )
  const visits = visitsIn(historyFiles(chrome(home)), 90, NOW)
  expect(visits.map((v) => [v.url, v.at])).toEqual([
    ['https://chatgpt.com/c/1', NOW - DAY - 2 * DAY],
    ['https://timbermart.example/orders', NOW - DAY],
  ])
  expect(webConversations(visits).map((r) => r.request)).toEqual(['Quote wording'])
  const asked = claudeRequests(claudeDir(home), 90, NOW)
  expect(asked.map((r) => [r.request, r.project, r.at])).toEqual([
    ['Total the lumber', 'jobs', new Date(NOW - DAY).toISOString()],
  ])
})

it('leaves nothing to read where nothing was recorded', () => {
  const home = recordedHome(answers({}), join(dir, 'home'), NOW)
  expect(existsSync(chrome(home))).toBe(false)
  expect(claudeRequests(claudeDir(home), 90, NOW)).toEqual([])
})

// Edge seemed unread: each browser's history is read and named by the folder it sits in, and a
// person's folder named like a browser names nothing.
it('reads Edge’s history beside Chrome’s, each by its own name', () => {
  const visit = (url: string, at: string) => ({ url, title: 'Page', at })
  const home = recordedHome(
    answers({
      'browsing/history-any.json': {
        visits: [visit('https://chrome.example/', '2026-01-10T10:00:00Z')],
      },
      'browsing/history-edge.json': {
        browser: 'Edge',
        visits: [visit('https://edge.example/', '2026-01-11T10:00:00Z')],
      },
    }),
    join(dir, 'marcia'), // "arc" is in the name: it must not make Edge's history Arc's
    NOW,
  )
  const support = join(home, 'Library', 'Application Support')
  const files = [join(support, 'Google', 'Chrome'), join(support, 'Microsoft Edge')].flatMap((r) =>
    historyFiles(r),
  )
  expect(visitsIn(files, 90, NOW).map((v) => [v.browser, v.url])).toEqual([
    ['Chrome', 'https://chrome.example/'],
    ['Edge', 'https://edge.example/'],
  ])
})

it('names each browser by where its profiles sit', () => {
  expect(browserName('/Users/marcia/Library/Application Support/Google/Chrome')).toBe('Chrome')
  expect(browserName('/Users/marcia/Library/Application Support/Arc/User Data')).toBe('Arc')
  expect(browserName('/Users/sam/Library/Application Support/Microsoft Edge')).toBe('Edge')
})
