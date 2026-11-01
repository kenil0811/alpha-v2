// What is open beside the page (Batch A, pick 2, Kenil's yes 1 Nov): a task, a run, a person or a
// row, opened from a link to it, kept in the address as beside=<kind>/<id> after the page's own,
// so a reload keeps it and Back closes it. Its own page is one click away (Open page). A link to
// a kind on that kind's own screen (a task on Tasks) opens there, as before.

export type OpenedKind = 'task' | 'run' | 'person' | 'row'
export interface Opened {
  kind: OpenedKind
  id: string
}

const PAGE: Record<OpenedKind, string> = {
  task: '#/tasks/',
  run: '#/run/',
  person: '#/people/',
  row: '#/row/',
}
// a link to each kind's page, and the screen where that kind opens itself
const LINK = /^#\/(tasks|run|people|row)\/([\w-]+)$/
const KIND: Record<string, OpenedKind> = { tasks: 'task', run: 'run', people: 'person', row: 'row' }
const OWN: Partial<Record<OpenedKind, RegExp>> = { task: /^#\/tasks\b/, person: /^#\/people\b/ }

export const pageOf = (o: Opened) => `${PAGE[o.kind]}${o.id}`

// The page's own address, and what is open beside it.
export function splitBeside(hash: string): { base: string; opened: Opened | null } {
  const m = /^(.*?)[?&]beside=(task|run|person|row)\/([\w-]+)(.*)$/.exec(hash)
  if (!m) return { base: hash, opened: null }
  const rest = (m[4] ?? '').replace(/^&/, '')
  const base = `${m[1]}${rest ? (m[1]?.includes('?') ? '&' : '?') + rest : ''}`
  return { base, opened: { kind: m[2] as OpenedKind, id: m[3] as string } }
}

export function withBeside(base: string, o: Opened | null): string {
  return o ? `${base}${base.includes('?') ? '&' : '?'}beside=${o.kind}/${o.id}` : base
}

// What a link opens beside the page it is on, if it opens beside at all.
export function linkBeside(href: string, base: string): Opened | null {
  const m = LINK.exec(href)
  if (!m?.[1] || !m[2]) return null
  const kind = KIND[m[1]] as OpenedKind
  if (OWN[kind]?.test(base) || base === href) return null
  return { kind, id: m[2] }
}
