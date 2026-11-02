// Where the window is: its address read as a place (a screen, and what is open on it). Out of
// App.tsx and Shell.tsx, so those only shrink (Batch A, the window file wall).
import type { FilePlace } from './FileView.tsx'
import { splitBeside } from './opened.ts'

export type Place =
  | { at: 'home' }
  | { at: 'conversation' }
  | { at: 'activity' }
  | { at: 'parts' }
  | { at: 'plugin'; name: string } // a plugin's own page (onboarding in Alpha, 2 Nov)
  | { at: 'new' }
  | { at: 'item'; kind: 'agent' | 'run' | 'rule'; id: string }
  | { at: 'row'; id: string }
  | { at: 'card'; id: string } // a card on its own page (Batch B, pick 13)
  | {
      at: 'table'
      id: string
      row: string | null
      only: string[] | null
      of: string | null
      field: string | null
    }
  | {
      at: 'module'
      id: string
      tab: 'overview' | 'conversation' | 'agents' | null
      page: string | null
    }
  | { at: 'settings'; section: string | null; open: null }
  | { at: 'intelligence'; section: string | null; open: string | null }
  | { at: 'file'; place: FilePlace }
  | { at: 'people'; kind: 'person' | 'company'; id: string | null }
  | {
      at: 'tasks'
      list: 'today' | 'week' | 'overdue' | 'waiting' | 'agents' | 'open' | 'done'
      id: string | null
    }

export function placeOf(address: string): Place {
  // what is open beside the page is not the page (Batch A, pick 2)
  const hash = splitBeside(address).base
  const m = /^#\/table\/([^/?]+)(?:\/([^/?]+))?(?:\?(.*))?$/.exec(hash)
  if (m?.[1]) {
    // ?only=<rows> (the rows a page counted), ?of=<row> (the parts of a row), ?field=<name>
    // (that value's panel)
    const query = new URLSearchParams(m[3] ?? '')
    const only = query.get('only')
    return {
      at: 'table',
      id: m[1],
      row: m[2] ?? null,
      only: only ? only.split(',').filter(Boolean) : null,
      of: query.get('of'),
      field: query.get('field'),
    }
  }
  const f = /^#\/file\/([0-9a-f]{16,})(?:\?(.*))?$/.exec(hash)
  if (f?.[1]) {
    const q = new URLSearchParams(f[2] ?? '')
    const box = q.get('box')?.split(',').map(Number)
    return {
      at: 'file',
      place: {
        hash: f[1],
        sheet: q.get('sheet'),
        cell: q.get('cell'),
        page: q.get('page') ? Number(q.get('page')) : null,
        box:
          box?.length === 4 && box.every(Number.isFinite)
            ? (box as [number, number, number, number])
            : null,
        line: q.get('line') ? Number(q.get('line')) : null,
      },
    }
  }
  // an old #/settings?connect= link still lands on the connection, now under Intelligence
  const c = /^#\/settings\?connect=([\w-]+)$/.exec(hash)
  if (c) return { at: 'intelligence', section: 'connections', open: c[1] ?? null }
  const s = /^#\/(settings|intelligence)(?:\/(\w+))?$/.exec(hash)
  // Permissions moved from Intelligence to Settings: an old link still lands there
  if (s)
    return s[1] === 'settings' || s[2] === 'permissions'
      ? { at: 'settings', section: s[2] ?? null, open: null }
      : { at: 'intelligence', section: s[2] ?? null, open: null }
  if (hash === '#/activity') return { at: 'activity' }
  const tk = /^#\/tasks(?:\/([\w-]+)|\?list=(\w+))?$/.exec(hash)
  if (tk)
    return {
      at: 'tasks',
      list:
        (tk[2] as
          | 'today'
          | 'week'
          | 'overdue'
          | 'waiting'
          | 'agents'
          | 'open'
          | 'done'
          | undefined) ?? 'today',
      id: tk[1] ?? null,
    }
  const pp = /^#\/people(?:\/([\w-]+)|\?(companies))?$/.exec(hash)
  if (pp) return { at: 'people', kind: pp[2] ? 'company' : 'person', id: pp[1] ?? null }
  if (hash === '#/conversation') return { at: 'conversation' }
  if (hash === '#/parts') return { at: 'parts' }
  const pl = /^#\/p\/([a-z][a-z0-9-]*)$/.exec(hash)
  if (pl?.[1]) return { at: 'plugin', name: pl[1] }
  if (hash === '#/module/new') return { at: 'new' }
  // a row's own page (core step 3b), a card's (Batch B, pick 13)
  const rw = /^#\/(row|card)\/([\w-]+)$/.exec(hash)
  if (rw?.[2]) return { at: rw[1] === 'card' ? 'card' : 'row', id: rw[2] }
  // a standing permission's old link lands on its rule (core step 2)
  const it = /^#\/(agent|run|rule|permission)\/([\w-]+)$/.exec(hash)
  if (it?.[1] && it[2])
    return {
      at: 'item',
      kind: it[1] === 'permission' ? 'rule' : (it[1] as 'agent' | 'run' | 'rule'),
      id: it[2],
    }
  const mod = /^#\/module\/([^/]+)(?:\/(overview|conversation|agents|page\/([\w-]+)))?$/.exec(hash)
  if (mod?.[1])
    return {
      at: 'module',
      id: mod[1],
      tab:
        mod[2] === 'overview' || mod[2] === 'conversation' || mod[2] === 'agents' ? mod[2] : null,
      page: mod[3] ?? null,
    }
  return { at: 'home' }
}
