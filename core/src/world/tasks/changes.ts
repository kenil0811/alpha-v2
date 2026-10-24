// Changing tasks: added, changed, moved between states, removed with the tasks beneath them, the
// next occurrence of a repeat, and the tick that says reminders once and makes repeats whose day
// passed. Every change is journaled.
import { all, json, newId, now, one, parse, run, tx } from '../db.ts'
import { append } from '../journal.ts'
import { Refused } from '../kinds.ts'
import type { WriteCtx } from '../shape.ts'
import type { Tasks } from './tasks.ts'
import type { Repeat, Task, TaskInput, TaskRow, TaskState } from './types.ts'
import {
  actorWord,
  checkWhen,
  dayOf,
  emptyPlace,
  momentOf,
  nextDue,
  PRIORITIES,
  placeInput,
  readRepeat,
  STATE_WORDS,
  shiftLike,
  TASK_STATES,
  whenSaid,
} from './types.ts'

export function add(tasks: Tasks, input: TaskInput, ctx: WriteCtx, by = actorWord(ctx)): Task {
  const title = input.title?.trim()
  if (!title) throw new Refused('A task needs a title.')
  return tx(tasks.db, () => {
    if (input.owner) tasks.checkOwner(input.owner)
    const place = input.on ? tasks.resolvePlace(input.on) : emptyPlace()
    const parent = input.parent ? tasks.must(input.parent) : null
    // a child sits where its parent sits, unless it is given its own place
    const at = input.on ? place : parent ? parent.place : place
    const repeat = input.repeat?.trim() || null
    const rule = repeat ? readRepeat(repeat) : null
    const due = checkWhen('due', input.due)
    if (rule && !due) throw new Refused('A repeating task needs its first due day.')
    const id = newId('k')
    const t = now()
    run(
      tasks.db,
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
    for (const r of tasks.refsOf(input.refs))
      run(
        tasks.db,
        'INSERT INTO task_refs (task_id, kind, ref) VALUES (?, ?, ?)',
        id,
        r.kind,
        r.ref,
      )
    const where = tasks.placeWords(at)
    tasks.say(
      ctx,
      `Added a task: ${title}${where !== 'nowhere yet' ? `, on ${where}` : ''}${due ? `, due ${whenSaid(due)}` : ''}${repeat ? `, ${repeat}` : ''}.`,
      { task: id, title, place: at, due },
      at.module,
    )
    return tasks.must(id)
  })
}

export function change(
  tasks: Tasks,
  id: string,
  patch: Partial<Omit<TaskInput, 'title'>> & { title?: string },
  ctx: WriteCtx,
): Task {
  return tx(tasks.db, () => {
    const t = tasks.must(id)
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
      const agent = tasks.checkOwner(patch.owner)
      sets.push('owner_kind = ?', 'owner_id = ?')
      args.push(patch.owner.kind, patch.owner.id ?? null)
      said.push(
        `for ${patch.owner.kind === 'person' ? 'you' : patch.owner.kind === 'alpha' ? 'Alpha' : (agent ?? 'an agent')}`,
      )
    }
    if (patch.parent !== undefined) {
      if (patch.parent) {
        if (patch.parent === id || ancestors(tasks, patch.parent).includes(id))
          throw new Refused('A task cannot sit under itself.')
        tasks.must(patch.parent)
      }
      set('parent_id', patch.parent ?? null, patch.parent ? 'under another task' : 'at the top')
    }
    if (patch.on !== undefined) {
      const place = patch.on ? tasks.resolvePlace(patch.on) : emptyPlace()
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
      said.push(`on ${tasks.placeWords(place)}`)
    }
    if (patch.refs !== undefined) {
      run(tasks.db, 'DELETE FROM task_refs WHERE task_id = ?', id)
      for (const r of tasks.refsOf(patch.refs))
        run(
          tasks.db,
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
        tasks.db,
        `UPDATE tasks SET ${sets.join(', ')}, updated_at = ? WHERE id = ?`,
        ...args,
        now(),
        id,
      )
    tasks.say(ctx, `${t.title}: ${said.join(', ')}.`, { task: id, patch }, t.place.module)
    return tasks.must(id)
  })
}

// A state set; done or dropped makes a repeating task's next one, once.
// A new state, journaled; `words` says it when an agent's run settles the task (what it did,
// or why it waits).
export function setState(
  tasks: Tasks,
  id: string,
  state: TaskState,
  ctx: WriteCtx,
  words?: string,
): Task {
  if (!TASK_STATES.includes(state)) throw new Refused(`A task is ${TASK_STATES.join(', ')}.`)
  return tx(tasks.db, () => {
    const t = tasks.must(id)
    if (t.state === state && !words) return t
    if (t.state === state) {
      tasks.say(ctx, words as string, { task: id, state, was: t.state }, t.place.module)
      return t
    }
    const closed = state === 'done' || state === 'dropped'
    run(
      tasks.db,
      'UPDATE tasks SET state = ?, done_at = ?, updated_at = ? WHERE id = ?',
      state,
      closed ? now() : null,
      now(),
      id,
    )
    tasks.say(
      ctx,
      words ?? `${t.title}: ${STATE_WORDS[state]}.`,
      { task: id, state, was: t.state },
      t.place.module,
    )
    if (closed) repeatNext(tasks, id, ctx)
    return tasks.must(id)
  })
}

// Tasks removed with the tasks beneath them; the journal keeps what they were.
export function remove(tasks: Tasks, ids: string[], ctx: WriteCtx): number {
  return tx(tasks.db, () => {
    const gone = new Set<string>()
    const walk = (id: string) => {
      if (gone.has(id)) return
      gone.add(id)
      for (const c of all<{ id: string }>(tasks.db, 'SELECT id FROM tasks WHERE parent_id = ?', id))
        walk(c.id)
    }
    for (const id of ids) {
      tasks.must(id)
      walk(id)
    }
    const titles = [...gone].map((id) => tasks.get(id)?.title ?? id)
    for (const id of gone) {
      run(tasks.db, 'DELETE FROM task_refs WHERE task_id = ?', id)
      run(tasks.db, 'UPDATE tasks SET repeat_next = NULL WHERE repeat_next = ?', id)
    }
    for (const id of [...gone].reverse()) run(tasks.db, 'DELETE FROM tasks WHERE id = ?', id)
    tasks.say(
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

export function ancestors(tasks: Tasks, id: string): string[] {
  const out: string[] = []
  let at: string | null = id
  for (let i = 0; at && i < 64; i++) {
    out.push(at)
    at =
      one<{ parent_id: string | null }>(tasks.db, 'SELECT parent_id FROM tasks WHERE id = ?', at)
        ?.parent_id ?? null
  }
  return out
}

export function repeatNext(tasks: Tasks, id: string, ctx: WriteCtx): Task | null {
  const r = one<TaskRow>(tasks.db, 'SELECT * FROM tasks WHERE id = ?', id)
  if (!r?.repeat_rule || !r.due || r.repeat_next) return null
  const rule = parse<Repeat | null>(r.repeat_rule, null)
  if (!rule) return null
  let due = nextDue(rule, r.due)
  // a long-missed repeat starts again from today, not from every day it was missed
  while (momentOf(due) < Date.now() - 86_400_000) due = nextDue(rule, due)
  const t = tasks.toTask(r)
  const next = add(
    tasks,
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
  run(tasks.db, 'UPDATE tasks SET repeat_next = ? WHERE id = ?', next.id, id)
  return next
}

// Reminders that came due, said once each; repeats whose day passed, made once each.
export function tick(
  tasks: Tasks,
  nowMs: number,
  ctx: WriteCtx,
  notify: (task: Task) => void = () => {},
): void {
  for (const r of all<TaskRow>(
    tasks.db,
    `SELECT * FROM tasks WHERE remind_at IS NOT NULL AND reminded_at IS NULL
       AND state IN ('todo', 'doing', 'waiting')`,
  )) {
    if (momentOf(r.remind_at as string) > nowMs) continue
    run(
      tasks.db,
      'UPDATE tasks SET reminded_at = ? WHERE id = ?',
      new Date(nowMs).toISOString(),
      r.id,
    )
    const t = tasks.toTask(r)
    append(tasks.db, {
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
    tasks.db,
    `SELECT * FROM tasks WHERE repeat_rule IS NOT NULL AND repeat_next IS NULL AND due IS NOT NULL
       AND substr(due, 1, 10) < ?`,
    today,
  ))
    repeatNext(tasks, r.id, ctx)
}
