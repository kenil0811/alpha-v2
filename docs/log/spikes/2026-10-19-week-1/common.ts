// Shared by the week 1 spikes: a scratch home per run, a bare environment, Alpha's options, and
// a printer that keeps one short line per message.
import type { Options, Query, SDKMessage, SDKUserMessage } from '@anthropic-ai/claude-agent-sdk'
import { mkdirSync, realpathSync } from 'node:fs'
import { join } from 'node:path'

export const MODEL = process.env.SPIKE_MODEL ?? 'haiku'
const ROOT = join(import.meta.dirname, 'homes')

export function home(name: string): string {
  const dir = join(ROOT, `${name}-${Date.now()}`)
  mkdirSync(dir, { recursive: true })
  return realpathSync(dir)
}

// Only what Claude Code needs from the Mac: no key, no config dir, no Homebrew.
export const bareEnv: Record<string, string> = {
  HOME: process.env.HOME ?? '',
  USER: process.env.USER ?? 'kenil',
  PATH: '/usr/bin:/bin:/usr/sbin:/sbin',
  ...(process.env.SPIKE_ENV ? JSON.parse(process.env.SPIKE_ENV) : {}),
}

export const OWN_TOOLS = ['Bash', 'Read', 'Write', 'Edit', 'Glob', 'Grep', 'WebSearch', 'WebFetch', 'Agent']

export function base(cwd: string, more: Partial<Options> = {}): Options {
  return {
    model: MODEL,
    cwd,
    env: bareEnv,
    settingSources: [],
    strictMcpConfig: true,
    tools: OWN_TOOLS,
    systemPrompt: { type: 'preset', preset: 'claude_code', append: 'You are Alpha in a spike.' },
    ...more,
  }
}

export function t0(): () => string {
  const start = Date.now()
  return () => `${((Date.now() - start) / 1000).toFixed(1)}s`
}

export function line(m: SDKMessage): string | null {
  switch (m.type) {
    case 'system':
      if (m.subtype === 'init') return `init model=${m.model} apiKeySource=${m.apiKeySource}`
      if (m.subtype === 'task_notification')
        return `task_notification ${m.status} summary=${JSON.stringify(m.summary).slice(0, 160)}`
      return `system ${m.subtype}`
    case 'assistant': {
      const parts = m.message.content.map((b) =>
        b.type === 'text'
          ? `text:${JSON.stringify(b.text).slice(0, 200)}`
          : b.type === 'tool_use'
            ? `tool_use:${b.name}(${JSON.stringify(b.input).slice(0, 160)})`
            : b.type,
      )
      return `assistant ${parts.join(' | ')}`
    }
    case 'user': {
      const c = m.message.content
      if (typeof c === 'string') return `user ${JSON.stringify(c).slice(0, 120)}`
      return `user ${c
        .map((b) =>
          b.type === 'tool_result'
            ? `tool_result${b.is_error ? '[err]' : ''}:${JSON.stringify(b.content).slice(0, 200)}`
            : b.type,
        )
        .join(' | ')}`
    }
    case 'result':
      return `result ${m.subtype} terminal=${m.terminal_reason} stop=${m.stop_reason} turns=${m.num_turns} in=${m.usage.input_tokens}+${m.usage.cache_read_input_tokens}c+${m.usage.cache_creation_input_tokens}w out=${m.usage.output_tokens} cost=${m.total_cost_usd.toFixed(4)} deferred=${JSON.stringify(m.deferred_tool_use ?? null)} text=${JSON.stringify('result' in m ? m.result : '').slice(0, 200)}`
    case 'rate_limit_event':
      return `rate_limit ${JSON.stringify(m.rate_limit_info)}`
    case 'stream_event':
      return null
    default:
      return m.type
  }
}

// Read a query to its first result (or to its end), printing as it goes.
export async function drain(q: Query, tag: string, until: 'result' | 'end' = 'result') {
  const at = t0()
  let result: Extract<SDKMessage, { type: 'result' }> | null = null
  let init: Extract<SDKMessage, { type: 'system'; subtype: 'init' }> | null = null
  // next() by hand: a `break` out of for-await would close the query, and the session with it
  while (true) {
    const step = await q.next()
    if (step.done) break
    const m = step.value
    const l = line(m)
    if (l) console.log(`[${tag} ${at()}] ${l}`)
    if (m.type === 'system' && m.subtype === 'init') init = m
    if (m.type === 'result') {
      result = m
      if (until === 'result') break
    }
  }
  return { result, init }
}

// A message box: push sentences into a long-lived session.
export function inbox() {
  const queue: SDKUserMessage[] = []
  let wake: (() => void) | null = null
  let closed = false
  return {
    push(text: string) {
      queue.push({ type: 'user', message: { role: 'user', content: text }, parent_tool_use_id: null })
      wake?.()
    },
    close() {
      closed = true
      wake?.()
    },
    async *[Symbol.asyncIterator](): AsyncGenerator<SDKUserMessage> {
      while (true) {
        while (queue.length) yield queue.shift() as SDKUserMessage
        if (closed) return
        await new Promise<void>((r) => {
          wake = r
        })
        wake = null
      }
    },
  }
}
