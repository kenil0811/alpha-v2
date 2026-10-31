// The ClaudeApi provider (decision 11): the Messages API with the firm's key, through Anthropic's
// SDK, driving Alpha's own loop. The gates are Alpha's code here as on every route. It has the
// world's tools and the connectors; no shell, no files beyond the world, no web search and no
// subagents, and it says so.
import Anthropic from '@anthropic-ai/sdk'
import { config } from '../config.ts'
import { Refused } from '../world/kinds.ts'
import { usesOfTokens } from '../world/spend.ts'
import type { World } from '../world/world.ts'
import { type Chat, type ChatRequest, Limited, OwnLoop } from './loop.ts'
import type { Capabilities, Provider, Session, SessionSpec } from './provider.ts'

export interface ClaudeApiOptions {
  key: () => string | null // the key as kept in the Keychain, read when a request is made
  chat?: Chat // a scripted model in tests
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
    return new Anthropic({ apiKey: key })
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

  async ask(system: string, prompt: string, schema: Record<string, unknown>) {
    const client = this.client()
    const m = await client.messages.create({
      model: config.models().desk,
      max_tokens: 16_000,
      system,
      messages: [{ role: 'user', content: prompt }],
      output_config: { format: { type: 'json_schema', schema } },
    })
    const text = m.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('')
    const tokens =
      (m.usage.input_tokens ?? 0) +
      (m.usage.output_tokens ?? 0) +
      (m.usage.cache_read_input_tokens ?? 0) +
      (m.usage.cache_creation_input_tokens ?? 0)
    try {
      return {
        answer: JSON.parse(text) as unknown,
        tokens,
        uses: usesOfTokens(config.models().desk, m.usage),
      }
    } catch {
      throw new Refused('The model gave no answer in the shape asked.')
    }
  }
}
