// Agents on tasks (Kenil's plan, 21 Oct): the task a run serves, what became of it, proposals on a card.
import type { Card } from '../../world/cards.ts'
import { all, one } from '../../world/db.ts'
import { Refused } from '../../world/kinds.ts'
import type { Task, TaskInput } from '../../world/tasks.ts'
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
  return {
    agent: p.label,
    tasks: p.tasks.map((t) => ({
      title: t.title,
      notes: t.notes,
      due: t.due,
      priority: t.priority,
      place: where(t.on),
      owner: t.owner === 'agent' ? p.label : 'You',
    })),
  }
}

// The person's yes on an agent's proposed tasks: those they kept are added, made by the agent
// on their word; the card closes with how many.
export function adopt(
  runner: AgentRunner,
  cardId: string,
  take: number[] | 'all',
  user: string,
): Card {
  const card = runner.world.cards.get(cardId)
  if (card?.call?.tool !== PROPOSE_TASKS) throw new Refused('That card proposes no tasks.')
  if (card.state !== 'waiting') throw new Refused('That card has already been answered.')
  const p = card.call.input as { agent: string | null; label: string; tasks: ProposedTask[] }
  const picked = take === 'all' ? p.tasks.map((_, i) => i) : take.filter((i) => p.tasks[i])
  const ctx = { actor: { kind: 'agent' as const, id: p.label }, user, run: card.run }
  for (const i of picked)
    runner.world.tasks.add(runner.asInput(p.tasks[i] as ProposedTask, p.agent), ctx)
  const n = p.tasks.length
  return runner.world.cards.answer(
    cardId,
    picked.length ? 'Add them' : 'Not now',
    { kind: 'person', id: user },
    picked.length && picked.length < n ? `Added ${picked.length} of ${n}` : undefined,
  )
}

export function runsOf(runner: AgentRunner, task: string): RunRow[] {
  return all<RunRowDb>(
    runner.world.db,
    'SELECT * FROM runs WHERE task_id = ? ORDER BY started_at',
    task,
  ).map(toRun)
}
