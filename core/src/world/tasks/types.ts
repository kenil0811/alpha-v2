import { dayOf } from '../day.ts'
import { Refused } from '../kinds.ts'
import type { WriteCtx } from '../shape/index.ts'

export const TASK_STATES = ['todo', 'doing', 'waiting', 'done', 'dropped'] as const
export type TaskState = (typeof TASK_STATES)[number]
export const PRIORITIES = ['high', 'normal', 'low'] as const
export type Priority = (typeof PRIORITIES)[number]
export const OPEN: TaskState[] = ['todo', 'doing', 'waiting']

export const STATE_WORDS: Record<TaskState, string> = {
  todo: 'To do',
  doing: 'In progress',
  waiting: 'Waiting',
  done: 'Done',
  dropped: 'Dropped',
}

// Where a task sits: a module, and within it a table, a row and a field, or a page.
export interface Place {
  module: string | null
  table: string | null
  row: string | null
  field: string | null
  page: string | null
}

export interface PlaceInput {
  module?: string | undefined
  table?: string | undefined
  row?: string | undefined
  field?: string | undefined
  page?: string | undefined
}

export interface Ref {
  kind: 'row' | 'person' | 'file'
  ref: string
}

export interface Repeat {
  unit: 'day' | 'weekday' | 'week' | 'month' | 'year'
  every: number
  weekday?: number // 0 Sunday … 6 Saturday
  monthday?: number
}

export interface Task {
  id: string
  title: string
  state: TaskState
  notes: string | null
  due: string | null
  remindAt: string | null
  remindedAt: string | null
  repeat: string | null // as the person said it
  priority: Priority
  owner: { kind: 'person' | 'alpha' | 'agent'; id: string | null }
  parent: string | null
  place: Place
  placedBy: string | null // the person, Alpha, or where it was made
  placedWhy: string | null
  refs: Ref[]
  madeBy: string
  run: string | null // the run it serves (agents on tasks)
  createdAt: string
  updatedAt: string
  doneAt: string | null
}

export interface TaskInput {
  title: string
  notes?: string | null
  due?: string | null
  remindAt?: string | null
  repeat?: string | null
  priority?: Priority
  owner?: { kind: 'person' | 'alpha' | 'agent'; id?: string | null }
  parent?: string | null
  on?: PlaceInput | null
  refs?: Ref[]
  placedBy?: string | null
  placedWhy?: string | null
}

export interface TaskRow {
  id: string
  title: string
  state: TaskState
  notes: string | null
  due: string | null
  remind_at: string | null
  reminded_at: string | null
  repeat: string | null
  repeat_rule: string | null
  repeat_next: string | null
  priority: Priority
  owner_kind: 'person' | 'alpha' | 'agent'
  owner_id: string | null
  parent_id: string | null
  module_id: string | null
  table_id: string | null
  record_id: string | null
  field_id: string | null
  page: string | null
  placed_by: string | null
  placed_why: string | null
  made_by: string
  run_id: string | null
  created_at: string
  updated_at: string
  done_at: string | null
}

export const WEEKDAYS = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
]

// A repeat as people say it: every day, every weekday, every Monday, every 2 weeks, monthly, on the
// 1st of each month, every year. Anything else is refused in words.
export function readRepeat(words: string): Repeat {
  const w = words.trim().toLowerCase()
  if (/^(every day|daily)$/.test(w)) return { unit: 'day', every: 1 }
  if (/^every (week ?day|working day)s?$/.test(w)) return { unit: 'weekday', every: 1 }
  if (/^(weekly|every week)$/.test(w)) return { unit: 'week', every: 1 }
  if (/^(monthly|every month)$/.test(w)) return { unit: 'month', every: 1 }
  if (/^(yearly|annually|every year)$/.test(w)) return { unit: 'year', every: 1 }
  const day = /^every (\w+?)s?$/.exec(w)
  if (day && WEEKDAYS.includes(day[1] as string))
    return { unit: 'week', every: 1, weekday: WEEKDAYS.indexOf(day[1] as string) }
  const n = /^every (\d+|other) (day|week|month|year)s?$/.exec(w)
  if (n) return { unit: n[2] as Repeat['unit'], every: n[1] === 'other' ? 2 : Number(n[1]) }
  const md = /^(?:on )?the (\d{1,2})(?:st|nd|rd|th)? (?:of )?(?:each|every) month$/.exec(w)
  if (md && Number(md[1]) >= 1 && Number(md[1]) <= 31)
    return { unit: 'month', every: 1, monthday: Number(md[1]) }
  throw new Refused(
    `"${words}" is not a repeat Alpha reads: say every day, every weekday, every Monday, every 2 weeks, monthly or on the 1st of each month.`,
  )
}

export const pad = (n: number) => String(n).padStart(2, '0')
// the person's own day, one helper for the whole core (Batch A, pick 4)
export { dayOf }

// The next due after this one: the same time of day when it has one.
export function nextDue(rule: Repeat, due: string): string {
  const timed = due.includes('T')
  const d = new Date(timed ? due : `${due}T12:00:00`)
  const step = () => {
    if (rule.unit === 'day') d.setDate(d.getDate() + rule.every)
    else if (rule.unit === 'weekday') {
      do d.setDate(d.getDate() + 1)
      while (d.getDay() === 0 || d.getDay() === 6)
    } else if (rule.unit === 'week') {
      if (rule.weekday === undefined) d.setDate(d.getDate() + 7 * rule.every)
      else
        do d.setDate(d.getDate() + 1)
        while (d.getDay() !== rule.weekday)
    } else if (rule.unit === 'month') {
      const want = rule.monthday ?? d.getDate()
      d.setDate(1)
      d.setMonth(d.getMonth() + rule.every)
      const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
      d.setDate(Math.min(want, last))
    } else d.setFullYear(d.getFullYear() + rule.every)
  }
  step()
  return timed ? d.toISOString() : dayOf(d)
}

// A due or a reminder as a moment: a day is its morning, at 09:00 the person's time.
export function momentOf(when: string): number {
  return Date.parse(when.includes('T') ? when : `${when}T09:00:00`)
}

// A day or a moment as the person reads it, in this Mac's time: Fri 24 Oct, or Fri 24 Oct, 10:00.
export function whenSaid(v: string): string {
  const d = new Date(v.includes('T') ? v : `${v}T12:00:00`)
  const day = d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
  return v.includes('T')
    ? `${day}, ${d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`
    : day
}

export function checkWhen(name: string, v: string | null | undefined): string | null {
  if (v === undefined || v === null || v === '') return null
  const t = v.trim()
  if (!/^\d{4}-\d{2}-\d{2}(T[\d:.]+(Z|[+-]\d{2}:?\d{2})?)?$/.test(t) || Number.isNaN(momentOf(t)))
    throw new Refused(`${name} takes a day like 2026-10-24, or a moment like 2026-10-24T10:00:00.`)
  return t
}

export function emptyPlace(): Place {
  return { module: null, table: null, row: null, field: null, page: null }
}

export function placeInput(p: Place): PlaceInput {
  return {
    ...(p.module ? { module: p.module } : {}),
    ...(p.table ? { table: p.table } : {}),
    ...(p.row ? { row: p.row } : {}),
    ...(p.field ? { field: p.field } : {}),
    ...(p.page ? { page: p.page } : {}),
  }
}

// A reminder kept as far before the next due as it was before this one.
export function shiftLike(remind: string, from: string, to: string): string {
  const gap = momentOf(from) - momentOf(remind)
  return new Date(momentOf(to) - gap).toISOString()
}

export function actorWord(ctx: WriteCtx): string {
  return ctx.actor.id ? `${ctx.actor.kind}:${ctx.actor.id}` : ctx.actor.kind
}
