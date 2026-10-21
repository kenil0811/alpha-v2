// Tasks (design §4, Kenil's plan of 21 Oct): one list of all work, the person's and what they hand
// to agents. A task sits on the place it concerns (a module, a table, a row, a field, a page), so
// its neighbours are its context, and may touch other rows and people. It has a state, a due date
// and a reminder, a repeat in words (each occurrence its own task), a priority and an owner (the
// person, Alpha or an agent). Every change is journaled; a repeating task makes its next one once,
// when it is done or dropped or its day has passed.
import { all, type Db, json, newId, now, one, parse, run, tx } from './db.ts'
import { append } from './journal.ts'
import { Refused } from './kinds.ts'
import type { Shape, WriteCtx } from './shape.ts'

export const TASK_STATES = ['todo', 'doing', 'waiting', 'done', 'dropped'] as const
export type TaskState = (typeof TASK_STATES)[number]
export const PRIORITIES = ['high', 'normal', 'low'] as const
export type Priority = (typeof PRIORITIES)[number]
const OPEN: TaskState[] = ['todo', 'doing', 'waiting']

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

interface TaskRow {
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

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

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

const pad = (n: number) => String(n).padStart(2, '0')
const dayOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

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

function checkWhen(name: string, v: string | null | undefined): string | null {
  if (v === undefined || v === null || v === '') return null
  const t = v.trim()
  if (!/^\d{4}-\d{2}-\d{2}(T[\d:.]+(Z|[+-]\d{2}:?\d{2})?)?$/.test(t) || Number.isNaN(momentOf(t)))
    throw new Refused(`${name} takes a day like 2026-10-24, or a moment like 2026-10-24T10:00:00.`)
  return t
}

export class Tasks {
  private db: Db
  private shape: Shape
  private personName: (id: string) => string | null

  constructor(db: Db, shape: Shape, personName: (id: string) => string | null) {
    this.db = db
    this.shape = shape
    this.personName = personName
  }

  // ---- places -----------------------------------------------------------------------------

  // A place named by its words: a module, a table in it, one of its rows, a field, or a page.
  resolvePlace(on: PlaceInput): Place {
    const table = on.table ? this.shape.table(on.table) : undefined
    if (on.table && !table) throw new Refused(`There is no table called ${on.table}.`)
    let module = table?.module
    if (on.module) {
      const m = this.shape.module(on.module)
      if (!m) throw new Refused(`There is no module called ${on.module}.`)
      if (table && table.module.id !== m.id)
        throw new Refused(`${table.name} is in ${table.module.name}, not ${m.name}.`)
      module = m
    }
    let row: string | null = null
    if (on.row) {
      const r = one<{ table_id: string }>(
        this.db,
        'SELECT table_id FROM records WHERE id = ?',
        on.row,
      )
      if (!r) throw new Refused(`There is no row ${on.row}.`)
      if (table && r.table_id !== table.id)
        throw new Refused(`${on.row} is not a row of ${table.name}.`)
      row = on.row
      if (!table) return this.resolvePlace({ ...on, table: r.table_id })
    }
    let field: string | null = null
    if (on.field) {
      if (!table) throw new Refused('A field is named with its table.')
      const f = table.fields.find(
        (x) => x.name.toLowerCase() === on.field?.toLowerCase() || x.id === on.field,
      )
      if (!f) throw new Refused(`${table.name} has no field called ${on.field}.`)
      field = f.id
    }
    if (on.page && !module) throw new Refused('A page is named with its module.')
    return {
      module: module?.id ?? null,
      table: table?.id ?? null,
      row,
      field,
      page: on.page?.trim() || null,
    }
  }

  // A place in words: Deals › Coastal HVAC › Asking price.
  placeWords(p: Place, rowName?: (table: string, row: string) => string): string {
    const parts: string[] = []
    const module = p.module ? this.shape.module(p.module) : undefined
    const table = p.table ? this.shape.table(p.table) : undefined
    if (module) parts.push(module.name)
    if (p.page) parts.push(p.page)
    if (table && table.name !== module?.name) parts.push(table.name)
    if (table && p.row) parts.push(rowName ? rowName(table.id, p.row) : 'a row')
    if (table && p.field) parts.push(table.fields.find((f) => f.id === p.field)?.name ?? 'a field')
    return parts.join(' › ') || 'nowhere yet'
  }

  // ---- reading ----------------------------------------------------------------------------

  private toTask(r: TaskRow): Task {
    return {
      id: r.id,
      title: r.title,
      state: r.state,
      notes: r.notes,
      due: r.due,
      remindAt: r.remind_at,
      remindedAt: r.reminded_at,
      repeat: r.repeat,
      priority: r.priority,
      owner: { kind: r.owner_kind, id: r.owner_id },
      parent: r.parent_id,
      place: {
        module: r.module_id,
        table: r.table_id,
        row: r.record_id,
        field: r.field_id,
        page: r.page,
      },
      placedBy: r.placed_by,
      placedWhy: r.placed_why,
      refs: all<Ref>(
        this.db,
        'SELECT kind, ref FROM task_refs WHERE task_id = ? ORDER BY kind, ref',
        r.id,
      ),
      madeBy: r.made_by,
      run: r.run_id,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      doneAt: r.done_at,
    }
  }

  get(id: string): Task | undefined {
    const r = one<TaskRow>(this.db, 'SELECT * FROM tasks WHERE id = ?', id)
    return r ? this.toTask(r) : undefined
  }

  private must(id: string): Task {
    const t = this.get(id)
    if (!t) throw new Refused(`There is no task ${id}.`)
    return t
  }

  children(id: string): Task[] {
    return all<TaskRow>(
      this.db,
      'SELECT * FROM tasks WHERE parent_id = ? ORDER BY created_at',
      id,
    ).map((r) => this.toTask(r))
  }

  // Tasks by what they are: open or all, on a place and beneath it, an owner, due by a day, words.
  list(
    where: {
      open?: boolean
      state?: TaskState
      on?: Place
      owner?: { kind: string; id?: string | null }
      dueBy?: string
      words?: string
      parent?: string | null
    } = {},
  ): Task[] {
    const conds: string[] = []
    const args: (string | null)[] = []
    const add = (cond: string, ...values: (string | null)[]) => {
      conds.push(cond)
      args.push(...values)
    }
    if (where.open) add(`state IN (${OPEN.map(() => '?').join(', ')})`, ...OPEN)
    if (where.state) add('state = ?', where.state)
    if (where.on)
      for (const [k, col] of [
        ['module', 'module_id'],
        ['table', 'table_id'],
        ['row', 'record_id'],
        ['field', 'field_id'],
        ['page', 'page'],
      ] as const) {
        const v = where.on[k]
        if (v) add(`${col} = ?`, v)
      }
    if (where.owner) {
      add('owner_kind = ?', where.owner.kind)
      if (where.owner.id) add('owner_id = ?', where.owner.id)
    }
    if (where.dueBy) add('due IS NOT NULL AND substr(due, 1, 10) <= ?', where.dueBy)
    if (where.parent === null) add('parent_id IS NULL')
    else if (where.parent !== undefined) add('parent_id = ?', where.parent)
    const rows = all<TaskRow>(
      this.db,
      `SELECT * FROM tasks ${conds.length ? `WHERE ${conds.join(' AND ')}` : ''}
       ORDER BY state IN ('done', 'dropped'), due IS NULL, due, priority = 'high' DESC, created_at`,
      ...args,
    ).map((r) => this.toTask(r))
    const w = where.words?.trim().toLowerCase()
    return w ? rows.filter((t) => `${t.title} ${t.notes ?? ''}`.toLowerCase().includes(w)) : rows
  }

  // Open tasks that may be this one: on the same place, with most of the same words.
  similar(title: string, place: Place): Task[] {
    const words = (s: string) =>
      new Set(
        s
          .toLowerCase()
          .split(/[^\p{L}\p{N}]+/u)
          .filter((x) => x.length > 2),
      )
    const mine = words(title)
    if (!mine.size) return []
    return this.list({ open: true, on: place }).filter((t) => {
      const theirs = words(t.title)
      const shared = [...mine].filter((x) => theirs.has(x)).length
      return shared / Math.max(mine.size, theirs.size) >= 0.6
    })
  }

  // Whether these tasks are the person's own entries (removing them asks, design §7).
  personsOwn(ids: string[]): boolean {
    return ids.some((id) => (this.get(id)?.madeBy ?? '').startsWith('person'))
  }

  // ---- writing ----------------------------------------------------------------------------

  private say(ctx: WriteCtx, words: string, data: Record<string, unknown>, module: string | null) {
    append(this.db, {
      actor: ctx.actor,
      kind: 'task',
      words,
      data,
      user: ctx.user ?? null,
      turn: ctx.turn ?? null,
      run: ctx.run ?? null,
      module,
    })
  }

  private refsOf(refs: Ref[] | undefined): Ref[] {
    const out: Ref[] = []
    for (const r of refs ?? []) {
      if (!['row', 'person', 'file'].includes(r.kind) || !r.ref?.trim())
        throw new Refused(
          'A task touches rows, people or files: { kind: row | person | file, ref }.',
        )
      if (!out.some((x) => x.kind === r.kind && x.ref === r.ref)) out.push(r)
    }
    return out
  }

  // A task as it would be added, refused where it is not right; nothing is kept (an agent's
  // proposal is checked when it is made, not when the person says yes).
  check(input: TaskInput): void {
    if (!input.title?.trim()) throw new Refused('A task needs a title.')
    if (input.owner) this.checkOwner(input.owner)
    if (input.on) this.resolvePlace(input.on)
    checkWhen('due', input.due)
    checkWhen('remind_at', input.remindAt)
    if (input.priority && !PRIORITIES.includes(input.priority))
      throw new Refused('Priority is high, normal or low.')
    if (input.repeat?.trim()) readRepeat(input.repeat)
  }

  add(input: TaskInput, ctx: WriteCtx, by = actorWord(ctx)): Task {
    const title = input.title?.trim()
    if (!title) throw new Refused('A task needs a title.')
    return tx(this.db, () => {
      if (input.owner) this.checkOwner(input.owner)
      const place = input.on ? this.resolvePlace(input.on) : emptyPlace()
      const parent = input.parent ? this.must(input.parent) : null
      // a child sits where its parent sits, unless it is given its own place
      const at = input.on ? place : parent ? parent.place : place
      const repeat = input.repeat?.trim() || null
      const rule = repeat ? readRepeat(repeat) : null
      const due = checkWhen('due', input.due)
      if (rule && !due) throw new Refused('A repeating task needs its first due day.')
      const id = newId('k')
      const t = now()
      run(
        this.db,
        `INSERT INTO tasks (id, title, state, notes, due, remind_at, repeat, repeat_rule, priority,
           owner_kind, owner_id, parent_id, module_id, table_id, record_id, field_id, page,
           placed_by, placed_why, made_by, run_id, created_at, updated_at)
         VALUES (?, ?, 'todo', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        id,
        title,
        input.notes?.trim() || null,
        due,
        checkWhen('remind_at', input.remindAt),
        repeat,
        rule ? json(rule) : null,
        input.priority ?? 'normal',
        input.owner?.kind ?? 'person',
        input.owner?.id ?? (input.owner?.kind === 'alpha' ? null : (ctx.user ?? null)),
        parent?.id ?? null,
        at.module,
        at.table,
        at.row,
        at.field,
        at.page,
        input.placedBy ?? (input.on ? by : null),
        input.placedWhy ?? null,
        by,
        ctx.run ?? null,
        t,
        t,
      )
      for (const r of this.refsOf(input.refs))
        run(
          this.db,
          'INSERT INTO task_refs (task_id, kind, ref) VALUES (?, ?, ?)',
          id,
          r.kind,
          r.ref,
        )
      const where = this.placeWords(at)
      this.say(
        ctx,
        `Added a task: ${title}${where !== 'nowhere yet' ? `, on ${where}` : ''}${due ? `, due ${whenSaid(due)}` : ''}${repeat ? `, ${repeat}` : ''}.`,
        { task: id, title, place: at, due },
        at.module,
      )
      return this.must(id)
    })
  }

  change(
    id: string,
    patch: Partial<Omit<TaskInput, 'title'>> & { title?: string },
    ctx: WriteCtx,
  ): Task {
    return tx(this.db, () => {
      const t = this.must(id)
      const sets: string[] = []
      const args: (string | null)[] = []
      const said: string[] = []
      const set = (col: string, v: string | null, words: string) => {
        sets.push(`${col} = ?`)
        args.push(v)
        said.push(words)
      }
      if (patch.title !== undefined) {
        const title = patch.title.trim()
        if (!title) throw new Refused('A task needs a title.')
        set('title', title, `called “${title}”`)
      }
      if (patch.notes !== undefined) set('notes', patch.notes?.trim() || null, 'its notes changed')
      if (patch.due !== undefined) {
        const due = checkWhen('due', patch.due)
        set('due', due, due ? `due ${whenSaid(due)}` : 'no due day')
      }
      if (patch.remindAt !== undefined) {
        const at = checkWhen('remind_at', patch.remindAt)
        set('remind_at', at, at ? `a reminder at ${whenSaid(at)}` : 'no reminder')
        sets.push('reminded_at = NULL')
      }
      if (patch.repeat !== undefined) {
        const repeat = patch.repeat?.trim() || null
        const rule = repeat ? readRepeat(repeat) : null
        if (rule && !(patch.due ?? t.due)) throw new Refused('A repeating task needs a due day.')
        set('repeat', repeat, repeat ?? 'not repeating')
        sets.push('repeat_rule = ?')
        args.push(rule ? json(rule) : null)
      }
      if (patch.priority !== undefined) {
        if (!PRIORITIES.includes(patch.priority))
          throw new Refused('Priority is high, normal or low.')
        set('priority', patch.priority, `${patch.priority} priority`)
      }
      if (patch.owner !== undefined) {
        const agent = this.checkOwner(patch.owner)
        sets.push('owner_kind = ?', 'owner_id = ?')
        args.push(patch.owner.kind, patch.owner.id ?? null)
        said.push(
          `for ${patch.owner.kind === 'person' ? 'you' : patch.owner.kind === 'alpha' ? 'Alpha' : (agent ?? 'an agent')}`,
        )
      }
      if (patch.parent !== undefined) {
        if (patch.parent) {
          if (patch.parent === id || this.ancestors(patch.parent).includes(id))
            throw new Refused('A task cannot sit under itself.')
          this.must(patch.parent)
        }
        set('parent_id', patch.parent ?? null, patch.parent ? 'under another task' : 'at the top')
      }
      if (patch.on !== undefined) {
        const place = patch.on ? this.resolvePlace(patch.on) : emptyPlace()
        sets.push(
          'module_id = ?',
          'table_id = ?',
          'record_id = ?',
          'field_id = ?',
          'page = ?',
          'placed_by = ?',
          'placed_why = ?',
        )
        args.push(
          place.module,
          place.table,
          place.row,
          place.field,
          place.page,
          patch.placedBy ?? actorWord(ctx),
          patch.placedWhy ?? null,
        )
        said.push(`on ${this.placeWords(place)}`)
      }
      if (patch.refs !== undefined) {
        run(this.db, 'DELETE FROM task_refs WHERE task_id = ?', id)
        for (const r of this.refsOf(patch.refs))
          run(
            this.db,
            'INSERT INTO task_refs (task_id, kind, ref) VALUES (?, ?, ?)',
            id,
            r.kind,
            r.ref,
          )
        said.push('what it touches changed')
      }
      if (!sets.length && patch.refs === undefined) return t
      if (sets.length)
        run(
          this.db,
          `UPDATE tasks SET ${sets.join(', ')}, updated_at = ? WHERE id = ?`,
          ...args,
          now(),
          id,
        )
      this.say(ctx, `${t.title}: ${said.join(', ')}.`, { task: id, patch }, t.place.module)
      return this.must(id)
    })
  }

  // A state set; done or dropped makes a repeating task's next one, once.
  // A new state, journaled; `words` says it when an agent's run settles the task (what it did,
  // or why it waits).
  setState(id: string, state: TaskState, ctx: WriteCtx, words?: string): Task {
    if (!TASK_STATES.includes(state)) throw new Refused(`A task is ${TASK_STATES.join(', ')}.`)
    return tx(this.db, () => {
      const t = this.must(id)
      if (t.state === state && !words) return t
      if (t.state === state) {
        this.say(ctx, words as string, { task: id, state, was: t.state }, t.place.module)
        return t
      }
      const closed = state === 'done' || state === 'dropped'
      run(
        this.db,
        'UPDATE tasks SET state = ?, done_at = ?, updated_at = ? WHERE id = ?',
        state,
        closed ? now() : null,
        now(),
        id,
      )
      this.say(
        ctx,
        words ?? `${t.title}: ${STATE_WORDS[state]}.`,
        { task: id, state, was: t.state },
        t.place.module,
      )
      if (closed) this.repeatNext(id, ctx)
      return this.must(id)
    })
  }

  // Tasks removed with the tasks beneath them; the journal keeps what they were.
  remove(ids: string[], ctx: WriteCtx): number {
    return tx(this.db, () => {
      const gone = new Set<string>()
      const walk = (id: string) => {
        if (gone.has(id)) return
        gone.add(id)
        for (const c of all<{ id: string }>(
          this.db,
          'SELECT id FROM tasks WHERE parent_id = ?',
          id,
        ))
          walk(c.id)
      }
      for (const id of ids) {
        this.must(id)
        walk(id)
      }
      const titles = [...gone].map((id) => this.get(id)?.title ?? id)
      for (const id of gone) {
        run(this.db, 'DELETE FROM task_refs WHERE task_id = ?', id)
        run(this.db, 'UPDATE tasks SET repeat_next = NULL WHERE repeat_next = ?', id)
      }
      for (const id of [...gone].reverse()) run(this.db, 'DELETE FROM tasks WHERE id = ?', id)
      this.say(
        ctx,
        gone.size === 1
          ? `Removed the task ${titles[0]}.`
          : `Removed ${gone.size} tasks: ${titles.join(', ')}.`,
        { tasks: [...gone], titles },
        null,
      )
      return gone.size
    })
  }

  private ancestors(id: string): string[] {
    const out: string[] = []
    let at: string | null = id
    for (let i = 0; at && i < 64; i++) {
      out.push(at)
      at =
        one<{ parent_id: string | null }>(this.db, 'SELECT parent_id FROM tasks WHERE id = ?', at)
          ?.parent_id ?? null
    }
    return out
  }

  private repeatNext(id: string, ctx: WriteCtx): Task | null {
    const r = one<TaskRow>(this.db, 'SELECT * FROM tasks WHERE id = ?', id)
    if (!r?.repeat_rule || !r.due || r.repeat_next) return null
    const rule = parse<Repeat | null>(r.repeat_rule, null)
    if (!rule) return null
    let due = nextDue(rule, r.due)
    // a long-missed repeat starts again from today, not from every day it was missed
    while (momentOf(due) < Date.now() - 86_400_000) due = nextDue(rule, due)
    const t = this.toTask(r)
    const next = this.add(
      {
        title: t.title,
        notes: t.notes,
        due,
        remindAt: t.remindAt && r.due ? shiftLike(t.remindAt, r.due, due) : null,
        repeat: t.repeat,
        priority: t.priority,
        owner: t.owner,
        parent: t.parent,
        on: placeInput(t.place),
        refs: t.refs,
        placedBy: t.placedBy,
        placedWhy: t.placedWhy,
      },
      ctx,
      t.madeBy,
    )
    run(this.db, 'UPDATE tasks SET repeat_next = ? WHERE id = ?', next.id, id)
    return next
  }

  // ---- the scheduler's minute ------------------------------------------------------------

  // Reminders that came due, said once each; repeats whose day passed, made once each.
  tick(nowMs: number, ctx: WriteCtx, notify: (task: Task) => void = () => {}): void {
    for (const r of all<TaskRow>(
      this.db,
      `SELECT * FROM tasks WHERE remind_at IS NOT NULL AND reminded_at IS NULL
         AND state IN ('todo', 'doing', 'waiting')`,
    )) {
      if (momentOf(r.remind_at as string) > nowMs) continue
      run(
        this.db,
        'UPDATE tasks SET reminded_at = ? WHERE id = ?',
        new Date(nowMs).toISOString(),
        r.id,
      )
      const t = this.toTask(r)
      append(this.db, {
        actor: { kind: 'system' },
        kind: 'reminder',
        words: `Reminder: ${t.title}${t.due ? ` (due ${whenSaid(t.due)})` : ''}.`,
        data: { task: t.id },
        user: ctx.user ?? null,
        module: t.place.module,
      })
      notify(t)
    }
    const today = dayOf(new Date(nowMs))
    for (const r of all<TaskRow>(
      this.db,
      `SELECT * FROM tasks WHERE repeat_rule IS NOT NULL AND repeat_next IS NULL AND due IS NOT NULL
         AND substr(due, 1, 10) < ?`,
      today,
    ))
      this.repeatNext(r.id, ctx)
  }

  counts(): { open: number; overdue: number; today: number } {
    const today = dayOf(new Date())
    const c = one<{ open: number; overdue: number; today: number }>(
      this.db,
      `SELECT count(*) AS open, sum(due IS NOT NULL AND substr(due, 1, 10) < ?) AS overdue,
         sum(substr(due, 1, 10) = ?) AS today
       FROM tasks WHERE state IN ('todo', 'doing', 'waiting')`,
      today,
      today,
    )
    return {
      open: Number(c?.open ?? 0),
      overdue: Number(c?.overdue ?? 0),
      today: Number(c?.today ?? 0),
    }
  }

  // An agent owns a task only when it takes tasks (its file says tasks: true); returns its name.
  private checkOwner(owner: { kind: string; id?: string | null }): string | null {
    if (owner.kind !== 'agent') return null
    const a = owner.id
      ? one<{ name: string; tasks: number }>(
          this.db,
          'SELECT name, tasks FROM agents WHERE id = ?',
          owner.id,
        )
      : undefined
    if (!a) throw new Refused('That agent is not there.')
    if (!a.tasks)
      throw new Refused(
        `${a.name} does not take tasks: it runs on its own trigger. An agent takes tasks when its file says tasks: true.`,
      )
    return a.name
  }

  ownerWords(t: Task): string {
    if (t.owner.kind === 'alpha') return 'Alpha'
    if (t.owner.kind === 'agent') {
      const a = t.owner.id
        ? one<{ name: string }>(this.db, 'SELECT name FROM agents WHERE id = ?', t.owner.id)
        : undefined
      return a?.name ?? 'an agent'
    }
    return (t.owner.id ? this.personName(t.owner.id) : null) ?? 'You'
  }
}

function emptyPlace(): Place {
  return { module: null, table: null, row: null, field: null, page: null }
}

function placeInput(p: Place): PlaceInput {
  return {
    ...(p.module ? { module: p.module } : {}),
    ...(p.table ? { table: p.table } : {}),
    ...(p.row ? { row: p.row } : {}),
    ...(p.field ? { field: p.field } : {}),
    ...(p.page ? { page: p.page } : {}),
  }
}

// A reminder kept as far before the next due as it was before this one.
function shiftLike(remind: string, from: string, to: string): string {
  const gap = momentOf(from) - momentOf(remind)
  return new Date(momentOf(to) - gap).toISOString()
}

function actorWord(ctx: WriteCtx): string {
  return ctx.actor.id ? `${ctx.actor.kind}:${ctx.actor.id}` : ctx.actor.kind
}
