// The model asked one question with no tools, answered in a schema (the document reader's
// judgement point, judging): through the Agent SDK with the route's own sign-in, as the desk, on
// the model models.yaml names for that use.
import { realpathSync } from 'node:fs'
import { type Options, query, type SDKMessage } from '@anthropic-ai/claude-agent-sdk'
import { config } from '../config.ts'
import type { Ask } from '../files/reading.ts'
import { Refused } from '../world/kinds.ts'
import { type Use, usesOfModelUsage } from '../world/spend.ts'
import { refusedWords } from './route.ts'

export function askModel(cwd: string, use: 'reading' | 'judging' = 'reading'): Ask {
  return (prompt, schema) =>
    askOnce(cwd, {}, config[use](), prompt, schema, config.models().asks[use])
}

export async function askOnce(
  cwd: string,
  env: Record<string, string>,
  system: string,
  prompt: string,
  schema: Record<string, unknown>,
  model: string,
): Promise<{ answer: unknown; tokens: number; uses: Use[] }> {
  return answerOf(prompt, optionsOf(cwd, env, system, schema, model))
}

export function optionsOf(
  cwd: string,
  env: Record<string, string>,
  system: string,
  schema: Record<string, unknown>,
  model: string,
): Options {
  return {
    model,
    cwd: realpathSync(cwd),
    env: {
      HOME: process.env.HOME ?? '',
      USER: process.env.USER ?? '',
      PATH: process.env.PATH ?? '/usr/bin:/bin:/usr/sbin:/sbin',
      LANG: process.env.LANG ?? 'en_US.UTF-8',
      TMPDIR: process.env.TMPDIR ?? '/tmp',
      ENABLE_CLAUDEAI_MCP_SERVERS: 'false',
      CLAUDE_AGENT_SDK_CLIENT_APP: 'alpha/0.1.0',
      DISABLE_AUTOUPDATER: '1',
      ...env,
    },
    settingSources: [],
    strictMcpConfig: true,
    mcpServers: {},
    tools: [],
    permissionMode: 'default',
    canUseTool: async () => ({ behavior: 'deny', message: 'Reading a document uses no tools.' }),
    systemPrompt: { type: 'custom', prompt: system, snapshot: false },
    outputFormat: { type: 'json_schema', schema },
    persistSession: false,
  }
}

// Whether Claude answers with a subscription's token, before Set up Alpha keeps it: none when it
// did, else the words why not.
export async function answersWith(cwd: string, token: string): Promise<string | null> {
  const schema = {
    type: 'object',
    properties: { reached: { type: 'boolean' } },
    required: ['reached'],
  }
  try {
    await askOnce(
      cwd,
      { CLAUDE_CODE_OAUTH_TOKEN: token },
      config.checking(),
      'Can you hear me?',
      schema,
      config.models().asks.checking,
    )
    return null
  } catch (err) {
    return err instanceof Error ? err.message : String(err)
  }
}

async function answerOf(
  prompt: string,
  options: Options,
): Promise<{ answer: unknown; tokens: number; uses: Use[] }> {
  let answer: unknown = null
  let tokens = 0
  let uses: Use[] = []
  let failed: string | null = null
  let refused: string | null = null // Claude refusing this install, as Claude Code names it
  for await (const m of query({ prompt, options }) as AsyncIterable<SDKMessage>) {
    if (m.type === 'assistant' && m.error) refused = m.error
    if (m.type !== 'result') continue
    const cannot = m.is_error && refused ? refusedWords(refused, options.env ?? {}) : null
    if (cannot) throw new Refused(cannot)
    tokens =
      (m.usage.input_tokens ?? 0) +
      (m.usage.output_tokens ?? 0) +
      (m.usage.cache_read_input_tokens ?? 0) +
      (m.usage.cache_creation_input_tokens ?? 0)
    uses = usesOfModelUsage(m.modelUsage)
    if (m.subtype === 'success') answer = m.structured_output ?? null
    else failed = m.subtype
  }
  if (answer === null)
    throw new Refused(
      `The model gave no answer in the shape asked${failed ? ` (${failed.replace(/_/g, ' ')})` : ''}.`,
    )
  return { answer, tokens, uses }
}
