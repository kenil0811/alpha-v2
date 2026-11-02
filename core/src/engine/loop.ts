// Alpha's own loop (decision 11): a desk session that sends the context, the tools' schemas and
// the person's words to a model, streams the text back, runs each tool call through the gate
// adapter and the registry, and keeps the session's messages in the world. The model behind it
// is one `chat` call: Anthropic's SDK on the key route, another client later, a script in tests.
// It has the world's tools and the connectors, no shell, no files beyond the world, no web and
// no subagents; a provider says so, and the prompt follows.
import type Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'
import { config } from '../config.ts'
import type { World } from '../world/world.ts'
import type { Session, SessionEvent, SessionSpec } from './provider.ts'
import { fullName, type ToolEntry } from './registry.ts'

// One request to the model: the whole conversation, answered as it streams.
export interface ChatRequest {
  system: string
  messages: Anthropic.MessageParam[]
  tools: Anthropic.Tool[]
  signal: AbortSignal
  onText: (delta: string) => void
}

export interface ChatAnswer {
  content: Anthropic.ContentBlock[]
  stopReason: string | null
  usage: Record<string, unknown>
}

export type Chat = (request: ChatRequest) => Promise<ChatAnswer>

// A rate limit the model's side gave, with when it opens again.
export class Limited extends Error {
  readonly resetsAt: Date | null
  constructor(words: string, resetsAt: Date | null) {
    super(words)
    this.resetsAt = resetsAt
  }
}

// The tools as the API takes them, from the registry's entries.
export function toolsOf(spec: SessionSpec): Anthropic.Tool[] {
  return toolsOfEntries(spec.registry.all())
}

export function toolsOfEntries(entries: ToolEntry[]): Anthropic.Tool[] {
  return entries.map((e) => {
    const schema = z.toJSONSchema(z.object(e.input), { io: 'input' }) as Record<string, unknown>
    const { $schema: _dropped, ...rest } = schema
    return {
      name: fullName(e.server, e.name),
      description: e.description,
      input_schema: { ...rest, type: 'object' as const },
    }
  })
}

class Box<T> implements AsyncIterable<T> {
  private queue: T[] = []
  private wake: (() => void) | null = null
  private closed = false
  push(item: T) {
    this.queue.push(item)
    this.wake?.()
  }
  close() {
    this.closed = true
    this.wake?.()
  }
  async *[Symbol.asyncIterator]() {
    while (true) {
      while (this.queue.length) yield this.queue.shift() as T
      if (this.closed) return
      await new Promise<void>((r) => {
        this.wake = r
      })
      this.wake = null
    }
  }
}

export class OwnLoop implements Session {
  private world: World
  private userId: string
  private spec: SessionSpec
  private chat: Chat
  private out = new Box<SessionEvent>()
  private inbox = new Box<string>()
  private messages: Anthropic.MessageParam[]
  private aborter: AbortController | null = null
  private closed = false

  constructor(world: World, userId: string, spec: SessionSpec, chat: Chat) {
    this.world = world
    this.userId = userId
    this.spec = spec
    this.chat = chat
    // resumed: the kept messages come back; fresh: they start again
    if (spec.resume) this.messages = world.messages(userId) as Anthropic.MessageParam[]
    else {
      world.clearMessages(userId)
      this.messages = []
    }
    this.out.push({ type: 'init', sessionId: `own:${userId}` })
    void this.run()
  }

  send(text: string): void {
    this.inbox.push(text)
  }

  async interrupt(): Promise<void> {
    this.aborter?.abort()
  }

  close(): void {
    this.closed = true
    this.inbox.close()
    this.aborter?.abort()
    this.out.close()
  }

  events(): AsyncIterable<SessionEvent> {
    return this.out
  }

  private keep(m: Anthropic.MessageParam): void {
    this.messages.push(m)
    if (m.role === 'user' || m.role === 'assistant')
      this.world.keepMessage(this.userId, m.role, m.content)
  }

  private async run(): Promise<void> {
    for await (const text of this.inbox) {
      if (this.closed) return
      await this.turn(text)
    }
  }

  // One of the person's messages, answered: the layers go in beside their words, as the route's
  // own hook would put them; then rounds of tool calls until the model ends its turn.
  private async turn(text: string): Promise<void> {
    const started = Date.now()
    const layers = [
      this.spec.context.takeFresh() ? this.spec.context.start() : '',
      this.spec.context.turn(),
    ]
      .filter(Boolean)
      .join('\n\n')
    this.keep({
      role: 'user',
      content: layers
        ? [
            { type: 'text', text },
            { type: 'text', text: `<context>\n${layers}\n</context>` },
          ]
        : text,
    })
    const aborter = new AbortController()
    this.aborter = aborter
    const system = config.systemPrompt(this.spec.userName)
    const tools = toolsOf(this.spec)
    const usage: Record<string, number> = {}
    let rounds = 0
    let first = true
    const finish = (
      ok: boolean,
      text: string,
      stopped: boolean,
      more: Record<string, unknown> = {},
    ) =>
      this.out.push({
        type: 'result',
        ok,
        text,
        stopped,
        data: { ms: Date.now() - started, turns: rounds, usage, ...more },
      })
    try {
      while (true) {
        if (rounds >= config.limits().loop_rounds_per_turn) {
          finish(false, '', false, { errors: ['The model kept calling tools without finishing.'] })
          return
        }
        rounds += 1
        if (!first) this.out.push({ type: 'break', sub: false })
        first = false
        this.out.push({ type: 'assistant', sub: false })
        const answer = await this.chat({
          system,
          messages: [...this.messages],
          tools,
          signal: aborter.signal,
          onText: (delta) => this.out.push({ type: 'text', delta, sub: false }),
        })
        for (const [k, v] of Object.entries(answer.usage))
          if (typeof v === 'number') usage[k] = (usage[k] ?? 0) + v
        this.keep({ role: 'assistant', content: answer.content })
        const calls = answer.content.filter(
          (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
        )
        if (answer.stopReason === 'refusal') {
          finish(false, '', false, { errors: ['The model declined to answer.'] })
          return
        }
        if (answer.stopReason !== 'tool_use' || !calls.length) {
          const text = answer.content
            .filter((b): b is Anthropic.TextBlock => b.type === 'text')
            .map((b) => b.text)
            .join('')
            .trim()
          finish(true, text, false, { terminal: answer.stopReason })
          return
        }
        const results: Anthropic.ToolResultBlockParam[] = []
        for (const call of calls) {
          if (aborter.signal.aborted) break
          results.push(await this.call(call))
        }
        if (aborter.signal.aborted) {
          // what was started is answered, so the kept conversation stays whole
          for (const call of calls.slice(results.length))
            results.push({
              type: 'tool_result',
              tool_use_id: call.id,
              is_error: true,
              content: 'Stopped by the person.',
            })
          this.keep({ role: 'user', content: results })
          finish(true, '', true)
          return
        }
        this.keep({ role: 'user', content: results })
      }
    } catch (err) {
      if (aborter.signal.aborted) {
        finish(true, '', true)
        return
      }
      if (err instanceof Limited) {
        this.out.push({ type: 'limit', resetsAt: err.resetsAt, info: { words: err.message } })
        finish(false, '', false, { errors: [err.message] })
        return
      }
      finish(false, '', false, { errors: [err instanceof Error ? err.message : String(err)] })
    } finally {
      this.aborter = null
    }
  }

  // One tool call: the gate first (a card, or a refusal in words), then the registry's handler;
  // the result goes back to the model as the tool's own answer.
  private async call(call: Anthropic.ToolUseBlock): Promise<Anthropic.ToolResultBlockParam> {
    const input = (call.input ?? {}) as Record<string, unknown>
    // a tool Alpha has not got is said so before the gates, as Claude Code does (step 3, part 1)
    if (!this.spec.registry.find(call.name))
      return {
        type: 'tool_result',
        tool_use_id: call.id,
        is_error: true,
        content: `There is no tool called ${call.name}.`,
      }
    const d = await this.spec.gate.before(call.name, input, { callId: call.id, subagent: null })
    if (!d.allow) {
      await this.spec.gate.after({ callId: call.id, ok: false, error: d.reason ?? 'refused' })
      return {
        type: 'tool_result',
        tool_use_id: call.id,
        is_error: true,
        content: d.reason ?? 'Refused.',
      }
    }
    const started = Date.now()
    const out = await this.spec.registry.call(call.name, input)
    await this.spec.gate.after({
      callId: call.id,
      ok: !out.isError,
      ms: Date.now() - started,
      ...(out.isError
        ? { error: out.content.map((c) => (c.type === 'text' ? c.text : '')).join(' ') }
        : { result: out }),
    })
    return {
      type: 'tool_result',
      tool_use_id: call.id,
      ...(out.isError ? { is_error: true } : {}),
      content: out.content.map((c) =>
        c.type === 'text'
          ? { type: 'text' as const, text: c.text }
          : {
              type: 'image' as const,
              source: {
                type: 'base64' as const,
                media_type: c.mimeType as 'image/png',
                data: c.data,
              },
            },
      ),
    }
  }
}
