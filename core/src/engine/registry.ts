// The tool registry (decision 11): every tool the model can call, the world's and each
// connector's, as one entry: its server, name, description, input shape, and the handler that
// runs it. The Agent SDK's servers are built from the entries, and Alpha's own loop calls the
// handlers directly, so a tool is defined once whatever route runs it.
import { createSdkMcpServer, tool as sdkTool } from '@anthropic-ai/claude-agent-sdk'
import type { z } from 'zod'

export type ToolResult = {
  content: ({ type: 'text'; text: string } | { type: 'image'; data: string; mimeType: string })[]
  isError?: boolean
}

export interface ToolEntry {
  server: string // alpha, or a connector's name: the model sees mcp__<server>__<name>
  name: string
  description: string
  input: z.ZodRawShape
  alwaysLoad?: boolean // in the model's hands from the start, not found through tool search
  handler: (input: Record<string, unknown>) => Promise<ToolResult>
}

export function fullName(server: string, name: string): string {
  return `mcp__${server}__${name}`
}

// One entry, typed by its input shape where it is written.
export function entry<S extends z.ZodRawShape>(
  server: string,
  name: string,
  description: string,
  input: S,
  handler: (input: z.infer<z.ZodObject<S>>) => Promise<ToolResult>,
  extras: { alwaysLoad?: boolean } = {},
): ToolEntry {
  return {
    server,
    name,
    description,
    input,
    handler: handler as ToolEntry['handler'],
    ...(extras.alwaysLoad ? { alwaysLoad: true } : {}),
  }
}

export class Registry {
  private readonly entries: ToolEntry[]
  private readonly byName = new Map<string, ToolEntry>()
  private readonly loadWhole: Set<string>

  // alwaysLoad: the servers whose every tool is in the model's hands from the start (Alpha's own).
  constructor(entries: ToolEntry[], options: { alwaysLoad?: string[] } = {}) {
    this.entries = entries
    this.loadWhole = new Set(options.alwaysLoad ?? [])
    for (const e of entries) {
      const name = fullName(e.server, e.name)
      if (this.byName.has(name)) throw new Error(`Two tools are called ${name}.`)
      this.byName.set(name, e)
    }
  }

  find(name: string): ToolEntry | undefined {
    return this.byName.get(name)
  }

  // Every tool's model-facing name, in order.
  names(): string[] {
    return [...this.byName.keys()].sort()
  }

  // The entries of one server, for a provider that sends their schemas itself.
  all(): ToolEntry[] {
    return this.entries
  }

  // A tool run by name, as Alpha's own loop runs one: the gate is before it, not here.
  async call(name: string, input: Record<string, unknown>): Promise<ToolResult> {
    const e = this.byName.get(name)
    if (!e)
      return {
        content: [{ type: 'text', text: `There is no tool called ${name}.` }],
        isError: true,
      }
    return e.handler(input)
  }

  // The Agent SDK's in-process servers, one per server name, from the same entries.
  servers(): Record<string, ReturnType<typeof createSdkMcpServer>> {
    const groups = new Map<string, ToolEntry[]>()
    for (const e of this.entries) groups.set(e.server, [...(groups.get(e.server) ?? []), e])
    const out: Record<string, ReturnType<typeof createSdkMcpServer>> = {}
    for (const [server, entries] of groups)
      out[server] = createSdkMcpServer({
        name: server,
        version: '0.1.0',
        ...(this.loadWhole.has(server) ? { alwaysLoad: true } : {}),
        tools: entries.map((e) =>
          sdkTool(
            e.name,
            e.description,
            e.input,
            (input) => e.handler(input as Record<string, unknown>),
            e.alwaysLoad ? { alwaysLoad: true } : {},
          ),
        ),
      })
    return out
  }
}
