// The task store (design §4): places resolved from words, tasks read by what they are (open or
// all, on a place, an owner, a day), what may be the same task, and the counts. Changes are in
// changes.ts as functions of the store.
import { all, type Db, one, run } from '../db.ts'
import { append } from '../journal.ts'
import { Refused } from '../kinds.ts'
import type { Shape, WriteCtx } from '../shape/index.ts'
import { add, change, remove, setState, tick } from './changes.ts'
import type { Place, PlaceInput, Ref, Task, TaskInput, TaskRow, TaskState } from './types.ts'
import { actorWord, dayOf, OPEN } from './types.ts'

export class Tasks {
  db: Db
  shape: Shape
  personName: (id: string) => string | null

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

  toTask(r: TaskRow): Task {
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
      given: r.given_by ? { by: r.given_by, root: r.given_root, hop: r.given_hop } : null,
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

  must(id: string): Task {
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

  say(ctx: WriteCtx, words: string, data: Record<string, unknown>, module: string | null) {
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

  refsOf(refs: Ref[] | undefined): Ref[] {
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

  // ---- the scheduler's minute ------------------------------------------------------------

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

  // An agent was set on it: by whom, and where in a chain of requests.
  markGiven(id: string, given: NonNullable<Task['given']>): void {
    run(
      this.db,
      'UPDATE tasks SET given_by = ?, given_root = ?, given_hop = ? WHERE id = ?',
      given.by,
      given.root,
      given.hop,
      id,
    )
  }

  // How many tasks one request has given out.
  givenIn(root: string): number {
    return (
      one<{ n: number }>(this.db, 'SELECT count(*) AS n FROM tasks WHERE given_root = ?', root)
        ?.n ?? 0
    )
  }

  ownerWords(t: Task): string {
    if (t.owner.id === 'chief') return 'Chief of staff'
    if (t.owner.kind === 'alpha' && t.owner.id)
      return (
        one<{ name: string }>(this.db, 'SELECT name FROM agents WHERE id = ?', t.owner.id)?.name ??
        'An agent'
      )
    if (t.owner.kind === 'alpha') return 'Alpha'
    return (t.owner.id ? this.personName(t.owner.id) : null) ?? 'You'
  }

  add(input: TaskInput, ctx: WriteCtx, by = actorWord(ctx)): Task {
    return add(this, input, ctx, by)
  }
  change(
    id: string,
    patch: Partial<Omit<TaskInput, 'title'>> & { title?: string },
    ctx: WriteCtx,
  ): Task {
    return change(this, id, patch, ctx)
  }
  setState(id: string, state: TaskState, ctx: WriteCtx, words?: string): Task {
    return setState(this, id, state, ctx, words)
  }
  remove(ids: string[], ctx: WriteCtx): number {
    return remove(this, ids, ctx)
  }
  tick(nowMs: number, ctx: WriteCtx, notify: (task: Task) => void = () => {}): void {
    tick(this, nowMs, ctx, notify)
  }
}
