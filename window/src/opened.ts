// What is open beside the page: a task, a run, a person, a row, a schedule, a rule, the rows a
// figure counted or the day (Home's Next), opened from a link to it, kept in the address as beside=<kind>/<id> after the
// page's own, so a reload keeps it. A link inside the panel replaces what it shows. Its own page is
// one click away (Open page). A link to a kind on that kind's own screen (a task on Tasks) opens
// there, as before.

export type OpenedKind = 'task' | 'run' | 'person' | 'row' | 'schedule' | 'rule' | 'rows' | 'day'
export interface Opened {
  kind: OpenedKind
  id: string // rows: <table>:<row>,<row>
}

const PAGE: Record<Exclude<OpenedKind, 'rows' | 'day'>, string> = {
  task: '#/tasks/',
  run: '#/run/',
  person: '#/people/',
  row: '#/row/',
  schedule: '#/schedule/',
  rule: '#/rule/',
}
// a link to each kind's page, and the screen where that kind opens itself
const LINK = /^#\/(tasks|run|people|row|schedule|rule)\/([\w-]+)$/
const ROWS = /^#\/table\/([\w-]+)\?only=([\w,-]+)$/
const KIND: Record<string, OpenedKind> = {
  tasks: 'task',
  run: 'run',
  people: 'person',
  row: 'row',
  schedule: 'schedule',
  rule: 'rule',
}
const OWN: Partial<Record<OpenedKind, RegExp>> = { task: /^#\/tasks\b/, person: /^#\/people\b/ }
const ONE = /^(task|run|person|row|schedule|rule|rows|day)\/([\w,:-]+)$/

// the day's own page is the Calendar, which the panel learns from the day itself
export const pageOf = (o: Opened) => {
  if (o.kind === 'day') return '#/'
  if (o.kind !== 'rows') return `${PAGE[o.kind]}${o.id}`
  const [table, rows] = o.id.split(':')
  return `#/table/${table}?only=${rows}`
}

// The page's own address, and what is open beside it.
export function splitBeside(hash: string): { base: string; opened: Opened | null } {
  const m = /^(.*?)[?&]beside=([\w,:/-]+)(.*)$/.exec(hash)
  const one = m ? ONE.exec(m[2] ?? '') : null
  if (!m || !one) return { base: hash, opened: null }
  const rest = (m[3] ?? '').replace(/^&/, '')
  const base = `${m[1]}${rest ? (m[1]?.includes('?') ? '&' : '?') + rest : ''}`
  return { base, opened: { kind: one[1] as OpenedKind, id: one[2] as string } }
}

export const withBeside = (base: string, o: Opened | null): string =>
  o ? `${base}${base.includes('?') ? '&' : '?'}beside=${o.kind}/${o.id}` : base

// What a link opens beside the page it is on, if it opens beside at all.
export function linkBeside(href: string, base: string): Opened | null {
  const rows = ROWS.exec(href)
  if (rows?.[1] && rows[2])
    return base === href ? null : { kind: 'rows', id: `${rows[1]}:${rows[2]}` }
  const m = LINK.exec(href)
  if (!m?.[1] || !m[2]) return null
  const kind = KIND[m[1]] as OpenedKind
  if (OWN[kind]?.test(base) || base === href) return null
  return { kind, id: m[2] }
}

// Go to an address as a click on a link to it would: a thing opens beside the page when there is
// room, anything else (or no room) goes to its page. For the places that open from a button, a row
// or a result, not an <a>.
export function openLink(href: string): void {
  const a = document.createElement('a')
  a.href = href
  a.hidden = true
  document.body.append(a)
  a.click()
  a.remove()
}
