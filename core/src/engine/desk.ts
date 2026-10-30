// The desk: each user's one long-lived session, the only session that speaks to them (design §5).
// It speaks to the model through a provider (decision 11): Claude Code through the Agent SDK on
// the person's subscription or a key, or Alpha's own loop on another route; the tools are the
// registry's, and every call goes through the gate adapter before it runs. Longer work runs as
// the route's background subagents where it has them; their outcomes come back here and the desk
// says them in its own words.
import { createHash } from 'node:crypto'
import { realpathSync } from 'node:fs'
import { resolve } from 'node:path'
import type { ConnectorService } from '../connectors/service.ts'
import type { Card } from '../world/cards.ts'
import type { User, World } from '../world/world.ts'
import { ClaudeCodeProvider, type QueryFn } from './claudecode.ts'
import { startLayer, turnLayer } from './context.ts'
import { Gatekeeper } from './gate.ts'
import type { Decision, Provider, Session, SessionEvent } from './provider.ts'
import { Registry } from './registry.ts'
import type { ModelRoute } from './route.ts'
import { type Hands, type Here, TOOL_NAMES, worldTools } from './tools/index.ts'

export type { QueryFn } from './claudecode.ts'

export type DeskEvent =
  | { type: 'lines' }
  | { type: 'live'; turn: string; text: string; doing: string | null }
  | { type: 'busy'; turn: string }
  | { type: 'idle' }

export interface DeskOptions {
  // the model behind the desk, or how to pick it when a session opens (the route can change);
  // Claude Code when not given
  provider?: Provider | (() => Provider)
  // every provider the person can choose, by route, for Settings › Model
  providers?: { route: 'subscription' | 'key' | 'api'; title: string; provider: Provider }[]
  query?: QueryFn // a scripted session for the Claude Code provider (tests)
  emit?: (e: DeskEvent) => void
  granted?: string[] // folders the person granted, read-only
  connectors?: ConnectorService
  hands?: Hands
  route?: ModelRoute // how this install reaches Claude: the person's subscription or a key
  // Alpha's words alone (measured 24 Oct: six journeys, three runs each way; alone passed 17 of
  // 18 to appended's 18, 8% faster and 9% fewer input tokens, and one prompt serves both routes),
  // or appended to the route's own prompt:
  // measures one against the other.
  prompt?: 'appended' | 'alone'
}

interface Turn {
  turn: string
  text: string // what is sent to the session
  said: { message: number; user: string } | null
  message: string | null // the person's own words, when the turn is on their message
  from?: { id: string; name: string } | null // the module they asked from
  after?: () => void // what code does once the reply is in (the interview's next question)
}

// A kept session is resumed only with the same tools (v1 crashed resuming one made on others).
export function fingerprint(connectorTools: string[]): string {
  return createHash('sha256')
    .update([...TOOL_NAMES, ...connectorTools].join(','))
    .digest('hex')
    .slice(0, 16)
}

export class Desk {
  private world: World
  private user: User
  private session: Session | null = null
  private queue: Turn[] = []
  private running: (Turn & { reply: string; doing: string | null }) | null = null
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

  constructor(world: World, user: User, options: DeskOptions = {}) {
    this.world = world
    this.user = user
    this.emit = options.emit ?? (() => {})
    this.granted = options.granted ?? []
    this.connectors = options.connectors ?? null
    this.hands = options.hands
    this.prompt = options.prompt ?? 'alone'
    this.here = {
      current: { user, turn: null, said: null, message: null },
      fromSubagent: false,
      touched: new Set(),
    }
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
        else if (this.running) {
          this.running.doing = e.words
          this.emit({
            type: 'live',
            turn: this.running.turn,
            text: this.running.reply,
            doing: e.words,
          })
        }
      },
    })
  }

  get fingerprint(): string {
    return fingerprint(this.connectors?.toolNames() ?? [])
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

  // The person's sentence: journaled at once, answered in order. Asked from a module (Ask, ⌘J),
  // the line carries the module and the turn's context says so.
  // Said in an agent's thread, the line keeps the agent and the model reads "@<agent> …".
  say(
    words: string,
    from: { id: string; name: string } | null = null,
    to: { id: string; name: string } | null = null,
    // an answer to a prepared interview question: kept against it, the model told so, and the
    // next question asked once the reply is in
    also: { data?: Record<string, unknown>; note?: string; after?: () => void } = {},
  ): string {
    const data = { ...(to ? { agent: to.id } : {}), ...also.data }
    const line = this.world.line({
      actor: { kind: 'person', id: this.user.id },
      kind: 'said',
      words,
      user: this.user.id,
      module: from?.id ?? null,
      ...(Object.keys(data).length ? { data } : {}),
    })
    const turn = String(line.id)
    const text = to ? `@${to.name} ${words}` : words
    this.queue.push({
      turn,
      text: also.note ? `${text}\n\n(${also.note})` : text,
      said: { message: line.id, user: this.user.id },
      message: words,
      from,
      ...(also.after ? { after: also.after } : {}),
    })
    this.emit({ type: 'lines' })
    this.pump()
    return turn
  }

  // A permission card answered in the window: the desk is told, and carries on.
  cardAnswered(card: Card): void {
    if (card.kind !== 'permission' && card.kind !== 'question') return
    const words =
      card.kind === 'permission'
        ? card.state === 'yes'
          ? `The person said yes on the card: “${card.words}”. Go ahead with it now.`
          : `The person said no on the card: “${card.words}”. Leave it.`
        : `The person answered your question “${card.words}”: ${card.answer}`
    const line = this.world.line({
      actor: { kind: 'system' },
      kind: 'noticed',
      words:
        card.kind === 'permission'
          ? `Carrying on after your ${card.state === 'yes' ? 'yes' : 'no'}.`
          : 'Carrying on with your answer.',
      user: this.user.id,
      card: card.id,
    })
    this.queue.push({ turn: `n${line.id}`, text: words, said: null, message: null })
    this.emit({ type: 'lines' })
    this.pump()
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
    if (this.running || !this.queue.length) return
    const next = this.queue.shift() as Turn
    if (!this.session) this.open()
    this.running = { ...next, reply: '', doing: null }
    this.here.current = {
      user: this.user,
      turn: next.turn,
      said: next.said,
      message: next.message,
      from: next.from ?? null,
    }
    this.emit({ type: 'busy', turn: next.turn })
    this.session?.send(next.text)
  }

  private open(): void {
    const kept = this.world.desk(this.user.id)
    const resume = kept && kept.tools === this.fingerprint ? kept.sessionId : undefined
    this.fresh = !resume
    const deskDir = realpathSync(this.world.deskDir(this.user.id))
    const modules = realpathSync(this.world.paths.modules)
    const session = this.provider().session({
      deskDir,
      modules,
      granted: this.granted,
      userName: this.user.name,
      ...(resume ? { resume } : {}),
      registry: this.registry(),
      gate: this.gate,
      context: {
        start: () => {
          // the start layer is the fresh start: every table is described again on its first touch
          this.here.touched.clear()
          return startLayer(
            this.world,
            this.user.id,
            this.world.deskDir(this.user.id),
            this.connectors?.describe() ?? null,
          )
        },
        turn: () =>
          turnLayer(
            this.world,
            this.user.id,
            this.world.desk(this.user.id)?.seenJournalId ?? 0,
            this.here.current.message,
            this.here.current.from ?? null,
          ),
        takeFresh: () => {
          const was = this.fresh
          this.fresh = false
          return was
        },
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
      this.world.keepDesk(this.user.id, e.sessionId, this.fingerprint, { kind: 'system' })
      return
    }
    if (e.type === 'limit') {
      const at = e.resetsAt
      this.world.line({
        actor: { kind: 'system' },
        kind: 'limit',
        words: at
          ? `Your Claude usage window is closed until ${at.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}. I'll carry on then.`
          : 'Your Claude usage window is closed for now.',
        data: { info: e.info },
        user: this.user.id,
        turn: this.running?.turn ?? null,
      })
      if (at && this.running) {
        const again: Turn = {
          turn: this.running.turn,
          text: 'The usage window is open again: carry on with what was asked.',
          said: null,
          message: null,
        }
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
      running.reply += e.delta
      this.emit({ type: 'live', turn: running.turn, text: running.reply, doing: running.doing })
      return
    }
    if (e.type === 'break') {
      if (running.reply && !e.sub) running.reply += '\n\n'
      return
    }
    if (e.type === 'result') {
      const stopped = this.stopping || e.stopped
      this.world.line({
        actor: { kind: 'alpha' },
        kind: e.ok || stopped ? 'replied' : 'error',
        words: stopped
          ? 'Stopped.'
          : e.ok
            ? e.text || 'Done.'
            : 'Something went wrong, and nothing more was done.',
        data: e.data,
        user: this.user.id,
        turn: running.turn,
      })
      if (e.ok && !stopped) running.after?.()
      this.world.markSeen(this.user.id, this.world.lastLineId())
      this.running = null
      this.stopping = false
      this.emit({ type: 'lines' })
      this.emit({ type: 'idle' })
      this.pump()
    }
  }

  private startOwnTurn(words: string): void {
    const line = this.world.line({
      actor: { kind: 'alpha' },
      kind: 'noticed',
      words,
      user: this.user.id,
    })
    const turn = `n${line.id}`
    this.running = { turn, text: '', said: null, message: null, reply: '', doing: null }
    this.here.current = { user: this.user, turn, said: null, message: null }
    this.emit({ type: 'busy', turn })
    this.emit({ type: 'lines' })
  }
}

function inside(path: string, base: string, roots: string[]): boolean {
  let full = resolve(base, path)
  try {
    full = realpathSync(full)
  } catch {
    try {
      full = resolve(realpathSync(resolve(full, '..')), full.split('/').pop() as string)
    } catch {
      // a path whose folder is not there either: judged as written
    }
  }
  return roots.some((r) => full === r || full.startsWith(`${r}/`))
}

// The walls on the route's file tools: reads in the desk's folder, the modules and the granted
// folders; writes in the first two only; and a module's module.yaml never by hand, since its
// sites and shape change through the shape tool and the person's cards (item 12 of the problems
// list, 25 Oct).
export function fileWall(
  tool: string,
  input: Record<string, unknown>,
  deskDir: string,
  modules: string,
  granted: string[],
): Decision {
  const path = String(input.file_path ?? input.path ?? input.notebook_path ?? '')
  if (tool === 'Read') {
    if (inside(path, deskDir, [deskDir, modules, ...granted])) return { allow: true }
    return { allow: false, reason: `${path} is not in a folder the person granted.` }
  }
  if (tool === 'Write' || tool === 'Edit' || tool === 'NotebookEdit') {
    if (/(^|\/)module\.yaml$/.test(path) && inside(path, deskDir, [modules]))
      return {
        allow: false,
        reason:
          'module.yaml is written by Alpha from the shape tool and the person’s cards, never by hand.',
      }
    if (inside(path, deskDir, [deskDir, modules])) return { allow: true }
    return {
      allow: false,
      reason: `Alpha writes files only in ${deskDir} and the module folders under ${modules}.`,
    }
  }
  return { allow: false, reason: `${tool} is not one of Alpha's tools.` }
}
