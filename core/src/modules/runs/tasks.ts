// Agents on tasks (Kenil's plan, 21 Oct): the task a run serves, what became of it, proposals on a card.
import type { Card } from '../../world/cards.ts'
import { all, one } from '../../world/db.ts'
import { Refused } from '../../world/kinds.ts'
import type { Module } from '../../world/shape/index.ts'
import type { Task, TaskInput } from '../../world/tasks/index.ts'
import { agents } from '../agents.ts'
import type { AgentRunner } from './runner.ts'
import {
  PROPOSE_TASKS,
  type ProposedTask,
  type RunFor,
  type RunOutcome,
  type RunRow,
  type RunRowDb,
  toRun,
} from './types.ts'

// ---- agents on tasks (Kenil's plan, 21 Oct) ----------------------------------------------

// The task a run serves; none on a try of a script with a made-up task.
export function serving(runner: AgentRunner, who: RunFor): Task | null {
  if (!who.task) return null
  const t = runner.world.tasks.get(who.task)
  if (!t) throw new Refused('The task this run serves is not there any more.')
  return t
}

export function asInput(_runner: AgentRunner, p: ProposedTask, agentId: string | null): TaskInput {
  return {
    title: p.title,
    notes: p.notes,
    due: p.due,
    priority: p.priority,
    on: p.on,
    ...(p.owner === 'agent' && agentId ? { owner: { kind: 'agent' as const, id: agentId } } : {}),
  }
}

// What became of a task when the run serving it ended, unless the run said so itself: stopped,
// it is back in To do; with a card waiting, it waits for the person's yes; otherwise it waits,
// saying the run ended without saying it was done.
export function settle(
  runner: AgentRunner,
  task: string,
  state: RunOutcome['state'],
  words: string,
  label: string,
  runId: string,
): void {
  const t = runner.world.tasks.get(task)
  if (!t || t.state === 'done' || t.state === 'dropped') return
  const ctx = { actor: { kind: 'agent' as const, id: label }, run: runId }
  const cards = runner.world.cards.ofTask(task).filter((c) => c.state === 'waiting').length
  if (state === 'stopped')
    runner.world.tasks.setState(task, 'todo', ctx, `${label} was stopped; “${t.title}” is To do.`)
  else if (cards)
    runner.world.tasks.setState(
      task,
      'waiting',
      ctx,
      `“${t.title}” waits for your yes on ${cards === 1 ? 'a card' : `${cards} cards`} from ${label}.`,
    )
  else if (t.state === 'waiting')
    return // the run said what it waits for
  else
    runner.world.tasks.setState(
      task,
      'waiting',
      ctx,
      state === 'failed'
        ? `${words.replace(/\.$/, '')}. “${t.title}” waits.`
        : `${label} ended without saying “${t.title}” was done; it waits.`,
    )
}

// What a run on a task is handed as alpha.input.task: the task, where it sits and that row's
// values by field name, what it touches, and what came of earlier runs on it and their cards.
export function taskInput(runner: AgentRunner, t: Task) {
  const w = runner.world
  const rowName = (table: string, row: string) => {
    const tb = w.shape.table(table)
    const r = w.records.get(row)
    return tb && r ? w.rowName(tb, r.record.values) : 'a row'
  }
  const table = t.place.table ? w.shape.table(t.place.table) : undefined
  const rec = t.place.row ? w.records.get(t.place.row) : undefined
  const names = new Map((table?.fields ?? []).map((f) => [f.slug, f.name]))
  return {
    id: t.id,
    title: t.title,
    notes: t.notes,
    due: t.due,
    priority: t.priority,
    place: {
      words: w.tasks.placeWords(t.place, rowName),
      module: t.place.module ? (w.shape.module(t.place.module)?.name ?? null) : null,
      table: table?.name ?? null,
      row: t.place.row,
      field: table?.fields.find((f) => f.id === t.place.field)?.name ?? null,
      page: t.place.page,
    },
    values: rec
      ? Object.fromEntries(
          Object.entries(rec.record.values).map(([k, v]) => [names.get(k) ?? k, v]),
        )
      : null,
    touches: t.refs,
    before: runner
      .runsOf(t.id)
      .filter((r) => r.state !== 'running')
      .map((r) => ({ at: r.endedAt, state: r.state, words: r.words })),
    cards: runner.world.cards.ofTask(t.id).map((c) => ({
      words: c.words,
      state: c.state,
      answer: c.answer,
      decidedAt: c.decidedAt,
    })),
  }
}

// Start the agent a task is given to on that task. Giving a task never starts it; Start does.
// One run of an agent at a time; the run goes on after this returns.
export function startTask(
  runner: AgentRunner,
  id: string,
  who: RunFor,
): { run: Promise<RunOutcome> } {
  const t = runner.world.tasks.get(id)
  if (!t) throw new Refused('That task is not there.')
  if (t.state === 'done' || t.state === 'dropped')
    throw new Refused(
      `“${t.title}” is ${t.state === 'done' ? 'done' : 'dropped'}; reopen it first.`,
    )
  if (t.owner.kind !== 'agent' || !t.owner.id)
    throw new Refused(`“${t.title}” is not given to an agent; give it to one first.`)
  const a = agents(runner.world).find((x) => x.id === t.owner.id)
  if (!a) throw new Refused('The agent it is given to is not there any more.')
  if (!a.tasks) throw new Refused(`${a.name} does not take tasks.`)
  if (a.state !== 'on') throw new Refused(`${a.name} is paused; turn it on in Settings first.`)
  if (one(runner.world.db, "SELECT 1 FROM runs WHERE agent_id = ? AND state = 'running'", a.id))
    throw new Refused(`${a.name} is busy with another run; start it again when that one ends.`)
  runner.world.tasks.setState(
    id,
    'doing',
    { actor: { kind: 'agent', id: a.name }, user: who.user },
    `${a.name} started on “${t.title}”.`,
  )
  const run = runner.runAgent(a, { ...who, task: id }, { task: runner.taskInput(t) })
  return { run }
}

// A task waiting on cards its agent's run opened goes on once the person has decided them all:
// its agent runs on it again, handed what came of them.
export function resumeTasks(runner: AgentRunner): void {
  for (const t of runner.world.tasks.list({ open: true, owner: { kind: 'agent' } })) {
    if (t.state !== 'waiting') continue
    const last = runner.runsOf(t.id).at(-1)
    if (!last?.endedAt || last.state === 'running') continue
    const cards: Card[] = runner.world.cards.ofTask(t.id)
    if (cards.some((c) => c.state === 'waiting')) continue
    if (!cards.some((c) => c.decidedAt && c.decidedAt > (last.endedAt as string))) continue
    try {
      runner.startTask(t.id, { user: runner.owner, turn: null }).run.catch(() => undefined)
    } catch {
      // paused, busy or gone: it goes on at a later tick, or waits for the person
    }
  }
}

// A proposal card as the window shows it: each task as it would be added, where and for whom.
export function proposedView(
  runner: AgentRunner,
  card: Card,
): {
  agent: string
  tasks: {
    title: string
    notes: string | null
    due: string | null
    priority: 'high' | 'normal' | 'low'
    place: string
    owner: string
    word: 'add' | 'decline' | null
  }[]
} | null {
  if (card.call?.tool !== PROPOSE_TASKS) return null
  const p = card.call.input as { label: string; tasks: ProposedTask[] }
  const w = runner.world
  const rowName = (table: string, row: string) => {
    const tb = w.shape.table(table)
    const r = w.records.get(row)
    return tb && r ? w.rowName(tb, r.record.values) : 'a row'
  }
  const where = (on: ProposedTask['on']) => {
    try {
      return on ? w.tasks.placeWords(w.tasks.resolvePlace(on), rowName) : 'nowhere yet'
    } catch {
      return 'a place no longer there'
    }
  }
  const words = wordsOn(runner, card.id)
  return {
    agent: p.label,
    tasks: p.tasks.map((t, i) => ({
      title: t.title,
      notes: t.notes,
      due: t.due,
      priority: t.priority,
      place: where(t.on),
      owner: t.owner === 'agent' ? p.label : 'You',
      word: words.get(i) ?? null,
    })),
  }
}

// The person's word on each proposed task so far, by its place on the card (Vikas, 30 Oct: one
// task, one row, each with Add and Decline).
const TASK_WORD = 'proposed_task'
function wordsOn(runner: AgentRunner, cardId: string): Map<number, 'add' | 'decline'> {
  return new Map(
    all<{ data: string }>(
      runner.world.db,
      'SELECT data FROM journal WHERE card_id = ? AND kind = ? ORDER BY id',
      cardId,
      TASK_WORD,
    ).map((r) => {
      const d = JSON.parse(r.data) as { index: number; word: 'add' | 'decline' }
      return [d.index, d.word] as const
    }),
  )
}

// The person's word on an agent's proposed tasks: those taken are added, made by the agent on
// their word, those declined are let go. With `decline` given, the words are on some rows and the
// card closes once every task has one, as rows put to the person do (design §12); without it,
// every task not taken is declined, so the card closes at once.
export function adopt(
  runner: AgentRunner,
  cardId: string,
  take: number[] | 'all',
  user: string,
  decline?: number[],
): Card {
  const card = runner.world.cards.get(cardId)
  if (card?.call?.tool !== PROPOSE_TASKS) throw new Refused('That card proposes no tasks.')
  if (card.state !== 'waiting') throw new Refused('That card has already been answered.')
  const p = card.call.input as { agent: string | null; label: string; tasks: ProposedTask[] }
  const words = wordsOn(runner, cardId)
  const fresh = (i: number) => !!p.tasks[i] && !words.has(i)
  const taken = (take === 'all' ? p.tasks.map((_, i) => i) : take).filter(fresh)
  const dropped = (decline ?? p.tasks.map((_, i) => i).filter((i) => !taken.includes(i))).filter(
    (i) => fresh(i) && !taken.includes(i),
  )
  const ctx = { actor: { kind: 'agent' as const, id: p.label }, user, run: card.run }
  const say = (i: number, word: 'add' | 'decline') => {
    const t = p.tasks[i] as ProposedTask
    runner.world.line({
      actor: { kind: 'person', id: user },
      kind: TASK_WORD,
      words: `${word === 'add' ? 'Added' : 'Declined'} “${t.title}” from ${p.label}`,
      data: { card: cardId, index: i, word },
      user,
      module: card.module,
      card: cardId,
    })
    words.set(i, word)
  }
  for (const i of taken) {
    runner.world.tasks.add(runner.asInput(p.tasks[i] as ProposedTask, p.agent), ctx)
    say(i, 'add')
  }
  for (const i of dropped) say(i, 'decline')
  const n = p.tasks.length
  if (words.size < n) return runner.world.cards.get(cardId) as Card
  const added = [...words.values()].filter((w) => w === 'add').length
  return runner.world.cards.answer(
    cardId,
    added ? 'Add them' : 'Not now',
    { kind: 'person', id: user },
    added && added < n ? `Added ${added} of ${n}` : undefined,
  )
}

export function runsOf(runner: AgentRunner, task: string): RunRow[] {
  return all<RunRowDb>(
    runner.world.db,
    'SELECT * FROM runs WHERE task_id = ? ORDER BY started_at',
    task,
  ).map(toRun)
}

// task.propose: tasks an agent thinks need doing, on one card for the person's yes; none is kept
// before.
export function proposeTasks(
  runner: AgentRunner,
  module: Module,
  label: string,
  runId: string,
  who: RunFor,
  agentId: string | null,
  p: Record<string, unknown>,
): { card: string } {
  const actor = { kind: 'agent' as const, id: label }
  const items = Array.isArray(p.tasks) ? (p.tasks as Record<string, unknown>[]) : []
  if (!items.length)
    throw new Refused(
      'task.propose needs tasks: [{ title, notes, due, priority, on: { table, row, field }, owner }].',
    )
  const tasks: ProposedTask[] = items.map((i) => {
    const on = (i.on ?? null) as ProposedTask['on']
    const owner = i.owner === 'agent' ? 'agent' : 'person'
    const priority = (['high', 'low'].includes(String(i.priority)) ? i.priority : 'normal') as
      | 'high'
      | 'normal'
      | 'low'
    const out: ProposedTask = {
      title: String(i.title ?? '').trim(),
      notes: i.notes ? String(i.notes) : null,
      due: i.due ? String(i.due) : null,
      priority,
      on: on ? { module: module.id, ...on } : null,
      owner,
    }
    runner.world.tasks.check(runner.asInput(out, agentId))
    return out
  })
  const n = tasks.length
  // a newer proposal from the same agent stands for its earlier ones still waiting (Vikas,
  // 30 Oct: five "Morning suggests" piled up, each a day older than the next)
  for (const old of runner.world.cards.waiting(who.user ?? runner.owner ?? undefined))
    if (
      old.call?.tool === PROPOSE_TASKS &&
      (old.call.input as { agent?: string }).agent === agentId
    )
      runner.world.cards.withdraw(old.id, actor, `${label} proposed again.`)
  const card = runner.world.cards.open({
    kind: 'suggestion',
    words: String(p.words ?? '').trim() || `${label} proposes ${n === 1 ? 'a task' : `${n} tasks`}`,
    restsOn: [`a run of ${label}`],
    options: ['Add them', 'Not now'],
    call: { tool: PROPOSE_TASKS, input: { agent: agentId, label, tasks } },
    actor,
    user: who.user ?? runner.owner,
    module: module.id,
    run: runId,
  })
  runner.notify()
  return { card: card.id }
}
