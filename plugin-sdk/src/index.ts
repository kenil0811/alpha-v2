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
  connectors: { name: string; title: string; connected: boolean }[]
  agents: { name: string; title: string }[]
  schedules: { name: string; module: string | null; on: boolean }[]
}

// Someone the person deals with, by the world's own counts of meetings and messages.
export interface Someone {
  name: string
  company: string | null
  contact: number // meetings and messages, every one counted once
  last: string | null
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
  // A connector Alpha connects on its own (Calendar, Contacts), on the person's yes in the plugin's
  // screen: connected, or the words why not
  // (macOS said no, the source is not on this computer). One that signs in connects in Connections.
  connect(connector: string): Promise<{ connected: boolean; problem: string | null }>
  // A connector's tool as Alpha's own code calls it, on the person's connection (one kept from the
  // model too); the connector says in words when it is not connected.
  connectorTool(connector: string, tool: string, input: Record<string, unknown>): Promise<unknown>
  // One question to the model, no tools, answered in this JSON schema, on the person's own route:
  // what it cost is kept with Alpha's usage.
  ask(system: string, prompt: string, schema: Record<string, unknown>): Promise<unknown>
  // Its own module (the kit in its folder): rows Alpha proposes (assumed, with why), the person's
  // own changes (stated), and what a table holds.
  own: {
    add(
      table: string,
      rows: { values: Record<string, unknown>; basis: string; made?: Record<string, Made> }[],
    ): string[]
    set(table: string, id: string, values: Record<string, unknown>): void
    // its own change to a row, its values said as add says them
    change(
      table: string,
      id: string,
      values: Record<string, unknown>,
      basis: string,
      made?: Record<string, Made>,
    ): void
    rows(table: string): Row[]
  }
  // A route of its own under /api/plugins/<name>/, answering the window as the person.
  route(method: 'GET' | 'POST', path: string, answer: (input: Input) => Promise<unknown>): void
  // A block for the start of every conversation (what the person kept), or none.
  startBlock(words: () => string | null): void
  // A line in the journal: counts and what was done, never what was read.
  journal(words: string, data?: Record<string, unknown>): void
  // Tools for an agent its kit carries (by its key, its folder in the kit's agents/), in that
  // agent's chats alone: no other agent has them. What a tool writes, it writes through these calls.
  tools(agent: string, tools: PluginTool[]): void
  // A conversation started with an agent its kit carries, in that agent's chat for the person:
  // words is the line they see there ("Started from Home"), brief what the agent is told to do.
  converse(person: string, agent: string, words: string, brief: string): void
  // Lines for the person's How to work, put to them on a card in its agent's chat: rows of a table
  // of its own, the line in one field and Keep or Drop in a choice field. A line the person keeps
  // is written to How to work as theirs, For you (For everyone here only when they are the owner)
  // under the heading; nothing is written without their Keep. The card's id.
  howToWork(turn: Turn, lines: Lines): string
  // A question put to the person on a card in its agent's chat, as the agent's ask tool puts one:
  // its options, and always the box for their own words; their answer comes to the agent as a
  // message. The card's id.
  question(turn: Turn, q: { words: string; detail?: string; options: string[] }): string
  // What the person answered on a card its agent raised, once they have: none while it waits.
  answer(card: string): string | null
  // The files a connector kept (a folder lent in the Bridge): names, kinds and dates, never what
  // is inside.
  files(connector: string): { hash: string; name: string; kind: string; at: string }[]
  // What a person did in Alpha in the days back, as the journal says it, never what was read.
  activity(person: string, days: number): { id: number; at: string; kind: string; words: string }[]
}

// How one value came to be, where it is not its row's basis: worked out in code (and how), or
// estimated (and what the estimate rests on).
export type Made = { kind: 'computed'; how: string } | { kind: 'estimated'; basis: string }

// Where one of its agent's tools is called: the person whose chat it is, the agent, the turn.
export interface Turn {
  person: string
  name: string // the person's name, as Alpha has it
  owner: boolean // whether they are the owner here
  agent: string
  turn: string
}

// A tool its own agent alone is given: what the model reads, its input, and what it does, its
// words going back to the agent. A Refusal is said to the agent as the core's refusals are.
export interface PluginTool<S extends z.ZodRawShape = z.ZodRawShape> {
  name: string // letters, digits and underscores
  description: string
  input: S
  run(input: z.infer<z.ZodObject<S>>, turn: Turn): Promise<string>
}

// One tool, typed by its input where it is written.
export function tool<S extends z.ZodRawShape>(t: PluginTool<S>): PluginTool {
  return t as unknown as PluginTool
}

// Lines put to the person for How to work (host.howToWork).
export interface Lines {
  words: string // the card's question
  table: string // a table of its own module
  rows: string[] // its rows, one line each
  line: string // the field holding the line
  choice: string // the choice field the person decides
  keep: string // its choice that keeps the line
  drop: string // its choice that drops it
  for: 'me' | 'everyone'
  heading: string // where the kept lines go in How to work ("About you")
}

export interface Input {
  params: Record<string, string>
  query: Record<string, string>
  body: unknown
  person: { id: string; name: string; owner: boolean } // who asked, as the window is signed in
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
  else if (p.name === 'alpha') out.push('name: alpha is Alpha’s own.')
  else if (taken.includes(p.name)) out.push(`A plugin called ${p.name} is loaded already.`)
  if (typeof p.title !== 'string' || !p.title.trim()) out.push('title: what the person reads.')
  if (p.kit !== undefined && typeof p.kit !== 'string') out.push('kit: a folder in the package.')
  if (typeof p.register !== 'function')
    out.push('register: the function the core calls with its host.')
  return out
}
