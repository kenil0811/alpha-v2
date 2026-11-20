// Where the window is: its address read as a place (a screen, and what is open on it). Out of
// App.tsx and Shell.tsx, so those only shrink (the window file wall).
import type { FilePlace } from './FileView.tsx'
import { splitBeside } from './opened.ts'

export type Place =
  | { at: 'home' }
  | { at: 'conversation'; setup: boolean } // Agents: the chosen agent's chat, or its Setup
  | { at: 'parts' }
  | { at: 'plugin'; name: string } // a plugin's own page
  | { at: 'item'; kind: 'schedule' | 'run' | 'rule'; id: string }
  | { at: 'agent'; id: string }
  | { at: 'work'; id: string } // the work on a task, on a page of its own
  | { at: 'row'; id: string }
  | { at: 'card'; id: string } // a card on its own page
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
      tab: 'overview' | 'setup' | 'details' | null
      page: string | null
    }
  | { at: 'settings'; section: string | null; open: string | null }
  | { at: 'file'; place: FilePlace }
  | { at: 'computer'; id: string }
  | { at: 'people'; kind: 'person' | 'company'; id: string | null }
  | {
      at: 'tasks'
      list: 'today' | 'week' | 'overdue' | 'waiting' | 'open' | 'done'
      id: string | null
    }

export function placeOf(address: string): Place {
  // what is open beside the page is not the page
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
  // #/intelligence was Settings' other half: its old addresses read as Settings' (forwarded)
  const c = /^#\/(?:settings|intelligence)\/connections\?connect=([\w-]+)$/.exec(hash)
  if (c) return { at: 'settings', section: 'connections', open: c[1] ?? null }
  // Files on one module's files, from its Setup
  const fm = /^#\/(?:settings|intelligence)\/files\?module=([\w-]+)$/.exec(hash)
  if (fm) return { at: 'settings', section: 'files', open: fm[1] ?? null }
  const s = /^#\/(?:settings|intelligence)(?:\/(\w+))?$/.exec(hash)
  if (s) return { at: 'settings', section: s[1] ?? null, open: null }
  const work = /^#\/tasks\/([\w-]+)\/work$/.exec(hash)
  if (work?.[1]) return { at: 'work', id: work[1] }
  const tk = /^#\/tasks(?:\/([\w-]+)|\?list=(\w+))?$/.exec(hash)
  if (tk)
    return {
      at: 'tasks',
      list:
        (tk[2] as 'today' | 'week' | 'overdue' | 'waiting' | 'open' | 'done' | undefined) ??
        'today',
      id: tk[1] ?? null,
    }
  const pp = /^#\/people(?:\/([\w-]+)|\?(companies))?$/.exec(hash)
  if (pp) return { at: 'people', kind: pp[2] ? 'company' : 'person', id: pp[1] ?? null }
  if (hash === '#/conversation' || hash === '#/conversation/setup')
    return { at: 'conversation', setup: hash.endsWith('/setup') }
  if (hash === '#/parts') return { at: 'parts' }
  const pl = /^#\/p\/([a-z][a-z0-9-]*)$/.exec(hash)
  if (pl?.[1]) return { at: 'plugin', name: pl[1] }
  // a row's own page, a card's
  const rw = /^#\/(row|card)\/([\w-]+)$/.exec(hash)
  if (rw?.[2]) return { at: rw[1] === 'card' ? 'card' : 'row', id: rw[2] }
  const pc = /^#\/computer\/([\w-]+)$/.exec(hash)
  if (pc?.[1]) return { at: 'computer', id: pc[1] }
  const ag = /^#\/agent\/([\w-]+)$/.exec(hash)
  if (ag?.[1]) return { at: 'agent', id: ag[1] }
  const it = /^#\/(schedule|run|rule)\/([\w-]+)$/.exec(hash)
  if (it?.[1] && it[2]) return { at: 'item', kind: it[1] as 'schedule' | 'run' | 'rule', id: it[2] }
  const mod = /^#\/module\/([^/]+)(?:\/(overview|setup|details|page\/([\w-]+)))?$/.exec(hash)
  if (mod?.[1])
    return {
      at: 'module',
      id: mod[1],
      tab: mod[2] === 'overview' || mod[2] === 'setup' || mod[2] === 'details' ? mod[2] : null,
      page: mod[3] ?? null,
    }
  return { at: 'home' }
}

// An agent's, a computer's, a schedule's and a rule's own page sit under Settings on the rail.
// Old Intelligence addresses become Settings' (bookmarks, links kept elsewhere).
export const forward = (hash: string): string =>
  hash.replace(/^#\/intelligence(?=$|[/?])/, '#/settings')

export const inSettings = (p: Place): boolean =>
  p.at === 'settings' ||
  (p.at === 'item' && p.kind === 'rule') ||
  p.at === 'agent' ||
  p.at === 'computer' ||
  (p.at === 'item' && p.kind === 'schedule')
