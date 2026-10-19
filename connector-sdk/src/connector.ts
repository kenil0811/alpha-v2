// What a connector is (design §8): a manifest, the tables its items land in, tools whose effects
// the core's gates read, a check that the account works, and a sync that lands what is new.
// A connector imports only this SDK; the core gives it a Host.
import type { z } from 'zod'
import type { Effect } from './effects.ts'

// secret: an app password or API key the person types in Alpha's own form, never the model.
// oauth: Alpha's own app, the person consenting in their browser.
// browser: a browser profile the person signs into.
// system: the Mac asks the person itself (Calendar, Contacts).
export type AuthKind = 'secret' | 'oauth' | 'browser' | 'system'

export interface Manifest {
  name: string // gmail
  title: string // Gmail
  auth: AuthKind
  account: { label: string; placeholder?: string }
  secret?: { label: string; help: string; url?: string }
  // Pacing per account: calls a minute, and a day's budget where the service has one.
  pace: { perMinute: number; perDay?: number }
  // How often its sync runs, when it has one.
  syncEveryMinutes?: number
}

export type FieldKind =
  | 'text'
  | 'number'
  | 'money'
  | 'date'
  | 'choice'
  | 'relation'
  | 'person'
  | 'file'
  | 'link'
  | 'email'
  | 'phone'

export interface TableSpec {
  name: string
  fields: { name: string; kind: FieldKind; choices?: string[] }[]
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
  preview?: (input: z.infer<z.ZodObject<S>>) => { words: string; detail?: string }
  run: (c: Call, input: z.infer<z.ZodObject<S>>) => Promise<unknown>
}

export interface SyncResult {
  rows: number // what the account holds now in the synced scope, for the health judgement
  sawNew: boolean
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
