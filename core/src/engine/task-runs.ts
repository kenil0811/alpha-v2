// A task given to an agent (clean base, after step 7): each task is its own thread with that agent,
// so the work never waits behind the agent's chat. Up to a few run per agent; the rest wait in To do.
// A task is Done when its thread ends well, and Waiting when it needs the person or could not finish.
import { config } from '../config.ts'
import { momentOf, type Task, taskOfTurn } from '../world/tasks/index.ts'
import type { User, World } from '../world/world.ts'
import { taskText } from './ask-words.ts'
import type { Desk } from './desk.ts'

export const agentOf = (t: Task): string | null =>
  t.owner.kind === 'alpha' && t.owner.id ? t.owner.id : null

export type Outcome = 'ok' | 'stopped' | 'failed'

// When an agent given this task begins: its start time, or for a repeat its day. None is at once.
export function startOf(t: Task): number | null {
  if (t.startsAt) return momentOf(t.startsAt)
  if (!t.repeat || !t.due) return null
  return t.due.includes('T')
    ? momentOf(t.due)
    : Date.parse(`${t.due}T${config.limits().repeat_starts_at}:00`)
}

export class TaskRuns {
  private world: World
  private lane: (user: User, agent: string, task: string) => Desk
  private close: (user: User, agent: string, task: string) => void
  private silent = new Set<string>() // scheduled runs that found nothing to report

  constructor(
    world: World,
    lane: (user: User, agent: string, task: string) => Desk,
    close: (user: User, agent: string, task: string) => void,
  ) {
    this.world = world
    this.lane = lane
    this.close = close
  }

  private as(agent: string, user: string) {
    return {
      actor: agent === 'chief' ? { kind: 'alpha' as const } : { kind: 'alpha' as const, id: agent },
      user,
    }
  }

  // The person or an agent gave it: it starts now if there is room, or when a slot comes free.
  give(user: User, id: string, from?: { root: string | null; hop: number }): void {
    const t = this.world.tasks.get(id)
    const agent = t && agentOf(t)
    if (!t || !agent || t.state === 'done' || t.state === 'dropped') return
    this.world.tasks.markGiven(id, { by: user.id, root: from?.root ?? null, hop: from?.hop ?? 0 })
    this.next(agent)
  }

  private next(agent: string): void {
    const open = this.world.tasks.list({ open: true, owner: { kind: 'alpha', id: agent } })
    let free = config.limits().tasks_at_once - open.filter((t) => t.state === 'doing').length
    const ready = (x: Task) => x.state === 'todo' && x.given && (startOf(x) ?? 0) <= Date.now()
    for (const t of open.filter(ready).reverse()) {
      if (free-- <= 0) return
      this.start(t, agent)
    }
  }

  private start(t: Task, agent: string): void {
    const user = t.given && this.world.user(t.given.by)
    if (!user) return
    this.world.tasks.setState(t.id, 'doing', this.as(agent, user.id))
    const place = this.world.tasks.placeWords(t.place, (_table, row) => row)
    this.lane(user, agent, t.id).takeWork(
      t.schedule ? 'Came due.' : 'Started on this.',
      t.opening ?? taskText(t, place === 'nowhere yet' ? null : place, user.name),
    )
  }

  // Called each minute: the tasks whose time has come.
  due(): void {
    const agents = new Set<string>()
    for (const t of this.world.tasks.list({ state: 'todo' })) {
      const agent = agentOf(t)
      if (agent && t.given && startOf(t) !== null) agents.add(agent)
    }
    for (const a of agents) this.next(a)
  }

  // A scheduled run found nothing worth telling: it closes without a notice when its turn ends.
  quiet(id: string): void {
    this.silent.add(id)
  }

  // The person wrote on the task's page: its thread carries on, reopening it if it was finished.
  say(user: User, id: string, words: string): string {
    const t = this.world.tasks.get(id)
    const agent = t && agentOf(t)
    if (!t || !agent) throw new Error('That task is not with an agent.')
    if (t.state !== 'doing') this.world.tasks.setState(id, 'doing', this.as(agent, user.id))
    return this.lane(user, agent, id).say(words)
  }

  again(user: User, id: string): void {
    const t = this.world.tasks.get(id)
    const agent = t && agentOf(t)
    if (!t || !agent) return
    this.world.tasks.setState(id, 'doing', this.as(agent, user.id))
    this.lane(user, agent, id).takeWork(
      'Running it again.',
      'The person asked you to carry on with this task from where it stopped.',
    )
  }

  async stop(user: User, id: string): Promise<void> {
    const t = this.world.tasks.get(id)
    const agent = t && agentOf(t)
    if (agent) await this.lane(user, agent, id).stop()
  }

  // A thread's turn ended: Done, or Waiting when it needs the person or could not finish.
  idle(
    user: User,
    agent: string,
    id: string,
    outcome: Outcome | undefined,
    working: boolean,
  ): void {
    const t = this.world.tasks.get(id)
    if (!t || !outcome || working || t.state !== 'doing') return
    const waiting = this.world.cards.waiting(user.id).some((c) => taskOfTurn(c.turn) === id)
    const asking = this.world.asks
      .waitingFor(user.id, agent === 'chief' ? 'chief' : agent)
      .some((a) => taskOfTurn(a.fromTurn) === id)
    if (asking) return
    const ended = outcome === 'ok' && !waiting
    const quiet = this.silent.delete(id) && ended
    this.world.tasks.setState(
      id,
      quiet ? 'dropped' : ended ? 'done' : 'waiting',
      this.as(agent, user.id),
    )
    if (ended && !quiet)
      this.world.line({
        ...this.as(agent, user.id),
        kind: 'task_finished',
        words: t.title,
        data: { task: id },
      })
    this.close(user, agent, id)
    this.next(agent)
  }

  // A restart leaves what was running unknown: it waits for the person, and is not replayed.
  resume(): void {
    const agents = new Set<string>()
    for (const t of this.world.tasks.list({ open: true })) {
      const agent = agentOf(t)
      if (!agent || !t.given) continue
      agents.add(agent)
      if (t.state !== 'doing') continue
      // a scheduled run has told nobody anything yet, so it simply starts again
      if (t.schedule) {
        this.world.tasks.setState(t.id, 'todo', this.as(agent, t.given.by))
        continue
      }
      this.world.tasks.setState(t.id, 'waiting', this.as(agent, t.given.by))
      this.world.line({
        ...this.as(agent, t.given.by),
        kind: 'error',
        words: 'Alpha restarted while this was running, so it stopped. Run it again to carry on.',
        turn: `task:${t.id}:${this.world.lastLineId()}`,
      })
    }
    for (const a of agents) this.next(a)
  }
}
