// The desk: each user's one long-lived session, the only session that speaks to them (design §5).
// It runs on the Agent SDK with the unmodified Claude Code. Longer work runs as the SDK's
// background subagents; their outcomes come back here and the desk says them in its own words.
import { createHash } from 'node:crypto'
import { realpathSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  type CanUseTool,
  type HookCallback,
  type Options,
  type Query,
  type SDKMessage,
  type SDKUserMessage,
  query as sdkQuery,
} from '@anthropic-ai/claude-agent-sdk'
import { config } from '../config.ts'
import { SERVER as CONNECTORS, type ConnectorService } from '../connectors/service.ts'
import { decide } from '../gates/gates.ts'
import type { Card } from '../world/cards.ts'
import type { User, World } from '../world/world.ts'
import { startLayer, turnLayer } from './context.ts'
import type { ModelRoute } from './route.ts'
import { EFFECTS, type Hands, type Here, SERVER, TOOL_NAMES, worldTools } from './tools.ts'
import { stepWords } from './words.ts'

export type DeskEvent =
  | { type: 'lines' }
  | { type: 'live'; turn: string; text: string; doing: string | null }
  | { type: 'busy'; turn: string }
  | { type: 'idle' }

export type QueryFn = (params: { prompt: AsyncIterable<SDKUserMessage>; options: Options }) => Query

export interface DeskOptions {
  query?: QueryFn
  emit?: (e: DeskEvent) => void
  granted?: string[] // folders the person granted, read-only
  connectors?: ConnectorService
  hands?: Hands
  route?: ModelRoute // how this install reaches Claude: the person's subscription or a key
  // Alpha's words appended to Claude Code's own prompt (the design's choice), or alone: week 1
  // measures one against the other.
  prompt?: 'appended' | 'alone'
}

// The SDK's own tools the desk has; Read, Write and Edit reach the callback, which checks paths.
const OWN_TOOLS = [
  'Bash',
  'Read',
  'Write',
  'Edit',
  'Glob',
  'Grep',
  'WebSearch',
  'WebFetch',
  'Agent',
  'ToolSearch',
]
const OUTRIGHT = ['Bash', 'Glob', 'Grep', 'WebSearch', 'WebFetch', 'Agent', 'ToolSearch']

interface Turn {
  turn: string
  text: string // what is sent to the session
  said: { message: number; user: string } | null
  message: string | null // the person's own words, when the turn is on their message
  from?: { id: string; name: string } | null // the module they asked from
}

class Inbox implements AsyncIterable<SDKUserMessage> {
  private queue: SDKUserMessage[] = []
  private wake: (() => void) | null = null
  private closed = false
  push(text: string) {
    this.queue.push({
      type: 'user',
      message: { role: 'user', content: text },
      parent_tool_use_id: null,
    })
    this.wake?.()
  }
  close() {
    this.closed = true
    this.wake?.()
  }
  async *[Symbol.asyncIterator]() {
    while (true) {
      while (this.queue.length) yield this.queue.shift() as SDKUserMessage
      if (this.closed) return
      await new Promise<void>((r) => {
        this.wake = r
      })
      this.wake = null
    }
  }
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
  private q: Query | null = null
  private box: Inbox | null = null
  private queue: Turn[] = []
  private running: (Turn & { reply: string; doing: string | null }) | null = null
  private fresh = false
  private stopping = false
  private here: Here
  private query: QueryFn
  private emit: (e: DeskEvent) => void
  private granted: string[]
  private prompt: 'appended' | 'alone'
  private connectors: ConnectorService | null
  private hands: Hands | undefined
  private route: ModelRoute | undefined
  private networkWaits: string[] = []

  constructor(world: World, user: User, options: DeskOptions = {}) {
    this.world = world
    this.user = user
    this.query = options.query ?? (sdkQuery as QueryFn)
    this.emit = options.emit ?? (() => {})
    this.granted = options.granted ?? []
    this.connectors = options.connectors ?? null
    this.hands = options.hands
    this.route = options.route
    this.prompt = options.prompt ?? 'appended'
    this.here = { current: { user, turn: null, said: null, message: null }, fromSubagent: false }
  }

  get fingerprint(): string {
    return fingerprint(this.connectors?.names() ?? [])
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
  say(words: string, from: { id: string; name: string } | null = null): string {
    const line = this.world.line({
      actor: { kind: 'person', id: this.user.id },
      kind: 'said',
      words,
      user: this.user.id,
      module: from?.id ?? null,
    })
    const turn = String(line.id)
    this.queue.push({
      turn,
      text: words,
      said: { message: line.id, user: this.user.id },
      message: words,
      from,
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
    if (!this.running || !this.q) return
    this.stopping = true
    await this.q.interrupt().catch(() => undefined)
  }

  close(): void {
    this.box?.close()
    this.q?.close()
    this.q = null
    this.box = null
  }

  private pump(): void {
    if (this.running || !this.queue.length) return
    const next = this.queue.shift() as Turn
    if (!this.q) this.open()
    this.running = { ...next, reply: '', doing: null }
    this.here.current = {
      user: this.user,
      turn: next.turn,
      said: next.said,
      message: next.message,
      from: next.from ?? null,
    }
    this.emit({ type: 'busy', turn: next.turn })
    this.box?.push(next.text)
  }

  private open(): void {
    const kept = this.world.desk(this.user.id)
    const resume = kept && kept.tools === this.fingerprint ? kept.sessionId : undefined
    this.fresh = !resume
    this.box = new Inbox()
    this.q = this.query({ prompt: this.box, options: this.options(resume) })
    void this.read(this.q)
  }

  options(resume?: string): Options {
    const deskDir = realpathSync(this.world.deskDir(this.user.id))
    const modules = realpathSync(this.world.paths.modules)
    const models = config.models()
    const home = process.env.HOME ?? ''
    const env: Record<string, string> = {
      HOME: home,
      USER: process.env.USER ?? '',
      PATH: process.env.PATH ?? '/usr/bin:/bin:/usr/sbin:/sbin',
      LANG: process.env.LANG ?? 'en_US.UTF-8',
      TMPDIR: process.env.TMPDIR ?? '/tmp',
      // the person's own claude.ai connectors never join (spike 2)
      ENABLE_CLAUDEAI_MCP_SERVERS: 'false',
      ENABLE_TOOL_SEARCH: 'true',
      CLAUDE_AGENT_SDK_CLIENT_APP: 'alpha/0.1.0',
      ...(this.route?.env() ?? { DISABLE_AUTOUPDATER: '1' }),
    }
    return {
      model: models.desk,
      cwd: deskDir,
      env,
      settingSources: [],
      strictMcpConfig: true,
      tools: OWN_TOOLS,
      allowedTools: [
        ...TOOL_NAMES.map((t) => `mcp__${SERVER}__${t}`),
        ...(this.connectors?.names() ?? []).map((t) => `mcp__${CONNECTORS}__${t}`),
        ...OUTRIGHT,
      ],
      permissionMode: 'default',
      canUseTool: this.canUseTool,
      mcpServers: {
        [SERVER]: worldTools(this.world, this.here, this.hands),
        ...(this.connectors ? { [CONNECTORS]: this.connectors.server() } : {}),
      },
      additionalDirectories: [modules, ...this.granted],
      sandbox: {
        enabled: true,
        failIfUnavailable: true,
        autoAllowBashIfSandboxed: true,
        allowUnsandboxedCommands: false,
        filesystem: {
          denyRead: home ? [home] : [],
          allowRead: [deskDir, modules, ...this.granted],
          denyWrite: this.granted,
        },
        network: {},
      },
      includePartialMessages: true,
      systemPrompt:
        this.prompt === 'alone'
          ? { type: 'custom', prompt: config.systemPrompt(this.user.name), snapshot: false }
          : {
              type: 'preset',
              preset: 'claude_code',
              append: config.systemPrompt(this.user.name),
              snapshot: false,
            },
      hooks: {
        PreToolUse: [{ hooks: [this.beforeCall] }],
        PostToolUse: [{ hooks: [this.afterCall] }],
        PostToolUseFailure: [{ hooks: [this.afterCall] }],
        UserPromptSubmit: [{ hooks: [this.onMessage] }],
        SessionStart: [{ hooks: [this.onSessionStart] }],
      },
      ...(resume ? { resume } : {}),
    }
  }

  // Before a call: the journal line and the gate.
  private beforeCall: HookCallback = async (input) => {
    if (input.hook_event_name !== 'PreToolUse') return {}
    const toolInput = (input.tool_input ?? {}) as Record<string, unknown>
    const name = input.tool_name.replace(`mcp__${SERVER}__`, '')
    const isWorld = input.tool_name.startsWith(`mcp__${SERVER}__`)
    const words = stepWords(input.tool_name, toolInput)
    const cur = this.here.current
    this.world.line({
      actor: { kind: 'alpha' },
      kind: 'call',
      words,
      data: {
        tool: name,
        input: toolInput,
        call: input.tool_use_id,
        subagent: input.agent_id ?? null,
      },
      user: this.user.id,
      turn: cur.turn,
    })
    if (this.running) this.running.doing = words
    this.emit({ type: 'live', turn: cur.turn ?? '', text: this.running?.reply ?? '', doing: words })
    if (input.tool_name.startsWith(`mcp__${CONNECTORS}__`))
      return this.gateConnector(
        input.tool_name,
        toolInput,
        words,
        input.agent_id ? null : cur.message,
      )
    if (!isWorld) return {}
    this.here.fromSubagent = !!input.agent_id
    const effectOf = EFFECTS[name]
    const remove = name === 'change' ? ((toolInput.remove as string[] | undefined) ?? []) : []
    const removingTable = name === 'shape' && toolInput.action === 'remove_table'
    const tableName = typeof toolInput.table === 'string' ? toolInput.table : ''
    const table = tableName ? this.world.shape.table(tableName) : undefined
    const removingTasks =
      name === 'task' && toolInput.action === 'remove'
        ? ((toolInput.ids as string[] | undefined) ??
          (typeof toolInput.id === 'string' ? [toolInput.id] : []))
        : []
    const ownEntries = remove.length
      ? this.world.records.personsOwn(remove)
      : removingTable && table
        ? this.world.records.personsOwn(this.world.records.list(table.id).map((r) => r.id))
        : removingTasks.length
          ? this.world.tasks.personsOwn(removingTasks)
          : false
    const verdict = decide(this.world, {
      call: { tool: name, input: toolInput },
      effect: effectOf ? effectOf(toolInput) : undefined,
      preview: `${words}?`,
      restsOn: !input.agent_id && cur.message ? [`your message: “${cur.message}”`] : [],
      cannotUndo:
        remove.length || removingTable
          ? 'Removed rows are gone from the table; Activity keeps that they were there.'
          : removingTasks.length
            ? 'Removed tasks are gone with the tasks beneath them; Activity keeps that they were there.'
            : null,
      ownEntries,
      askedIn: typeof toolInput.asked_in === 'string' ? toolInput.asked_in : null,
      message: input.agent_id ? null : cur.message,
      actor: { kind: 'alpha' },
      user: this.user.id,
      turn: cur.turn,
      module: table?.module.id ?? null,
    })
    if (verdict.pass)
      return { hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'allow' } }
    this.emit({ type: 'lines' })
    return {
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason: verdict.reason,
      },
    }
  }

  // A connector tool's effect, declared by its connector, goes to the gates like any other.
  private gateConnector(
    toolName: string,
    input: Record<string, unknown>,
    words: string,
    message: string | null,
  ) {
    const name = toolName.replace(`mcp__${CONNECTORS}__`, '')
    const preview = this.connectors?.preview(name, input)
    const cur = this.here.current
    const verdict = decide(this.world, {
      call: { tool: name, input },
      effect: this.connectors?.effect(name, input),
      restsOn: message ? [`your message: “${message}”`] : [],
      preview: preview?.words ? `${preview.words}?` : `${words}?`,
      ...(preview?.detail ? { detail: preview.detail } : {}),
      ...(preview?.yes ? { yes: preview.yes } : {}),
      cannotUndo: 'Once it has gone, it cannot be called back.',
      message,
      actor: { kind: 'alpha' },
      user: this.user.id,
      turn: cur.turn,
    })
    if (verdict.pass)
      return {
        hookSpecificOutput: {
          hookEventName: 'PreToolUse' as const,
          permissionDecision: 'allow' as const,
        },
      }
    this.emit({ type: 'lines' })
    return {
      hookSpecificOutput: {
        hookEventName: 'PreToolUse' as const,
        permissionDecision: 'deny' as const,
        permissionDecisionReason: verdict.reason,
      },
    }
  }

  // After a call: the journal line saying how it went.
  private afterCall: HookCallback = async (input) => {
    if (input.hook_event_name !== 'PostToolUse' && input.hook_event_name !== 'PostToolUseFailure')
      return {}
    const failed = input.hook_event_name === 'PostToolUseFailure' || isErrorResponse(input)
    this.world.line({
      actor: { kind: 'alpha' },
      kind: 'called',
      words: failed ? 'That step did not work.' : 'Done.',
      data: {
        call: input.tool_use_id,
        ok: !failed,
        ...(input.hook_event_name === 'PostToolUse' && input.duration_ms !== undefined
          ? { ms: input.duration_ms }
          : {}),
        ...(failed ? { error: errorText(input) } : {}),
      },
      user: this.user.id,
      turn: this.here.current.turn,
    })
    this.emit({ type: 'lines' })
    // The shell's own output only says the connection failed; say why (it waits on a card).
    const waiting = this.networkWaits.splice(0)
    if (!waiting.length) return {}
    return {
      hookSpecificOutput: {
        hookEventName: input.hook_event_name,
        additionalContext: `Reaching ${waiting.join(', ')} waits for the person's yes on a card in their window; nothing was sent. You will be told when they answer.`,
      },
    }
  }

  // On each message: the per-turn layer, and on a fresh session's first message the start layer
  // too (SessionStart does not fire on a fresh session: spike 7).
  private onMessage: HookCallback = async (input) => {
    if (input.hook_event_name !== 'UserPromptSubmit') return {}
    const seen = this.world.desk(this.user.id)?.seenJournalId ?? 0
    const layers = [
      this.fresh
        ? startLayer(
            this.world,
            this.user.id,
            this.world.deskDir(this.user.id),
            this.connectors?.describe() ?? null,
          )
        : '',
      turnLayer(
        this.world,
        this.user.id,
        seen,
        this.here.current.message,
        this.here.current.from ?? null,
      ),
    ].filter(Boolean)
    this.fresh = false
    return {
      hookSpecificOutput: {
        hookEventName: 'UserPromptSubmit',
        additionalContext: layers.join('\n\n'),
      },
    }
  }

  // After compaction the start layer comes back.
  private onSessionStart: HookCallback = async (input) => {
    if (input.hook_event_name !== 'SessionStart' || input.source !== 'compact') return {}
    return {
      hookSpecificOutput: {
        hookEventName: 'SessionStart',
        additionalContext: startLayer(
          this.world,
          this.user.id,
          this.world.deskDir(this.user.id),
          this.connectors?.describe() ?? null,
        ),
      },
    }
  }

  // The SDK's file tools and the shell's network reach here. Walls refuse; the gate asks.
  private canUseTool: CanUseTool = async (toolName, input) => {
    const deskDir = realpathSync(this.world.deskDir(this.user.id))
    const modules = realpathSync(this.world.paths.modules)
    if (toolName === 'SandboxNetworkAccess') {
      const host = String(input.host ?? '')
      const cur = this.here.current
      const verdict = decide(this.world, {
        call: { tool: 'network', input: { host } },
        effect: 'outward',
        preview: `${stepWords('network', { host })}?`,
        yes: 'Let it',
        restsOn: [],
        cannotUndo: 'What a script sends to that site leaves your world.',
        actor: { kind: 'alpha' },
        user: this.user.id,
        turn: cur.turn,
      })
      this.emit({ type: 'lines' })
      if (!verdict.pass) this.networkWaits.push(host)
      return verdict.pass
        ? { behavior: 'allow', updatedInput: input }
        : { behavior: 'deny', message: verdict.reason }
    }
    const path = String(input.file_path ?? input.path ?? input.notebook_path ?? '')
    if (toolName === 'Read') {
      if (inside(path, deskDir, [deskDir, modules, ...this.granted]))
        return { behavior: 'allow', updatedInput: input }
      return { behavior: 'deny', message: `${path} is not in a folder the person granted.` }
    }
    if (toolName === 'Write' || toolName === 'Edit' || toolName === 'NotebookEdit') {
      if (inside(path, deskDir, [deskDir, modules]))
        return { behavior: 'allow', updatedInput: input }
      return {
        behavior: 'deny',
        message: `Alpha writes files only in ${deskDir} and the module folders under ${modules}.`,
      }
    }
    return { behavior: 'deny', message: `${toolName} is not one of Alpha's tools.` }
  }

  private async read(q: Query): Promise<void> {
    try {
      while (true) {
        const step = await q.next()
        if (step.done) break
        this.handle(step.value)
      }
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
    if (this.q === q) {
      this.q = null
      this.box = null
      if (this.running) {
        this.running = null
        this.emit({ type: 'lines' })
        this.emit({ type: 'idle' })
      }
      this.pump()
    }
  }

  private handle(m: SDKMessage): void {
    if (m.type === 'system' && m.subtype === 'init') {
      this.world.keepDesk(this.user.id, m.session_id, this.fingerprint, { kind: 'system' })
      return
    }
    if (m.type === 'rate_limit_event' && m.rate_limit_info.status === 'rejected') {
      const at = m.rate_limit_info.resetsAt ? new Date(m.rate_limit_info.resetsAt * 1000) : null
      this.world.line({
        actor: { kind: 'system' },
        kind: 'limit',
        words: at
          ? `Your Claude usage window is closed until ${at.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}. I'll carry on then.`
          : 'Your Claude usage window is closed for now.',
        data: { info: m.rate_limit_info },
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
    if (m.type === 'system' && m.subtype === 'task_notification') {
      if (!this.running) this.startOwnTurn(`Background work finished: ${m.summary}`)
      return
    }
    if (!this.running && (m.type === 'assistant' || m.type === 'stream_event'))
      this.startOwnTurn('Following up on background work.')
    const running = this.running
    if (!running) return
    if (m.type === 'stream_event') {
      const ev = m.event
      if (
        ev.type === 'content_block_delta' &&
        ev.delta.type === 'text_delta' &&
        !m.parent_tool_use_id
      ) {
        running.reply += ev.delta.text
        this.emit({ type: 'live', turn: running.turn, text: running.reply, doing: running.doing })
      }
      if (ev.type === 'message_start' && running.reply && !m.parent_tool_use_id)
        running.reply += '\n\n'
      return
    }
    if (m.type === 'result') {
      const stopped =
        this.stopping ||
        m.terminal_reason === 'aborted_tools' ||
        m.terminal_reason === 'aborted_streaming'
      const text = m.subtype === 'success' ? m.result.trim() : ''
      const usage = m.modelUsage
      this.world.line({
        actor: { kind: 'alpha' },
        kind: m.subtype === 'success' || stopped ? 'replied' : 'error',
        words: stopped
          ? 'Stopped.'
          : m.subtype === 'success'
            ? text || 'Done.'
            : 'Something went wrong, and nothing more was done.',
        data: {
          ms: m.duration_ms,
          turns: m.num_turns,
          cost: m.total_cost_usd,
          usage,
          terminal: m.terminal_reason ?? null,
          ...(m.subtype !== 'success' ? { errors: m.errors } : {}),
        },
        user: this.user.id,
        turn: running.turn,
      })
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

function isErrorResponse(input: { tool_response?: unknown }): boolean {
  const r = input.tool_response as { isError?: boolean; is_error?: boolean } | undefined
  return !!(r && (r.isError || r.is_error))
}

function errorText(input: unknown): string {
  const i = input as { error?: string; tool_response?: { content?: { text?: string }[] } }
  return i.error ?? i.tool_response?.content?.map((c) => c.text ?? '').join(' ') ?? ''
}
