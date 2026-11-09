// The model as a provider (decision 11): one interface the desk, the document reader and judging
// speak to, whatever reaches the model behind it. A provider says its route and what it can do,
// and gives a desk session (words in, text and tool calls out as they stream, interrupt, resume)
// and `ask` (one question answered in a schema). The gates are Alpha's code on every route: a
// session runs each tool call through the Gatekeeper before the registry's handler.

import type { Use } from '../world/spend.ts'
import type { Gatekeeper } from './gate.ts'
import type { Registry, ToolEntry } from './registry.ts'

export type Route = 'subscription' | 'key'

// What a route can do; the prompt leaves out what it cannot (decision 11).
export interface Capabilities {
  shell: boolean // a sandboxed shell on this Mac
  files: boolean // files beyond the world: the desk folder and the modules
  web: boolean // web search and fetch of its own
  subagents: boolean // background work that reports back
  structured: boolean // an answer in a schema
}

export type SessionEvent =
  | { type: 'init'; sessionId: string } // the session is up, kept under this id for resuming
  | { type: 'text'; delta: string; sub: boolean } // the reply as it streams; sub: a subagent's
  | { type: 'break'; sub: boolean } // a new message of the model starts
  | { type: 'assistant'; sub: boolean } // a whole message of the model arrived
  | { type: 'task'; summary: string } // background work finished
  | { type: 'limit'; resetsAt: Date | null; info: unknown } // the route's usage window is closed
  | {
      type: 'result'
      ok: boolean
      text: string
      stopped: boolean // interrupted, not finished
      data: Record<string, unknown> // what the journal keeps: time, turns, cost, usage, errors
    }

export interface Session {
  send(text: string): void
  interrupt(): Promise<void>
  setModel?(model: string): Promise<void> // from the next turn, in the same conversation
  close(): void
  events(): AsyncIterable<SessionEvent>
}

export interface Decision {
  allow: boolean
  reason?: string
}

// What a desk session is given: where it is, its tools behind the gate, and its layers.
export interface SessionSpec {
  deskDir: string
  modules: string
  granted: string[] // folders the person granted, read-only
  userName: string
  resume?: string
  model?: string // an agent's own; the desk's when none
  identity?: string // who an agent is, after Alpha's own words
  registry: Registry
  gate: Gatekeeper
  context: {
    start(): string // the start layer (a fresh session's first message, and after compaction)
    turn(): string // the per-turn layer
    takeFresh(): boolean // true once, on a fresh session's first message
    compacted?(): string // added after a compaction: the person's last messages, word for word
  }
  files: (tool: string, input: Record<string, unknown>) => Decision // Read, Write, Edit paths
  prompt: 'appended' | 'alone' // Alpha's words appended to the route's own prompt, or alone
}

export interface Provider {
  readonly name: string
  readonly route: Route
  readonly can: Capabilities
  session(spec: SessionSpec): Session
  // One question, no tools, answered in the schema; the instructions are the system prompt.
  ask(
    system: string,
    prompt: string,
    schema: Record<string, unknown>,
  ): Promise<{ answer: unknown; tokens: number }>
  // A question the model works out with a few read-only tools before it answers in the schema
  // (a plugin's exploring session, onboarding B): those tools and no others, for at most `turns`.
  explore?(
    system: string,
    prompt: string,
    tools: ToolEntry[],
    schema: Record<string, unknown>,
    turns: number,
  ): Promise<{ answer: unknown; tokens: number; uses?: Use[] }>
}
