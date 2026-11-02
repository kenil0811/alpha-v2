// The model asked one question with no tools, answered in a schema (the document reader's
// judgement point, judging): through the Agent SDK with the route's own sign-in, as the desk. And
// a question it works out with a plugin's few read-only tools first (exploreOnce, onboarding B):
// those tools only, no shell, no files, no web, for a bounded number of turns.
import { realpathSync } from 'node:fs'
import { type Options, query, type SDKMessage } from '@anthropic-ai/claude-agent-sdk'
import { config } from '../config.ts'
import type { Ask } from '../files/reading.ts'
import { Refused } from '../world/kinds.ts'
import { type Use, usesOfModelUsage } from '../world/spend.ts'
import { fullName, Registry, type ToolEntry } from './registry.ts'

export function askModel(
  cwd: string,
  route: () => Record<string, string> = () => ({}),
  system: () => string = () => config.reading(),
): Ask {
  return (prompt, schema) => askOnce(cwd, route(), system(), prompt, schema)
}

export async function askOnce(
  cwd: string,
  env: Record<string, string>,
  system: string,
  prompt: string,
  schema: Record<string, unknown>,
): Promise<{ answer: unknown; tokens: number; uses: Use[] }> {
  return answerOf(prompt, optionsOf(cwd, env, system, schema))
}

export async function exploreOnce(
  cwd: string,
  env: Record<string, string>,
  system: string,
  prompt: string,
  tools: ToolEntry[],
  schema: Record<string, unknown>,
  turns: number,
): Promise<{ answer: unknown; tokens: number; uses: Use[] }> {
  const allowed = new Set(tools.map((t) => fullName(t.server, t.name)))
  const base = optionsOf(cwd, env, system, schema)
  return answerOf(prompt, {
    ...base,
    env: {
      ...base.env,
      MAX_MCP_OUTPUT_TOKENS: String(config.limits().explore_look_tokens),
    },
    mcpServers: new Registry(tools, {
      alwaysLoad: [...new Set(tools.map((t) => t.server))],
    }).servers(),
    allowedTools: [...allowed],
    maxTurns: turns,
    canUseTool: async (name, input) =>
      allowed.has(name)
        ? { behavior: 'allow', updatedInput: input }
        : { behavior: 'deny', message: 'Only the tools given for this question.' },
  })
}

function optionsOf(
  cwd: string,
  env: Record<string, string>,
  system: string,
  schema: Record<string, unknown>,
): Options {
  return {
    model: config.models().desk,
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

async function answerOf(
  prompt: string,
  options: Options,
): Promise<{ answer: unknown; tokens: number; uses: Use[] }> {
  let answer: unknown = null
  let tokens = 0
  let uses: Use[] = []
  let failed: string | null = null
  for await (const m of query({ prompt, options }) as AsyncIterable<SDKMessage>) {
    if (m.type !== 'result') continue
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
