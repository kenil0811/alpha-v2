// What a plugin is (onboarding 4a, Kenil's yes 2 Nov): a package in plugins/ the core loads at
// start, given a host that is everything it may do in Alpha and nothing else. A plugin imports
// only this SDK, never the core, so removing its folder removes it whole and Alpha runs as before.
// The core's own seams (the connector SDK, the kit format) stay as they are: a plugin reaches them
// through this host.

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

export interface PluginHost {
  readonly name: string
  // where it keeps its own files (what it sent, to show again): inside Alpha's folder, its own
  readonly dir: string
  person(): Person
  // The rows of a table a kit or a connector keeps, by the key its module and table were made with
  // (the Mail table in Mail): none when it is not there.
  rows(module: string, table: string): Row[]
  // A connector's tool as Alpha's own code calls it, on the person's connection (one kept from the
  // model too); the connector says in words when it is not connected.
  connectorTool(connector: string, tool: string, input: Record<string, unknown>): Promise<unknown>
  // One question to the model, no tools, answered in this JSON schema, on the person's own route:
  // what it cost is kept with Alpha's usage.
  ask(system: string, prompt: string, schema: Record<string, unknown>): Promise<unknown>
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
