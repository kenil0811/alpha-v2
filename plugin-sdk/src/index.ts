// What a plugin is (onboarding 4a, Kenil's yes 2 Nov): a package in plugins/ the core loads at
// start, given a host that is everything it may do in Alpha and nothing else. A plugin imports
// only this SDK, never the core, so removing its folder removes it whole and Alpha runs as before.
// The core's own seams (the connector SDK, the kit format) stay as they are: a plugin reaches them
// through this host.
import type { z } from 'zod'

// A row of a table, its values by field name.
export interface Row {
  id: string
  values: Record<string, unknown>
}

export interface Person {
  name: string
  region: string | null // SG
  zone: string // Asia/Singapore
  language: string // en
}

// What Alpha can set up: its modules, each with what it is for, and its connectors.
export interface Catalogue {
  modules: {
    name: string
    installed: boolean
    case: { for: string; keeps: string; decides: string } | null // its business case
  }[]
  // private: one of this computer's (browsing, apps, file names), kept from the model and never
  // offered as a suggestion; connected from onboarding itself
  connectors: { name: string; title: string; connected: boolean; private: boolean }[]
}

// Someone the person deals with, by the world's own counts of meetings and messages.
export interface Someone {
  name: string
  company: string | null
  contact: number // meetings and messages, every one counted once
  last: string | null
}

// A read-only tool of the plugin's, for the model in an exploring session: what it returns goes to
// the model as it is, so the plugin filters what it should never see before returning it.
export interface PluginTool {
  name: string // letters, digits and underscores
  description: string
  input: z.ZodRawShape
  run(input: Record<string, unknown>): Promise<unknown>
}

// What an exploring session came to: the answer, and every call the model made with what it got
// (each call's id, t1, t2…, is what the answer cites).
export interface Explored {
  answer: unknown
  calls: { id: string; tool: string; input: unknown; output: unknown }[]
}

export interface PluginHost {
  readonly name: string
  // where it keeps its own files (what it sent, to show again): inside Alpha's folder, its own
  readonly dir: string
  person(): Person
  // The rows of a table a kit or a connector keeps, by the key its module and table were made with
  // (the Mail table in Mail): none when it is not there.
  rows(module: string, table: string): Row[]
  // What Alpha can set up: modules and connectors.
  catalogue(): Catalogue
  // The people the person deals with, the most contact first: the world's counts, never a guess.
  people(): Someone[]
  // Whether some words (a subject, a title, a sender) touch the never-use list: the one shipped
  // with Alpha and every one the person keeps on a connection. What touches it never leaves.
  never(words: string): boolean
  // A connector's tool as Alpha's own code calls it, on the person's connection (one kept from the
  // model too); the connector says in words when it is not connected.
  connectorTool(connector: string, tool: string, input: Record<string, unknown>): Promise<unknown>
  // One question to the model, no tools, answered in this JSON schema, on the person's own route:
  // what it cost is kept with Alpha's usage.
  ask(system: string, prompt: string, schema: Record<string, unknown>): Promise<unknown>
  // A question the model works out with the plugin's own read-only tools before answering in the
  // schema, on the person's route, its cost kept with Alpha's usage: those tools and no others.
  explore(
    system: string,
    prompt: string,
    tools: PluginTool[],
    schema: Record<string, unknown>,
  ): Promise<Explored>
  // Its own module (the kit in its folder): rows Alpha proposes (assumed, with why), the person's
  // own changes (stated), and what a table holds.
  own: {
    add(table: string, rows: { values: Record<string, unknown>; basis: string }[]): string[]
    set(table: string, id: string, values: Record<string, unknown>): void
    rows(table: string): Row[]
  }
  // A route of its own under /api/plugins/<name>/, answering the window as the person.
  route(method: 'GET' | 'POST', path: string, answer: (input: Input) => Promise<unknown>): void
  // A block for the start of every conversation (what the person kept), or none.
  startBlock(words: () => string | null): void
  // A line in the journal: counts and what was done, never what was read.
  journal(words: string, data?: Record<string, unknown>): void
}

export interface Input {
  params: Record<string, string>
  query: Record<string, string>
  body: unknown
}

export interface Plugin {
  name: string // letters, digits and dashes, starting with a letter
  title: string
  // a folder in the package holding its own module, installed at start and updated as Alpha's own
  // modules are (what the person changed is kept)
  kit?: string
  register(host: PluginHost): void | Promise<void>
}

// A refusal in words the person reads, from a plugin's route: shown to them as the core's own are.
export class Refusal extends Error {}

export const NAME = /^[a-z][a-z0-9-]*$/

// Every problem with what a folder exported as its plugin, in plain words; none means it loads.
export function checkPlugin(x: unknown, taken: string[] = []): string[] {
  if (typeof x !== 'object' || x === null) return ['It is not a plugin object.']
  const p = x as Record<string, unknown>
  const out: string[] = []
  if (typeof p.name !== 'string' || !NAME.test(p.name))
    out.push('name: letters, digits and dashes, starting with a letter.')
  else if (taken.includes(p.name)) out.push(`A plugin called ${p.name} is loaded already.`)
  if (typeof p.title !== 'string' || !p.title.trim()) out.push('title: what the person reads.')
  if (p.kit !== undefined && typeof p.kit !== 'string') out.push('kit: a folder in the package.')
  if (typeof p.register !== 'function')
    out.push('register: the function the core calls with its host.')
  return out
}
