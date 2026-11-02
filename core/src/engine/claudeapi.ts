// The ClaudeApi provider (decision 11): the Messages API with the firm's key, through Anthropic's
// SDK, driving Alpha's own loop. The gates are Alpha's code here as on every route. It has the
// world's tools and the connectors; no shell, no files beyond the world, no web search and no
// subagents, and it says so.
import Anthropic from '@anthropic-ai/sdk'
import { config } from '../config.ts'
import { Refused } from '../world/kinds.ts'
import { usesOfTokens } from '../world/spend.ts'
import type { World } from '../world/world.ts'
import { apiShape, fromApi } from './apishape.ts'
import { type Chat, type ChatRequest, Limited, OwnLoop, toolsOfEntries } from './loop.ts'
import type { Capabilities, Provider, Session, SessionSpec } from './provider.ts'
import { fullName, type ToolEntry } from './registry.ts'

export interface ClaudeApiOptions {
  key: () => string | null // the key as kept in the Keychain, read when a request is made
  chat?: Chat // a scripted model in tests
  fetch?: typeof fetch // a made-up API in tests: never the real one
  userId: string
}

// One round's request: the model, the system prompt, every tool and the conversation, with the
// API asked to cache what repeats from one round to the next (step 3, part 1: without it a round
// sends everything in full).
export function requestOf(req: ChatRequest): Anthropic.MessageStreamParams {
  return {
    model: config.models().desk,
    max_tokens: 64_000,
    cache_control: { type: 'ephemeral' },
    system: req.system,
    messages: req.messages,
    tools: req.tools,
  }
}

export class ClaudeApiProvider implements Provider {
  readonly name = 'Claude by key'
  readonly route = 'key' as const
  readonly can: Capabilities = {
    shell: false,
    files: false,
    web: false,
    subagents: false,
    structured: true,
  }
  private world: World
  private options: ClaudeApiOptions

  constructor(world: World, options: ClaudeApiOptions) {
    this.world = world
    this.options = options
  }

  private client(): Anthropic {
    const key = this.options.key()
    if (!key) throw new Refused('No API key is kept: give one in Settings › Model.')
    return new Anthropic({
      apiKey: key,
      ...(this.options.fetch ? { fetch: this.options.fetch } : {}),
    })
  }

  explore(
    system: string,
    prompt: string,
    tools: ToolEntry[],
    schema: Record<string, unknown>,
    turns: number,
  ) {
    return exploreApi(
      this.options.chat ?? this.chat(),
      config.models().desk,
      system,
      prompt,
      tools,
      schema,
      turns,
    )
  }

  session(spec: SessionSpec): Session {
    return new OwnLoop(this.world, this.options.userId, spec, this.options.chat ?? this.chat())
  }

  // The model, streamed, with every tool's schema; a closed usage window comes back as Limited.
  private chat(): Chat {
    return async (req) => {
      const client = this.client()
      try {
        const stream = client.messages.stream(requestOf(req), { signal: req.signal })
        stream.on('text', req.onText)
        const m = await stream.finalMessage()
        return {
          content: m.content,
          stopReason: m.stop_reason,
          usage: { ...m.usage },
        }
      } catch (err) {
        if (err instanceof Anthropic.RateLimitError) {
          const after = Number(err.headers?.get?.('retry-after') ?? '')
          throw new Limited(
            'The usage limit for this key is reached for now.',
            Number.isFinite(after) && after > 0 ? new Date(Date.now() + after * 1000) : null,
          )
        }
        if (err instanceof Anthropic.AuthenticationError)
          throw new Refused('The API key was not accepted: check it in Settings › Model.')
        throw err
      }
    }
  }

  // One question answered in a shape: as a strict answer, which the API holds to the shape; a
  // shape too large for that (a reader's dozens of fields: "the compiled grammar is too large")
  // is asked again as a tool the model calls once, which the API does not compile (step 3, part 1).
  async ask(system: string, prompt: string, schema: Record<string, unknown>) {
    const client = this.client()
    const model = config.models().desk
    try {
      const m = await client.messages.create({
        model,
        max_tokens: 16_000,
        system,
        messages: [{ role: 'user', content: prompt }],
        output_config: {
          format: { type: 'json_schema', schema: apiShape(schema) as Record<string, unknown> },
        },
      })
      const text = m.content
        .filter((b): b is Anthropic.TextBlock => b.type === 'text')
        .map((b) => b.text)
        .join('')
      let answer: unknown
      try {
        answer = fromApi(schema, JSON.parse(text))
      } catch {
        throw new Refused('The model gave no answer in the shape asked.')
      }
      return { answer, tokens: tokensOf(m.usage), uses: usesOfTokens(model, m.usage) }
    } catch (err) {
      if (!(err instanceof Anthropic.BadRequestError) || !TOO_LARGE.test(err.message)) throw err
    }
    const m = await client.messages.create({
      model,
      max_tokens: 16_000,
      system: `${system}\n\nGive your answer by calling the answer tool once, and say nothing else.`,
      messages: [{ role: 'user', content: prompt }],
      tools: [
        {
          name: 'answer',
          description: 'Your answer, in the shape asked.',
          input_schema: schema as Anthropic.Tool.InputSchema,
        },
      ],
      tool_choice: { type: 'auto' },
    })
    const call = m.content.find(
      (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use' && b.name === 'answer',
    )
    if (!call) throw new Refused('The model gave no answer in the shape asked.')
    return { answer: call.input, tokens: tokensOf(m.usage), uses: usesOfTokens(model, m.usage) }
  }
}

// A question worked out with a plugin's read-only tools (onboarding B), on Alpha's own loop: each
// round the model calls tools or the answer tool; the tools run here and their answers go back, until
// it answers, within the turns given.
export async function exploreApi(
  chat: Chat,
  model: string,
  system: string,
  prompt: string,
  tools: ToolEntry[],
  schema: Record<string, unknown>,
  turns: number,
): Promise<{ answer: unknown; tokens: number; uses: ReturnType<typeof usesOfTokens> }> {
  const byName = new Map(tools.map((t) => [fullName(t.server, t.name), t]))
  const all: Anthropic.Tool[] = [
    ...toolsOfEntries(tools),
    {
      name: 'answer',
      description: 'Your answer, in the shape asked, once you have looked enough.',
      input_schema: schema as Anthropic.Tool.InputSchema,
    },
  ]
  const messages: Anthropic.MessageParam[] = [{ role: 'user', content: prompt }]
  const uses: ReturnType<typeof usesOfTokens> = []
  let tokens = 0
  for (let turn = 0; turn < turns; turn++) {
    const a = await chat({
      system: `${system}\n\nWhen you have looked enough, give your answer by calling the answer tool once.`,
      messages,
      tools: all,
      signal: new AbortController().signal,
      onText: () => undefined,
    })
    uses.push(...usesOfTokens(model, a.usage))
    tokens += tokensOf(a.usage as unknown as Anthropic.Usage)
    messages.push({ role: 'assistant', content: a.content as Anthropic.ContentBlockParam[] })
    const calls = a.content.filter((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use')
    const answer = calls.find((c) => c.name === 'answer')
    if (answer) return { answer: answer.input, tokens, uses }
    if (!calls.length) {
      messages.push({ role: 'user', content: 'Give your answer by calling the answer tool.' })
      continue
    }
    const results: Anthropic.ToolResultBlockParam[] = []
    for (const c of calls) {
      const t = byName.get(c.name)
      const out = t
        ? await t.handler(c.input as Record<string, unknown>)
        : {
            content: [{ type: 'text' as const, text: `There is no tool called ${c.name}.` }],
            isError: true,
          }
      results.push({
        type: 'tool_result',
        tool_use_id: c.id,
        content: out.content.map((x) => (x.type === 'text' ? x.text : '')).join('\n'),
        ...(out.isError ? { is_error: true } : {}),
      })
    }
    messages.push({ role: 'user', content: results })
  }
  throw new Refused('The model did not settle on an answer in the turns it had.')
}

// What the API says when an answer shape is beyond its strict answers' limits.
const TOO_LARGE = /grammar|too complex|union types|optional parameters/i

const tokensOf = (u: Anthropic.Usage) =>
  (u.input_tokens ?? 0) +
  (u.output_tokens ?? 0) +
  (u.cache_read_input_tokens ?? 0) +
  (u.cache_creation_input_tokens ?? 0)
