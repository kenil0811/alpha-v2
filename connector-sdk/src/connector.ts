// What a connector is (design §8): a manifest, the tables its items land in, tools whose effects
// the core's gates read, a check that the account works, and a sync that lands what is new.
// A connector imports only this SDK; the core gives it a Host.
import type { z } from 'zod'
import type { BrowserEngine } from './browser.ts'
import type { Effect } from './effects.ts'

// secret: an app password or API key the person types in Alpha's own form, never the model.
// oauth: Alpha's own app, the person consenting in their browser.
// browser: a browser profile the person signs into.
// system: the Mac asks the person itself (Calendar, Contacts).
// path: a place on this Mac the person names (a watched folder); nothing to sign in to.
export type AuthKind = 'secret' | 'oauth' | 'browser' | 'system' | 'path'

// The pictures the window has for a connector's tile.
export type Icon = 'mail' | 'calendar' | 'people' | 'network' | 'folder' | 'plug'

// A connector describes itself; the core names no connector (decision 10). What the window
// shows for it (its tile, its first-open step, the System Settings pane after a no, a warning)
// is all here.
export interface Manifest {
  name: string // gmail: letters, digits and dashes; the model's tools are mcp__<name>__<tool>
  title: string // Gmail
  auth: AuthKind
  icon?: Icon
  account: { label: string; placeholder?: string }
  secret?: { label: string; help: string; url?: string }
  // Pacing per account: calls a minute, and a day's budget where the service has one.
  pace: { perMinute: number; perDay?: number }
  // How often its sync runs, when it has one.
  syncEveryMinutes?: number
  // browser: where the person signs in themselves, in Google Chrome
  signIn?: string
  // system: the System Settings pane (Privacy & Security › <pane>) that turns Alpha on after a no
  system?: { pane: string }
  // Its step on the first open, when it has one: why the person would connect it.
  setup?: { sub: string }
  // What the person reads before connecting it, when there is something to weigh (a site that
  // asks not to be read automatically).
  warning?: string
}

// The kinds a table's fields can have: the kit API's list, said again here so a connector imports
// only this SDK (the core checks the two lists agree).
export const FIELD_KINDS = [
  'text',
  'number',
  'money',
  'date',
  'choice',
  'relation',
  'person',
  'file',
  'link',
  'email',
  'phone',
  'notes',
] as const
export type FieldKind = (typeof FIELD_KINDS)[number]

// How a table's rows name people, by its fields' names (the core's people read them): each row
// is a person, or an exchange with people whose fields hold addresses as a message writes them.
export type PeopleMap =
  | {
      each: 'person'
      name?: string // none: their name comes from wherever else they are known
      emails?: string
      phones?: string
      profile?: string
      company?: string
      title?: string
      you?: { field: string; is: string } // the person's own card
    }
  | {
      each: 'exchange'
      channel: string
      at: string
      from?: string
      to?: string[]
      with?: string[]
      sent?: { field: string; is: string }
      by?: string // who started it: a meeting's organizer
      about?: string // what it was about: a message's subject, a meeting's title
      you?: string // the person's own address in it
    }

export interface TableSpec {
  name: string
  fields: { name: string; kind: FieldKind; choices?: string[] }[]
  people?: PeopleMap
}

export interface Item {
  key: string // the item's own id at its source
  values: Record<string, unknown> // by field name
}

export interface Landed {
  added: number
  changed: number
  same: number
}

// What the core gives a connection.
export interface Host {
  account: string
  secret(): Promise<string | null>
  cursor(): string | null
  setCursor(cursor: string | null): void
  // existing: change only rows already kept (a mark on an older message is not a new row).
  land(table: string, items: Item[], options?: { existing?: boolean }): Landed
  // A file kept and read into a document, as if the person had dropped it in.
  keepFile?: (name: string, bytes: Uint8Array, mime: string) => { isNew: boolean }
  // The human-pace browser, for a site the person signed in to (auth: browser).
  browser?: () => BrowserEngine
  // The item keys a table keeps already (a read that stops at what it knows).
  keys?: (table: string) => string[]
  journal(words: string, data?: Record<string, unknown>): void
}

// A connection's calls go through the SDK: paced, retried, journaled, recorded or replayed.
export interface Call {
  host: Host
  call<T>(name: string, args: unknown, fn: () => Promise<T>): Promise<T>
}

export interface Tool<S extends z.ZodRawShape = z.ZodRawShape> {
  description: string
  input: S
  effect: Effect | ((input: z.infer<z.ZodObject<S>>) => Effect)
  // What a card shows when the call waits on one: a line, and the whole of it.
  preview?: (input: z.infer<z.ZodObject<S>>) => { words: string; detail?: string; yes?: string }
  // What the step is called where the person reads it (Activity): plain words, no tool names.
  words?: (input: z.infer<z.ZodObject<S>>) => string
  run: (c: Call, input: z.infer<z.ZodObject<S>>) => Promise<unknown>
}

export interface SyncResult {
  rows: number // what the account holds now in the synced scope, for the health judgement
  sawNew: boolean
}

// A file an item carries: an email's attachment. inline: shown in the body (a logo, a signature).
export interface ItemFile {
  name: string
  mime: string
  bytes: Uint8Array
  inline: boolean
}

export interface Connector {
  manifest: Manifest
  guide: string // what the model reads about it
  module: string // where its tables live
  tables: TableSpec[]
  // biome-ignore lint/suspicious/noExplicitAny: each tool has its own input shape
  tools: Record<string, Tool<any>>
  check?: (c: Call) => Promise<void> // the account works; throws in plain words when it does not
  sync?: (c: Call) => Promise<SyncResult>
  // The files an item carries, fetched when the core needs them (an email's attachments); field
  // is the item's field that names them, so the core knows which items carry any.
  files?: { table: string; field: string; fetch: (c: Call, item: string) => Promise<ItemFile[]> }
}

export function defineTool<S extends z.ZodRawShape>(t: Tool<S>): Tool<S> {
  return t
}

// A failure the person can act on, in their words.
export class Problem extends Error {
  readonly kind: 'sign_in' | 'blocked' | 'gone' | 'other'
  constructor(words: string, kind: 'sign_in' | 'blocked' | 'gone' | 'other' = 'other') {
    super(words)
    this.kind = kind
  }
}
