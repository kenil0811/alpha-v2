// A person's day, for Home's Next and the day beside it (ui-rules O1, L14): the meetings in Alpha's
// own Calendar that touch the day, from the calendars this person connected, and the open tasks due
// that day. The window says which day is today and where it starts and ends in its own time (W7).
// It reads only.
import { EVENTS } from '@alpha/connector-sdk'
import type { World } from '../world/world.ts'

export interface DayEvent {
  id: string
  table: string
  title: string
  starts: string
  ends: string | null
  allDay: boolean
  location: string | null
}

export interface DayTask {
  id: string
  title: string
  due: string
  timed: boolean // due at a time, not only on the day
}

export interface Day {
  calendar: string | null // the Calendar's Events, where the day opens whole
  events: DayEvent[]
  tasks: DayTask[]
}

const dateOnly = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v)

// The person a connection belongs to: the one who connected it, or whose computer it runs on.
function ownerOf(world: World, connector: string, account: string): string | null {
  const k = world.connections.find(connector, account)
  if (!k) return null
  if (k.computer) return world.computers.get(k.computer)?.user ?? null
  const [kind, id] = k.madeBy.split(/:(.*)/s)
  return kind === 'person' ? (id ?? null) : null
}

export function theDay(
  world: World,
  user: string,
  on: { date: string; from: string; to: string },
): Day {
  const from = Date.parse(on.from)
  const to = Date.parse(on.to)
  // an all-day event's dates hold the day; a timed one's moments cross it
  const touches = (s: string, e: string | null) =>
    dateOnly(s)
      ? s <= on.date && (e && dateOnly(e) && e > s ? e > on.date : s === on.date)
      : Date.parse(s) < to && Date.parse(e ?? s) >= from
  const tasks = world.tasks.list({ open: true }).flatMap((t): DayTask[] => {
    if (!t.due) return []
    const timed = t.due.includes('T')
    const today = timed ? touches(t.due, null) : t.due === on.date
    return today ? [{ id: t.id, title: t.title, due: t.due, timed }] : []
  })
  const module = world.shape.ownModule(EVENTS.module ?? 'Calendar')
  const table = module ? world.shape.ownTable(module.id, EVENTS.name) : undefined
  if (!table) return { calendar: null, events: [], tasks }
  // the Calendar's fields by their lasting keys, so a renamed one still reads (rules M5)
  const field = (key: string) => table.fields.find((f) => f.key === key)
  const [title, starts, ends, allDay, location] = [
    'Title',
    'Starts',
    'Ends',
    'All day',
    'Location',
  ].map(field)
  if (!starts) return { calendar: table.id, events: [], tasks }
  const endOf = new Map(
    ends ? world.records.column(table.id, ends.id).map((c) => [c.id, c.value]) : [],
  )
  const events: DayEvent[] = []
  for (const c of world.records.column(table.id, starts.id)) {
    const e = endOf.get(c.id)
    if (typeof c.value !== 'string' || !touches(c.value, typeof e === 'string' ? e : null)) continue
    const rec = world.records.get(c.id)
    if (!rec || rec.record.goneAt) continue
    // another person's calendar is theirs: none of what came through their connection
    const src = rec.record.provenance[starts.slug]?.source
    const who = src?.connector && src.account ? ownerOf(world, src.connector, src.account) : null
    if (who && who !== user) continue
    const v = rec.record.values
    const text = (f: typeof title) => {
      const x = f ? v[f.slug] : undefined
      return typeof x === 'string' && x ? x : null
    }
    events.push({
      id: c.id,
      table: table.id,
      title: text(title) ?? 'An event',
      starts: c.value,
      ends: text(ends),
      allDay: text(allDay) === 'yes' || dateOnly(c.value),
      location: text(location),
    })
  }
  events.sort((a, b) => Date.parse(a.starts) - Date.parse(b.starts))
  return { calendar: table.id, events, tasks }
}
