// The ClaudeCode provider (decision 11): today's route, unchanged in behaviour. The Agent SDK
// with the unmodified Claude Code, on the person's subscription or the firm's key; its shell,
// files, web and subagents stay with it, under the sandbox. The gates are its hooks, which call
// the Gatekeeper; its tools are the registry's entries served in process.
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
import { askOnce, exploreOnce } from './ask.ts'
import type {
  Capabilities,
  Provider,
  Route,
  Session,
  SessionEvent,
  SessionSpec,
} from './provider.ts'
import type { ToolEntry } from './registry.ts'
import type { ModelRoute } from './route.ts'

export type QueryFn = (params: { prompt: AsyncIterable<SDKUserMessage>; options: Options }) => Query

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

export interface ClaudeCodeOptions {
  query?: QueryFn // the SDK's, or a scripted one in tests
  route?: ModelRoute // how this install reaches Claude: the person's subscription or a key
  askDir?: string // where one-question asks run (the world's folder)
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

export class ClaudeCodeProvider implements Provider {
  readonly name = 'Claude Code'
  readonly can: Capabilities = {
    shell: true,
    files: true,
    web: true,
    subagents: true,
    structured: true,
  }
  private query: QueryFn
  private modelRoute: ModelRoute | undefined
  private askDir: string | undefined

  constructor(options: ClaudeCodeOptions = {}) {
    this.query = options.query ?? (sdkQuery as QueryFn)
    this.modelRoute = options.route
    this.askDir = options.askDir
  }

  // Its route: the person's subscription, or the key handed to Claude Code.
  get route(): Route {
    return this.modelRoute?.name === 'key' ? 'key' : 'subscription'
  }

  session(spec: SessionSpec): Session {
    const box = new Inbox()
    const q = this.query({ prompt: box, options: this.options(spec) })
    return {
      send: (text) => box.push(text),
      interrupt: async () => {
        await q.interrupt().catch(() => undefined)
      },
      close: () => {
        box.close()
        q.close()
      },
      events: () => translate(q),
    }
  }

  ask(system: string, prompt: string, schema: Record<string, unknown>) {
    return askOnce(
      this.askDir ?? process.cwd(),
      this.modelRoute?.env() ?? {},
      system,
      prompt,
      schema,
    )
  }

  explore(
    system: string,
    prompt: string,
    tools: ToolEntry[],
    schema: Record<string, unknown>,
    turns: number,
  ) {
    return exploreOnce(
      this.askDir ?? process.cwd(),
      this.modelRoute?.env() ?? {},
      system,
      prompt,
      tools,
      schema,
      turns,
    )
  }

  options(spec: SessionSpec): Options {
    const { deskDir, modules, granted, registry, gate } = spec
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
      ...(this.modelRoute?.env() ?? { DISABLE_AUTOUPDATER: '1' }),
    }
    // Before a call: the journal line and the gate.
    const beforeCall: HookCallback = async (input) => {
      if (input.hook_event_name !== 'PreToolUse') return {}
      const d = await gate.before(
        input.tool_name,
        (input.tool_input ?? {}) as Record<string, unknown>,
        {
          callId: input.tool_use_id,
          subagent: input.agent_id ?? null,
        },
      )
      return {
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          permissionDecision: d.allow ? 'allow' : 'deny',
          ...(d.allow ? {} : { permissionDecisionReason: d.reason }),
        },
      }
    }
    // After a call: the journal line saying how it went. The shell's own output only says the
    // connection failed; say why (it waits on a card).
    const afterCall: HookCallback = async (input) => {
      if (input.hook_event_name !== 'PostToolUse' && input.hook_event_name !== 'PostToolUseFailure')
        return {}
      const failed = input.hook_event_name === 'PostToolUseFailure' || isErrorResponse(input)
      const waiting = await gate.after({
        callId: input.tool_use_id,
        ok: !failed,
        ...(input.hook_event_name === 'PostToolUse' && input.duration_ms !== undefined
          ? { ms: input.duration_ms }
          : {}),
        ...(failed ? { error: errorText(input) } : {}),
        ...(input.hook_event_name === 'PostToolUse' ? { result: input.tool_response } : {}),
      })
      if (!waiting.length) return {}
      return {
        hookSpecificOutput: {
          hookEventName: input.hook_event_name,
          additionalContext: `Reaching ${waiting.join(', ')} waits for the person's yes on a card in their window; nothing was sent. You will be told when they answer.`,
        },
      }
    }
    // On each message: the per-turn layer, and on a fresh session's first message the start
    // layer too (SessionStart does not fire on a fresh session: spike 7).
    const onMessage: HookCallback = async (input) => {
      if (input.hook_event_name !== 'UserPromptSubmit') return {}
      const layers = [spec.context.takeFresh() ? spec.context.start() : '', spec.context.turn()]
      return {
        hookSpecificOutput: {
          hookEventName: 'UserPromptSubmit',
          additionalContext: layers.filter(Boolean).join('\n\n'),
        },
      }
    }
    // After compaction the start layer comes back.
    const onSessionStart: HookCallback = async (input) => {
      if (input.hook_event_name !== 'SessionStart' || input.source !== 'compact') return {}
      return {
        hookSpecificOutput: {
          hookEventName: 'SessionStart',
          additionalContext: spec.context.start(),
        },
      }
    }
    // The SDK's file tools and the shell's network reach here. Walls refuse; the gate asks.
    const canUseTool: CanUseTool = async (toolName, input) => {
      const d =
        toolName === 'SandboxNetworkAccess'
          ? gate.network(String(input.host ?? ''))
          : spec.files(toolName, input as Record<string, unknown>)
      return d.allow
        ? { behavior: 'allow', updatedInput: input }
        : { behavior: 'deny', message: d.reason ?? `${toolName} is not one of Alpha's tools.` }
    }
    return {
      model: config.models().desk,
      cwd: deskDir,
      env,
      settingSources: [],
      strictMcpConfig: true,
      tools: OWN_TOOLS,
      allowedTools: [...registry.names(), ...OUTRIGHT],
      permissionMode: 'default',
      canUseTool,
      mcpServers: registry.servers(),
      additionalDirectories: [modules, ...granted],
      sandbox: {
        enabled: true,
        failIfUnavailable: true,
        autoAllowBashIfSandboxed: true,
        allowUnsandboxedCommands: false,
        filesystem: {
          denyRead: home ? [home] : [],
          allowRead: [deskDir, modules, ...granted],
          denyWrite: granted,
        },
        network: {},
      },
      includePartialMessages: true,
      systemPrompt:
        spec.prompt === 'alone'
          ? { type: 'custom', prompt: config.systemPrompt(spec.userName), snapshot: false }
          : {
              type: 'preset',
              preset: 'claude_code',
              append: config.systemPrompt(spec.userName),
              snapshot: false,
            },
      hooks: {
        PreToolUse: [{ hooks: [beforeCall] }],
        PostToolUse: [{ hooks: [afterCall] }],
        PostToolUseFailure: [{ hooks: [afterCall] }],
        UserPromptSubmit: [{ hooks: [onMessage] }],
        SessionStart: [{ hooks: [onSessionStart] }],
      },
      ...(spec.resume ? { resume: spec.resume } : {}),
    }
  }
}

// The SDK's messages as the desk hears them.
async function* translate(q: Query): AsyncIterable<SessionEvent> {
  while (true) {
    const step = await q.next()
    if (step.done) return
    const m = step.value as SDKMessage
    if (m.type === 'system' && m.subtype === 'init') {
      yield { type: 'init', sessionId: m.session_id }
      continue
    }
    if (m.type === 'rate_limit_event') {
      if (m.rate_limit_info.status === 'rejected')
        yield {
          type: 'limit',
          resetsAt: m.rate_limit_info.resetsAt ? new Date(m.rate_limit_info.resetsAt * 1000) : null,
          info: m.rate_limit_info,
        }
      continue
    }
    if (m.type === 'system' && m.subtype === 'task_notification') {
      yield { type: 'task', summary: m.summary }
      continue
    }
    if (m.type === 'assistant') {
      yield { type: 'assistant', sub: !!m.parent_tool_use_id }
      continue
    }
    if (m.type === 'stream_event') {
      const ev = m.event
      const sub = !!m.parent_tool_use_id
      if (ev.type === 'content_block_delta' && ev.delta.type === 'text_delta')
        yield { type: 'text', delta: ev.delta.text, sub }
      else if (ev.type === 'message_start') yield { type: 'break', sub }
      else yield { type: 'assistant', sub } // any other piece of a message: the turn is live
      continue
    }
    if (m.type === 'result') {
      yield {
        type: 'result',
        ok: m.subtype === 'success',
        text: m.subtype === 'success' ? m.result.trim() : '',
        stopped: m.terminal_reason === 'aborted_tools' || m.terminal_reason === 'aborted_streaming',
        data: {
          ms: m.duration_ms,
          turns: m.num_turns,
          cost: m.total_cost_usd,
          usage: m.modelUsage,
          terminal: m.terminal_reason ?? null,
          ...(m.subtype !== 'success' ? { errors: m.errors } : {}),
        },
      }
    }
  }
}

function isErrorResponse(input: { tool_response?: unknown }): boolean {
  const r = input.tool_response as { isError?: boolean; is_error?: boolean } | undefined
  return !!(r && (r.isError || r.is_error))
}

function errorText(input: unknown): string {
  const i = input as { error?: string; tool_response?: { content?: { text?: string }[] } }
  return i.error ?? i.tool_response?.content?.map((c) => c.text ?? '').join(' ') ?? ''
}
