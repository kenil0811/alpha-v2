// What the window may import from the core: the shapes of the api, never its code.

export interface Health {
  ok: true
  version: string
}

export interface Me {
  user: { id: string; name: string }
  tenant: string
}

export interface StreamLine {
  id: number
  at: string
  actor: 'person' | 'alpha' | 'agent' | 'connector' | 'system'
  kind: string
  words: string
  turn: string | null
  card: string | null
  data: Record<string, unknown>
}

export interface CardView {
  id: string
  kind: string
  state: string
  words: string
  detail: string | null // the whole of it: the message as it will go
  gate: string | null
  connector: string | null // for a sign-in: which form to open
  options: string[]
  cannotUndo: string | null
  answer: string | null
}

export interface Stream {
  lines: StreamLine[]
  cards: CardView[]
  busy: boolean
  lastId: number
}

export interface TableSummary {
  id: string
  name: string
  rows: number
}

export interface ModuleSummary {
  id: string
  name: string
  tables: TableSummary[]
}

export interface FieldView {
  id: string
  name: string
  slug: string
  kind: string
  choices: string[]
}

// Where a value came from, in words the person reads, with what to open.
export interface SourceView {
  kind: 'stated' | 'looked_up' | 'estimated' | 'assumed' | 'computed'
  words: string
  at: string
  open?: { file: string; cell?: string; sheet?: string } | { url: string } | { line: number }
}

export interface RowView {
  id: string
  values: Record<string, unknown>
  sources: Record<string, SourceView>
}

export interface TableView {
  id: string
  name: string
  module: { id: string; name: string }
  fields: FieldView[]
  rows: RowView[]
}

export interface ConnectorView {
  name: string
  title: string
  auth: 'secret' | 'oauth' | 'browser' | 'system'
  account: { label: string; placeholder?: string }
  secret?: { label: string; help: string; url?: string }
}

export interface ConnectionView {
  id: string
  connector: string
  title: string
  account: string
  state: 'connected' | 'needs_sign_in' | 'broken' | 'paused'
  health: string | null
  lastSyncAt: string | null
  tables: { id: string; name: string; hidden: boolean }[] // what it keeps, maybe out of the sidebar
}

export interface ConnectorsView {
  connectors: ConnectorView[]
  connections: ConnectionView[]
}

export type LiveEvent =
  | { type: 'lines' }
  | { type: 'live'; turn: string; text: string; doing: string | null }
  | { type: 'busy'; turn: string }
  | { type: 'idle' }
