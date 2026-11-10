// The engine as the api and the journeys runner see it: one desk per user over one world.
import { EventEmitter } from 'node:events'
import { config } from '../config.ts'
import { takeIn } from '../files/documents.ts'
import { FILING, type Filing } from '../files/intake.ts'
import type { AgentAsk } from '../world/agents/asks.ts'
import { CHIEF, CHIEF_CARD } from '../world/agents/index.ts'
import type { Card } from '../world/cards.ts'
import { Refused } from '../world/kinds.ts'
import { type RuleSpec, SAVE_ANSWERS, SAVE_RULE } from '../world/rules.ts'
import { taskOfTurn } from '../world/tasks/index.ts'
import type { User, World } from '../world/world.ts'
import { recentFor } from './context.ts'
import { Desk, type DeskEvent, type DeskOptions } from './desk.ts'
import { TaskRuns } from './task-runs.ts'
import { ASK_MORE } from './tools/agents.ts'

export type EngineEvent = DeskEvent & { user: string; agent?: string; task?: string }

export class Engine {
  readonly world: World
  readonly events = new EventEmitter()
  private desks = new Map<string, Desk>()
  private options: Omit<DeskOptions, 'emit'>

  readonly tasks: TaskRuns

  constructor(world: World, options: Omit<DeskOptions, 'emit'> = {}) {
    this.world = world
    this.options = options
    this.tasks = new TaskRuns(
      world,
      (user, agent, task) => this.desk(user, agent, task),
      (user, agent, task) => this.closeLane(user, agent, task),
    )
    if (options.hands?.runner)
      options.hands.runner.give = (by, task) => {
        const user = world.user(by)
        if (user) this.tasks.give(user, task)
      }
  }

  private nameOf = (id: string): string =>
    id === CHIEF ? CHIEF_CARD.name : (this.world.agents.get(id)?.name ?? 'An agent')

  // How one desk reaches another.
  private bus = {
    deliver: (user: User, ask: AgentAsk): void => {
      this.desk(user, ask.to).takeAsk(ask, this.nameOf(ask.from))
    },
    giveTask: (user: User, id: string, from: { root: string | null; hop: number }): void => {
      this.tasks.give(user, id, from)
    },
    quietTask: (id: string): void => this.tasks.quiet(id),
    stop: (user: User, ask: AgentAsk): void => {
      this.desk(user, ask.to).stopAsk(ask.id)
      this.world.asks.settle(ask.id, 'stopped', null)
      this.bus.settled(user, this.world.asks.get(ask.id) as AgentAsk, null)
    },
    interim: (user: User, ask: AgentAsk, words: string): void => {
      this.answerLine(user, ask, words, {
        status: 'done',
        evidence: null,
        unblock: null,
        spent: null,
      })
    },
    // An answer shows in the asker's conversation under the teammate's name; once every answer
    // that turn asked for has been reported, the asker reads them all in one turn.
    settled: (user: User, ask: AgentAsk, spent: number | null): void => {
      if (!this.world.asks.report(ask.id)) return
      const a = ask.answer
      this.answerLine(user, ask, a?.result ?? `${this.nameOf(ask.to)} did not answer.`, {
        status: a?.status ?? ask.state,
        evidence: a?.evidence ?? null,
        unblock: a?.unblock ?? null,
        spent,
      })
      const all = this.world.asks.ofTurn(ask.fromTurn)
      if (!all.every((x) => x.reported) || ask.brief.direct) return
      this.desk(user, ask.from, taskOfTurn(ask.fromTurn) ?? undefined).takeAnswers(all, this.nameOf)
    },
  }

  // After a restart: work that had not started goes on; work left half done is not replayed, and
  // the asker is told that its outcome is unknown.
  resumeAsks(): void {
    for (const ask of this.world.asks.unreported()) {
      const user = this.world.user(ask.user)
      if (user) this.bus.settled(user, ask, null)
    }
    for (const ask of this.world.asks.inState('running')) {
      this.world.asks.settle(ask.id, 'unknown', null)
      const user = this.world.user(ask.user)
      if (user) this.bus.settled(user, this.world.asks.get(ask.id) as AgentAsk, null)
    }
    for (const ask of this.world.asks.inState('queued')) {
      const user = this.world.user(ask.user)
      if (user) this.bus.deliver(user, ask)
    }
  }

  // Stop stops the whole chain the running turn belongs to.
  private stopChain(user: User, root: string): void {
    for (const ask of this.world.asks.openOfRoot(root)) {
      this.world.asks.settle(ask.id, 'stopped', null)
      this.world.asks.report(ask.id)
      this.desk(user, ask.to).stopAsk(ask.id)
    }
  }

  // One desk per person and agent.
  desk(user: User, agent = CHIEF, lane?: string): Desk {
    const id = `${user.id}:${agent}${lane ? `:${lane}` : ''}`
    let d = this.desks.get(id)
    if (!d) {
      let reported: string | null = null // the step last shown to whoever asked this agent
      // a plain copy: the api's user reads the request it is in, and a desk outlives requests
      d = new Desk(
        this.world,
        { id: user.id, name: user.name, role: user.role },
        {
          ...this.options,
          agent,
          ...(lane ? { lane } : {}),
          bus: this.bus,
          granted: this.folders(),
          emit: (e) => {
            this.events.emit('event', {
              ...e,
              user: user.id,
              agent,
              ...(lane ? { task: lane } : {}),
            } satisfies EngineEvent)
            if (lane && e.type === 'idle')
              this.tasks.idle(user, agent, lane, e.outcome, this.desks.get(id)?.working ?? false)
            // what a teammate is doing shows on the line that asked it
            if (e.type === 'live' && e.doing !== reported && this.desks.get(id)?.serving?.ask) {
              reported = e.doing
              this.events.emit('event', {
                type: 'lines',
                user: user.id,
                agent,
              } satisfies EngineEvent)
            }
          },
        },
      )
      this.desks.set(id, d)
    }
    return d
  }

  // An agent was deleted: its sessions end with it.
  // A new model takes effect on the agent's next turn, in the same conversation.
  useModel(agent: string, model: string): void {
    for (const [id, d] of this.desks)
      if (id.split(':')[1] === agent) void d.session?.setModel?.(model)
  }

  closeAgent(agent: string): void {
    for (const [id, d] of this.desks)
      if (id.split(':')[1] === agent) {
        d.close()
        this.desks.delete(id)
      }
  }

  get connectors() {
    return this.options.connectors ?? null
  }

  get hands() {
    return this.options.hands ?? null
  }

  get providers() {
    return this.options.providers ?? []
  }

  get route() {
    return this.options.route ?? null
  }

  // A new route reaches the next session: the open ones close and start again on it.
  rerouted(): void {
    for (const d of this.desks.values()) d.close()
    this.desks.clear()
  }

  // The folders the person granted are the connections to a place on this Mac (a watched
  // folder: a connector of the path kind): read, never written.
  folders(): string[] {
    const service = this.options.connectors
    return [
      ...(this.options.granted ?? []),
      ...this.world.connections
        .list()
        .filter((c) => service?.find(c.connector)?.manifest.auth === 'path')
        .map((c) => c.account),
    ]
  }

  // Connecting is the person's own act in Alpha's form: the sign-in gate is answered by doing it.
  async connect(user: User, connector: string, account: string, secret: string | null) {
    const service = this.options.connectors
    if (!service) throw new Refused('Connections are not set up in this core.')
    try {
      return await service.connect(connector, account, secret, user.id)
    } finally {
      this.changed(user)
    }
  }

  async disconnect(user: User, id: string): Promise<void> {
    const service = this.options.connectors
    if (!service) throw new Refused('Connections are not set up in this core.')
    await service.disconnect(id, user.id)
    this.changed(user)
  }

  async sync(user: User, id: string): Promise<void> {
    await this.options.connectors?.sync(id)
    this.events.emit('event', { type: 'lines', user: user.id } satisfies EngineEvent)
  }

  private changed(user: User): void {
    for (const d of this.desks.values()) d.setGranted(this.folders())
    this.events.emit('event', { type: 'lines', user: user.id } satisfies EngineEvent)
  }

  say(
    user: User,
    words: string,
    from: { id: string; name: string } | null = null,
    agent = CHIEF,
    named: string[] = [],
  ): string {
    // one teammate named: straight to it, and its answer is the reply here
    const [one, ...more] = named
    if (one && !more.length && one !== agent) return this.sayDirect(user, words, from, agent, one)
    return this.desk(user, agent).say(words, from, named)
  }

  private answerLine(
    user: User,
    ask: AgentAsk,
    words: string,
    more: Record<string, unknown>,
  ): void {
    this.world.line({
      actor: ask.to === CHIEF ? { kind: 'alpha' } : { kind: 'alpha', id: ask.to },
      kind: 'answered',
      words,
      data: {
        ask: ask.id,
        from: ask.to,
        name: this.nameOf(ask.to),
        ...(ask.brief.direct ? { direct: true, asked: ask.brief.objective } : {}),
        ...more,
      },
      user: user.id,
      agent: ask.from === CHIEF ? null : ask.from,
      ...(taskOfTurn(ask.fromTurn) ? { turn: ask.fromTurn } : {}),
    })
    this.events.emit('event', {
      type: 'lines',
      user: user.id,
      agent: ask.from,
    } satisfies EngineEvent)
  }

  // A message that names one teammate needs no turn of the agent it was written beside. The
  // teammate gets the person's own words and what came before them, and answers them itself.
  private sayDirect(
    user: User,
    words: string,
    from: { id: string; name: string } | null,
    agent: string,
    to: string,
  ): string {
    this.desk(user, agent) // made now, so it hears of this answer on its next turn
    const name = this.nameOf(to)
    const before = recentFor(this.world, user.id, agent, to)
    const line = this.world.line({
      actor: { kind: 'person', id: user.id },
      kind: 'said',
      words,
      user: user.id,
      module: from?.id ?? null,
      agent: agent === CHIEF ? null : agent,
    })
    const turn = String(line.id)
    const objective = words.startsWith(`@${name}`) ? words.slice(name.length + 1).trim() : words
    const ask = this.world.asks.add({
      root: turn,
      user: user.id,
      from: agent,
      fromTurn: turn,
      parent: null,
      to,
      hop: 1,
      brief: {
        objective: objective || words,
        known: [from ? `They are on ${from.name} in Alpha.` : '', before]
          .filter(Boolean)
          .join('\n\n'),
        answerWanted: '',
        limits: '',
        direct: { said: line.id },
      },
    })
    this.world.line({
      actor: agent === CHIEF ? { kind: 'alpha' } : { kind: 'alpha', id: agent },
      kind: 'asking',
      words: `Asking ${name}`,
      data: { ask: ask.id, to, name, direct: true },
      user: user.id,
      turn,
    })
    this.events.emit('event', { type: 'lines', user: user.id, agent } satisfies EngineEvent)
    this.bus.deliver(user, ask)
    return turn
  }

  async stop(user: User, agent = CHIEF): Promise<void> {
    const desk = this.desk(user, agent)
    const root = desk.serving?.root
    if (root) this.stopChain(user, root)
    await desk.stop()
  }

  // Stop on the line that asked: the chain that ask belongs to.
  stopAsked(user: User, id: string): void {
    const ask = this.world.asks.get(id)
    if (ask?.user !== user.id) return
    this.stopChain(user, ask.root)
    this.events.emit('event', {
      type: 'lines',
      user: user.id,
      agent: ask.from,
    } satisfies EngineEvent)
  }

  // Who this agent is working for just now, when a teammate asked it.
  serving(user: User, agent = CHIEF): string | null {
    const id = this.desks.get(`${user.id}:${agent}`)?.serving?.ask
    const ask = id ? this.world.asks.get(id) : undefined
    return ask ? this.nameOf(ask.from) : null
  }

  // A schedule's draft answered with the card's own buttons or in words: sent as drafted only on
  // its yes, Send it; anything else holds it, the words typed kept as the reason (item 41 of the
  // problems list, 25 Oct).
  async answerDraft(user: User, cardId: string, answer: string): Promise<Card> {
    const drafts = this.options.hands?.drafts
    if (!drafts) throw new Refused('Drafts are not set up in this core.')
    const out =
      answer === 'Send it'
        ? await drafts.send(cardId, null, user)
        : drafts.hold(
            cardId,
            'Something else',
            answer === 'Not now' || answer === 'No' ? '' : answer,
            user,
          )
    this.events.emit('event', { type: 'lines', user: user.id } satisfies EngineEvent)
    return out
  }

  answer(user: User, cardId: string, answer: string): Card {
    // a file from the mail: a yes files it where it was proposed, a no lets it go
    const intake = this.options.hands?.intake
    const waiting = this.world.cards.get(cardId)
    if (intake && waiting?.call?.tool === FILING) {
      const f = waiting.call.input as Filing
      const no = answer === 'Decline' || answer === 'No' || answer === 'Not now'
      const out = no
        ? intake.decline(cardId, '', user)
        : intake.file(cardId, { row: f.row, kind: f.kind }, user)
      this.events.emit('event', { type: 'lines', user: user.id } satisfies EngineEvent)
      return out
    }
    // a rule on its Save card: the person's Save makes it, as the card showed it
    if (
      waiting?.call?.tool === SAVE_RULE &&
      waiting.state === 'waiting' &&
      answer === SAVE_ANSWERS.yes
    )
      this.world.rules.save(waiting.call.input as RuleSpec, {
        actor: { kind: 'person', id: user.id },
        user: user.id,
        card: cardId,
      })
    if (waiting?.call?.tool === ASK_MORE && waiting.state === 'waiting' && answer === 'Continue')
      this.world.asks.allowMore(
        (waiting.call.input as { root: string }).root,
        config.limits().asks_per_request,
      )
    const card = this.world.cards.answer(cardId, answer, { kind: 'person', id: user.id })
    this.events.emit('event', { type: 'lines', user: user.id } satisfies EngineEvent)
    // the desk carries on only with a card its own turn opened, or a run it started; a schedule's
    // card from a scheduled run is the run's to go on with (item 41, 25 Oct)
    const task = taskOfTurn(card.turn)
    if (task && card.state !== 'waiting' && this.world.tasks.get(task)?.state === 'waiting')
      this.world.tasks.setState(task, 'doing', {
        actor: { kind: 'person', id: user.id },
        user: user.id,
      })
    if (card.turn) this.desk(user, card.agent ?? CHIEF, task ?? undefined).cardAnswered(card)
    return card
  }

  // What the person drops is filed at once (design §12).
  drop(user: User, bytes: Uint8Array, name: string, mime: string) {
    const out = takeIn(this.world, bytes, name, mime, {
      actor: { kind: 'person', id: user.id },
      user: user.id,
    })
    this.events.emit('event', { type: 'lines', user: user.id } satisfies EngineEvent)
    return out
  }

  // Any of this person's desks at work, or an ask still on its way.
  working(user: User): boolean {
    return (
      [...this.desks.entries()].some(([id, d]) => id.startsWith(`${user.id}:`) && d.working) ||
      this.world.asks.inState('running').some((a) => a.user === user.id) ||
      this.world.asks.inState('queued').some((a) => a.user === user.id)
    )
  }

  busy(user: User, agent = CHIEF, lane?: string): boolean {
    return this.desks.get(`${user.id}:${agent}${lane ? `:${lane}` : ''}`)?.busy ?? false
  }

  private closeLane(user: User, agent: string, task: string): void {
    const id = `${user.id}:${agent}:${task}`
    this.desks.get(id)?.close()
    this.desks.delete(id)
  }

  close(): void {
    for (const d of this.desks.values()) d.close()
    this.desks.clear()
    this.connectors?.close()
  }
}
