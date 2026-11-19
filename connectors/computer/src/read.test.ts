// The computer's readers on made-up files: a browser's history, Claude Code's and Codex's
// sessions. What leaves the computer is counted there: sites on two days or more, titles without
// addresses or numbers, and only the person's own requests, never what the AI answered.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { visitsIn } from './history.ts'
import { claudeRequests, codexRequests, sitesOf, webConversations } from './read.ts'

let dir: string
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'alpha-computer-'))
})
afterEach(() => rmSync(dir, { recursive: true, force: true }))

const NOW = Date.parse('2026-11-19T12:00:00Z')
const DAY = 86_400_000
const chrome = (ms: number) => (ms + 11_644_473_600_000) * 1000

function history(visits: { url: string; title: string; at: number }[]): string {
  const file = join(dir, 'History')
  const db = new DatabaseSync(file)
  db.exec(`CREATE TABLE urls (id INTEGER PRIMARY KEY, url TEXT, title TEXT);
           CREATE TABLE visits (id INTEGER PRIMARY KEY, url INTEGER, visit_time INTEGER);`)
  visits.forEach((v, i) => {
    db.prepare('INSERT INTO urls (id, url, title) VALUES (?, ?, ?)').run(i + 1, v.url, v.title)
    db.prepare('INSERT INTO visits (url, visit_time) VALUES (?, ?)').run(i + 1, chrome(v.at))
  })
  db.close()
  return file
}

describe('browsing', () => {
  it('counts each site by the days it was opened, and sends only those on two days or more', () => {
    const file = history([
      {
        url: 'https://www.bizbuysell.com/a',
        title: 'Listing 4412 for sam@oak.example',
        at: NOW - DAY,
      },
      { url: 'https://bizbuysell.com/b', title: 'Search results', at: NOW - 3 * DAY },
      { url: 'https://once.example/x', title: 'Once', at: NOW - DAY },
      { url: 'http://localhost:4700/', title: 'Alpha', at: NOW - DAY },
      { url: 'http://localhost:4700/', title: 'Alpha', at: NOW - 2 * DAY },
      { url: 'https://old.example/', title: 'Old', at: NOW - 200 * DAY },
      { url: 'https://old.example/', title: 'Old', at: NOW - 201 * DAY },
    ])
    const sites = sitesOf(visitsIn([{ browser: 'Chrome', file }], 90, NOW))
    expect(sites.map((s) => [s.site, s.days])).toEqual([['bizbuysell.com', 2]])
    expect(sites[0]?.titles).toBe('Listing for; Search results')
  })

  it('finds ChatGPT’s and claude.ai’s conversations by their titles', () => {
    const file = history([
      { url: 'https://chatgpt.com/c/abc-123', title: 'Pricing a kitchen job', at: NOW - DAY },
      { url: 'https://claude.ai/chat/xyz-9', title: 'Invoice follow-up email - Claude', at: NOW },
      { url: 'https://chatgpt.com/', title: 'ChatGPT', at: NOW },
    ])
    const found = webConversations(visitsIn([{ browser: 'Chrome', file }], 90, NOW))
    expect(found.map((r) => [r.tool, r.request]).sort()).toEqual([
      ['ChatGPT', 'Pricing a kitchen job'],
      ['claude.ai', 'Invoice follow-up email'],
    ])
  })
})

describe('AI work', () => {
  it('keeps the person’s own Claude Code prompts, never replies, tool results or another program’s', () => {
    const p = join(dir, 'claude', '-Users-sam-quotes')
    mkdirSync(p, { recursive: true })
    const at = new Date(NOW - DAY).toISOString()
    const line = (o: Record<string, unknown>) =>
      JSON.stringify({ timestamp: at, cwd: '/Users/sam/quotes', ...o })
    writeFileSync(
      join(p, 's1.jsonl'),
      [
        line({
          type: 'user',
          uuid: 'u1',
          message: { role: 'user', content: 'Draft a quote for the Lee kitchen\nfrom my notes' },
        }),
        line({ type: 'assistant', message: { role: 'assistant', content: 'Here is the quote' } }),
        line({
          type: 'user',
          uuid: 'u2',
          message: { role: 'user', content: [{ type: 'tool_result', content: 'ok' }] },
        }),
        line({
          type: 'user',
          uuid: 'u3',
          message: { role: 'user', content: '<command-name>/clear</command-name>' },
        }),
        line({
          type: 'user',
          uuid: 'u4',
          entrypoint: 'sdk-ts',
          message: { role: 'user', content: 'An agent’s brief' },
        }),
      ].join('\n'),
    )
    const found = claudeRequests(join(dir, 'claude'), 90, NOW)
    expect(found.map((r) => [r.request, r.project])).toEqual([
      ['Draft a quote for the Lee kitchen from my notes', 'quotes'],
    ])
  })

  it('keeps the person’s own Codex messages, with the session’s folder', () => {
    const p = join(dir, 'codex', '2026', '11', '18')
    mkdirSync(p, { recursive: true })
    const at = new Date(NOW - DAY).toISOString()
    writeFileSync(
      join(p, 'rollout-1.jsonl'),
      [
        JSON.stringify({
          timestamp: at,
          type: 'session_meta',
          payload: { cwd: '/Users/sam/site' },
        }),
        JSON.stringify({
          timestamp: at,
          type: 'event_msg',
          payload: { type: 'user_message', message: 'Fix the contact form' },
        }),
        JSON.stringify({
          timestamp: at,
          type: 'event_msg',
          payload: { type: 'agent_message', message: 'Done' },
        }),
      ].join('\n'),
    )
    expect(codexRequests(join(dir, 'codex'), 90, NOW).map((r) => [r.request, r.project])).toEqual([
      ['Fix the contact form', 'site'],
    ])
  })
})
