// The desk: each user's one long-lived session, the only session that speaks to them (design §5).
// It speaks to the model through a provider (decision 11): Claude Code through the Agent SDK on
// the person's subscription or a key; the tools are the registry's, and every call goes through the gate adapter before it runs. Longer work runs as
// the route's background subagents where it has them; their outcomes come back here and the desk
// says them in its own words.
import { realpathSync } from 'node:fs'
import { config } from '../config.ts'
import type { ConnectorService } from '../connectors/service.ts'
import { instructionsOf } from '../modules/agents.ts'
import { type AgentAsk, askOfTurn, OPEN } from '../world/agents/asks.ts'
import { CHIEF } from '../world/agents/index.ts'
import type { Card } from '../world/cards.ts'
import type { Actor } from '../world/journal.ts'
import type { User, World } from '../world/world.ts'
import { answersText, askText, cardWords, carryingOn } from './ask-words.ts'
import { ClaudeCodeProvider } from './claudecode.ts'
import {
  handover,
  heardDirectly,
  lastWords,
  memoryLayer,
  newsOf,
  ownFolderLayer,
  pickedLine,
  startLayer,
  teamOf,
  turnLayer,
} from './context.ts'
import {
  addBreak,
  addStep,
  addText,
  limitLine,
  liveOf,
  type Running,
  settleAsk,
  startTurn,
  textSoFar,
  turnAfterLimit,
} from './desk-turn.ts'
import { type DeskEvent, type DeskOptions, fingerprint, type Turn } from './desk-types.ts'
import { fileWall } from './filewall.ts'
import { Gatekeeper } from './gate.ts'
import type { Decision, Provider, Session, SessionEvent } from './provider.ts'
import { Registry } from './registry.ts'
import { costOf, turnSpent } from './spent.ts'
import { ASK_MORE } from './tools/agents.ts'
import { type Hands, type Here, worldTools } from './tools/index.ts'

export type { DeskEvent, DeskOptions, QueryFn } from './desk-types.ts'
export { fingerprint } from './desk-types.ts'
export { fileWall } from './filewall.ts'

export class Desk {
  private world: World
  private user: User
  session: Session | null = null
  private queue: Turn[] = []
  private running: Running | null = null
  private fresh = false
  private stopping = false
  private here: Here
  private provider: () => Provider
  private gate: Gatekeeper
  private emit: (e: DeskEvent) => void
  private granted: string[]
  private prompt: 'appended' | 'alone'
  private connectors: ConnectorService | null
  private hands: Hands | undefined
  private starts: () => string[]
  private agentId: string
  private lane: string | null // a task's own thread with this agent
  private bus: DeskOptions['bus']
  private openedWith = ''
  private handingOver = false
  private knownMemories = new Set<string>()
  private knownTeam = new Map<string, string>()
  private reports = { after: 0 } // what its scheduled work last told it, in its own chat
  private heardUpTo = 0

  constructor(world: World, user: User, options: DeskOptions = {}) {
    this.world = world
    this.heardUpTo = world.lastLineId() // what came before this desk is in its session or handover
    this.user = user
    this.emit = options.emit ?? (() => {})
    this.granted = options.granted ?? []
    this.connectors = options.connectors ?? null
    this.hands = options.hands
    this.prompt = options.prompt ?? 'alone'
    this.starts = options.starts ?? (() => [])
    this.agentId = options.agent ?? CHIEF
    this.lane = options.lane ?? null
    if (this.lane) this.reports.after = Number.POSITIVE_INFINITY
    this.here = {
      current: { user, turn: null, said: null, message: null, agent: this.named },
      fromSubagent: false,
      touched: new Set(),
      afterTurn: [],
      bus: options.bus,
    }
    this.bus = options.bus
    const given = options.provider
    const own = given
      ? null
      : new ClaudeCodeProvider({
          ...(options.query ? { query: options.query } : {}),
          ...(options.route ? { route: options.route } : {}),
          askDir: world.paths.dir,
        })
    this.provider = typeof given === 'function' ? given : () => (given ?? own) as Provider
    this.gate = new Gatekeeper(world, this.here, user, {
      connectors: this.connectors,
      emit: (e) => {
        if (e.type === 'lines') this.emit({ type: 'lines' })
        else if (e.type === 'step') this.keepText()
        else if (this.running) {
          addStep(this.running, e.words)
          this.emit(liveOf(this.running))
        }
      },
    })
  }

  // The agent this desk is, by id; none for the Chief of staff.
  private get named(): string | null {
    return this.agentId === CHIEF ? null : this.agentId
  }

  private get actor(): Actor {
    return this.named ? { kind: 'alpha', id: this.named } : { kind: 'alpha' }
  }

  get fingerprint(): string {
    const a = this.named ? this.world.agents.get(this.named) : undefined
    return fingerprint(
      this.connectors?.toolNames() ?? [],
      a ? [a.name, a.title, a.description, a.updatedAt].join('|') : '',
    )
  }

  // What this session is told once: its memory, its team and its folder.
  private whoLayers(): string[] {
    const memory = memoryLayer(this.world, this.agentId, this.user.id)
    this.knownMemories = new Set(memory.ids)
    const team = teamOf(this.world, this.agentId)
    this.knownTeam = new Map(team.map((t) => [t.id, t.stamp]))
    return [
      memory.text,
      team.length ? `## Your teammates\n${team.map((t) => t.line).join('\n')}` : '',
      ownFolderLayer(this.world, this.agentId),
    ].filter(Boolean)
  }

  // The teammates the person picked with @ on this message.
  // Where this desk's session is kept: an agent's chat, or one task's thread with it.
  private get sessionKey(): string {
    return this.lane ? `${this.agentId}#${this.lane}` : this.agentId
  }

  private laneTurn(): string | null {
    return this.lane ? `task:${this.lane}:${this.world.lastLineId()}` : null
  }

  // What is new since the last turn, said once.
  private news(): string[] {
    const heard = heardDirectly(this.world, this.user.id, this.named, this.heardUpTo)
    this.heardUpTo = heard.upTo
    const known = { memories: this.knownMemories, team: this.knownTeam, reports: this.reports }
    return [...newsOf(this.world, this.agentId, this.user.id, known), ...heard.said]
  }

  // The tools the model has: the world's and every connector's, one registry.
  registry(): Registry {
    return new Registry(
      // the nine small tools are in the model's hands from the start; connect, look, keep and
      // run are found when a turn needs them (context by mode, 24 Oct)
      [
        ...worldTools(this.world, this.here, this.hands, this.connectors ?? undefined),
        ...(this.connectors?.entries() ?? []),
      ],
    )
  }

  // The folders the person granted changed: the next turn starts the session again (resumed),
  // so its sandbox reads them.
  setGranted(folders: string[]): void {
    if (folders.join('\n') === this.granted.join('\n')) return
    this.granted = folders
    if (!this.running) this.close()
  }

  get busy(): boolean {
    return this.running !== null
  }

  // Running, or with something queued to run.
  get working(): boolean {
    return this.running !== null || this.queue.length > 0
  }

  // The person's sentence: journaled at once, answered in order. Asked from a module (Ask, ⌘J),
  // the line carries the module and the turn's context says so.
  say(
    words: string,
    from: { id: string; name: string } | null = null,
    named: string[] = [],
  ): string {
    const own = this.laneTurn()
    const line = this.world.line({
      actor: { kind: 'person', id: this.user.id },
      kind: 'said',
      words,
      user: this.user.id,
      module: from?.id ?? null,
      agent: this.named,
      ...(own ? { turn: own } : {}),
    })
    const turn = own ?? String(line.id)
    // a person's own message goes ahead of what teammates sent
    const at = this.queue.findIndex((t) => t.low)
    this.queue.splice(at < 0 ? this.queue.length : at, 0, {
      turn,
      text: words,
      said: { message: line.id, user: this.user.id },
      message: words,
      from,
      named,
    })
    this.emit({ type: 'lines' })
    this.pump()
    return turn
  }

  // A permission card answered in the window: the desk is told, and carries on.
  cardAnswered(card: Card): void {
    if (card.kind !== 'permission' && card.kind !== 'question') return
    // raised while working for a teammate: the follow-up is that work, while it is still open
    const serving = askOfTurn(card.turn)
    const ask = serving ? this.world.asks.get(serving) : undefined
    if (serving && !(ask && OPEN.includes(ask.state))) return
    const turn = serving ? `a${serving}.${this.world.lastLineId()}` : this.laneTurn()
    const line = this.world.line({
      actor: { kind: 'system' },
      kind: 'noticed',
      words: carryingOn(card),
      user: this.user.id,
      card: card.id,
      agent: this.named,
      ...(turn ? { turn } : {}),
    })
    const more =
      card.call?.tool === ASK_MORE
        ? (card.call.input as { root: string; ask: string | null })
        : null
    this.queue.push({
      turn: turn ?? `n${line.id}`,
      text: cardWords(card),
      said: null,
      message: null,
      ...(more ? { root: more.root, ask: more.ask } : ask ? { root: ask.root, ask: ask.id } : {}),
    })
    this.emit({ type: 'lines' })
    this.pump()
  }

  // Work given to this task's thread: a turn of its own, with nothing said for it.
  takeWork(words: string, text: string): void {
    const turn = this.laneTurn() as string
    this.world.line({
      actor: { kind: 'system' },
      kind: 'noticed',
      words,
      user: this.user.id,
      agent: this.named,
      turn,
    })
    this.queue.push({ turn, text, said: null, message: null })
    this.emit({ type: 'lines' })
    this.pump()
  }

  // A teammate's request: its own turn here, once what is ahead of it is done.
  takeAsk(ask: AgentAsk, fromName: string): void {
    this.world.line({
      actor: ask.from === CHIEF ? { kind: 'alpha' } : { kind: 'alpha', id: ask.from },
      kind: 'asked',
      words: `${ask.brief.direct ? 'You asked' : `${fromName} asks`}: ${ask.brief.objective}`,
      data: { ask: ask.id, from: ask.from, name: fromName, brief: ask.brief },
      user: this.user.id,
      agent: this.named,
    })
    const text = askText(ask, fromName)
    this.queue.push({
      turn: `a${ask.id}`,
      text,
      said: ask.brief.direct ? { message: ask.brief.direct.said, user: this.user.id } : null,
      message: ask.brief.direct ? ask.brief.objective : null,
      ask: ask.id,
      root: ask.root,
      low: !ask.brief.direct,
    })
    this.emit({ type: 'lines' })
    this.pump()
  }

  // Everything this desk asked in one turn has come back: one turn reads it all.
  takeAnswers(asks: AgentAsk[], names: (id: string) => string): void {
    const first = asks[0]
    if (!first) return
    const serving = first.parent ? `a${first.parent}.${this.world.lastLineId()}` : this.laneTurn()
    const line = this.world.line({
      actor: { kind: 'system' },
      kind: 'noticed',
      words: 'The answers came back.',
      user: this.user.id,
      agent: this.named,
      ...(serving ? { turn: serving } : {}),
    })
    const text = answersText(asks, names)
    this.queue.push({
      turn: serving ?? `n${line.id}`,
      text,
      said: null,
      message: null,
      ask: first.parent,
      root: first.root,
      low: true,
    })
    this.emit({ type: 'lines' })
    this.pump()
  }

  // A teammate's ask no longer wanted: dropped if it has not started, else stopped.
  stopAsk(id: string): void {
    this.queue = this.queue.filter((t) => t.ask !== id)
    if (this.running?.ask === id) void this.stop()
  }

  // What the running turn serves: the person's request, and a teammate's ask when it is one.
  get serving(): { root: string; ask: string | null } | null {
    const r = this.running
    return r ? { root: r.root ?? r.turn, ask: r.ask ?? null } : null
  }

  async stop(): Promise<void> {
    if (!this.running || !this.session) return
    this.stopping = true
    await this.session.interrupt()
  }

  close(): void {
    this.session?.close()
    this.session = null
  }

  private pump(): void {
    if (this.running) return
    // a follow-up to a request already answered has no one waiting for it
    this.queue = this.queue.filter((t) => {
      const state = t.ask ? this.world.asks.get(t.ask)?.state : undefined
      return !state || OPEN.includes(state)
    })
    if (!this.queue.length) return
    const next = this.queue.shift() as Turn
    // an agent that was edited starts again from its new definition
    if (this.session && this.named && this.openedWith !== this.fingerprint) this.close()
    if (!this.session) this.open()
    this.running = startTurn(next)
    this.here.current = {
      user: this.user,
      turn: next.turn,
      said: next.said,
      message: next.message,
      from: next.from ?? null,
      agent: this.named,
      ask: next.ask ?? null,
      root: next.root ?? next.turn,
      named: next.named ?? [],
    }
    this.here.afterTurn = []
    if (next.ask) this.world.asks.start(next.ask)
    this.emit({ type: 'busy', turn: next.turn })
    this.session?.send(next.text)
  }

  private open(): void {
    const agent = this.named ? this.world.agents.get(this.named) : undefined
    const kept = this.world.desk(this.user.id, this.sessionKey)
    const resume = kept && kept.tools === this.fingerprint ? kept.sessionId : undefined
    this.fresh = !resume
    this.handingOver = !resume && !this.lane
    this.openedWith = this.fingerprint
    const deskDir = realpathSync(this.world.deskDir(this.user.id, this.agentId))
    const modules = realpathSync(this.world.paths.modules)
    const session = this.provider().session({
      deskDir,
      modules,
      granted: agent
        ? [...this.granted, realpathSync(this.world.agents.dirOf(agent.id))]
        : this.granted,
      userName: this.user.name,
      ...(resume ? { resume } : {}),
      model: this.world.agents.modelOf(this.named) ?? config.models().desk,
      ...(agent
        ? {
            identity: config.agentPrompt({
              name: agent.name,
              title: agent.title,
              description: agent.description,
              instructions: instructionsOf(this.world, agent.id),
            }),
          }
        : {}),
      registry: this.registry(),
      gate: this.gate,
      context: {
        start: () => {
          // the start layer is the fresh start: every table is described again on its first touch
          this.here.touched.clear()
          const earlier = this.handingOver ? handover(this.world, this.user.id, this.agentId) : ''
          this.handingOver = false
          return startLayer(
            this.world,
            this.user.id,
            deskDir,
            this.connectors?.describe() ?? null,
            [...this.starts(), ...this.whoLayers(), ...(earlier ? [earlier] : [])],
          )
        },
        turn: () =>
          turnLayer(
            this.world,
            this.user.id,
            this.world.desk(this.user.id, this.sessionKey)?.seenJournalId ?? 0,
            this.here.current.message,
            this.here.current.from ?? null,
            [...pickedLine(this.world, this.here.current.named ?? []), ...this.news()],
          ),
        takeFresh: () => {
          const was = this.fresh
          this.fresh = false
          return was
        },
        compacted: () => lastWords(this.world, this.user.id, this.agentId),
      },
      files: (tool, input) => this.files(tool, input, deskDir, modules),
      prompt: this.prompt,
    })
    this.session = session
    void this.read(session)
  }

  // The route's file tools reach here. Walls refuse: reads in the desk's folder, the modules and
  // the granted folders; writes in the first two only.
  private files(
    tool: string,
    input: Record<string, unknown>,
    deskDir: string,
    modules: string,
  ): Decision {
    return fileWall(tool, input, deskDir, modules, this.granted)
  }

  private async read(session: Session): Promise<void> {
    try {
      for await (const e of session.events()) this.handle(e)
    } catch (err) {
      this.world.line({
        actor: { kind: 'system' },
        kind: 'error',
        words: 'The desk stopped unexpectedly; your next message starts it again.',
        data: { error: err instanceof Error ? err.message : String(err) },
        user: this.user.id,
        agent: this.named,
        turn: this.running?.turn ?? null,
      })
    }
    if (this.session === session) {
      this.session = null
      if (this.running) {
        this.running = null
        this.emit({ type: 'lines' })
        this.emit({ type: 'idle' })
      }
      this.pump()
    }
  }

  private handle(e: SessionEvent): void {
    if (e.type === 'init') {
      this.world.keepDesk(
        this.user.id,
        e.sessionId,
        this.fingerprint,
        { kind: 'system' },
        this.sessionKey,
      )
      return
    }
    if (e.type === 'limit') {
      const at = e.resetsAt
      this.world.line(limitLine(e, this.user.id, this.named, this.running?.turn ?? null))
      if (at && this.running) {
        const again = turnAfterLimit(this.running.turn)
        setTimeout(
          () => {
            this.queue.push(again)
            this.pump()
          },
          Math.max(0, at.getTime() - Date.now()) + 5000,
        ).unref()
      }
      this.emit({ type: 'lines' })
      return
    }
    if (e.type === 'task') {
      if (!this.running) this.startOwnTurn(`Background work finished: ${e.summary}`)
      return
    }
    if (!this.running && (e.type === 'assistant' || e.type === 'text' || e.type === 'break'))
      this.startOwnTurn('Following up on background work.')
    const running = this.running
    if (!running) return
    if (e.type === 'text') {
      if (e.sub) return
      addText(running, e.delta)
      this.emit(liveOf(running))
      return
    }
    if (e.type === 'break') {
      if (!e.sub) addBreak(running)
      return
    }
    if (e.type === 'result') {
      const stopped = this.stopping || e.stopped
      // what the turn spent, under the module it was asked in (core plan step 5)
      const spent = turnSpent(this.world, this.user.id, e.data)
      this.world.spend.add(
        { kind: 'turn', turn: running.turn, module: running.from?.id ?? null, agent: this.named },
        spent,
      )
      if (stopped || !e.ok) this.keepText()
      const shown = textSoFar(running)
      this.world.line({
        actor: this.actor,
        kind: e.ok || stopped ? 'replied' : 'error',
        words: stopped
          ? 'Stopped.'
          : e.ok
            ? shown || e.text || 'Done.'
            : 'Something went wrong, and nothing more was done.',
        data: { ...e.data, spent: costOf(spent) },
        user: this.user.id,
        turn: running.turn,
      })
      // what this turn kept only if it finished: a turn that failed or was stopped saves nothing
      if (e.ok && !stopped) for (const keep of this.here.afterTurn) keep()
      this.here.afterTurn = []
      this.world.markSeen(this.user.id, this.world.lastLineId(), this.sessionKey)
      settleAsk(this.world, this.bus, this.user, running, e, stopped, costOf(spent))
      this.running = null
      this.stopping = false
      this.emit({ type: 'lines' })
      this.emit({ type: 'idle', outcome: stopped ? 'stopped' : e.ok ? 'ok' : 'failed' })
      this.pump()
    }
  }

  // What the model has written since its last step, kept before the step that follows it.
  private keepText(): void {
    const words = this.running && textSoFar(this.running)
    if (!this.running || !words) return
    this.world.line({
      actor: this.actor,
      kind: 'along',
      words,
      user: this.user.id,
      turn: this.running.turn,
    })
  }

  private startOwnTurn(words: string): void {
    const own = this.laneTurn()
    const line = this.world.line({
      actor: this.actor,
      kind: 'noticed',
      words,
      user: this.user.id,
      ...(own ? { turn: own } : {}),
    })
    const turn = own ?? `n${line.id}`
    this.running = startTurn({ turn, text: '', said: null, message: null })
    this.here.current = { user: this.user, turn, said: null, message: null, agent: this.named }
    this.emit({ type: 'busy', turn })
    this.emit({ type: 'lines' })
  }
}
