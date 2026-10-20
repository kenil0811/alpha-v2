// What the window may import from the core: the shapes of the api, never its code.

export interface Health {
  ok: true
  version: string
}

export interface Me {
  user: { id: string; name: string }
  tenant: string
}

// A line about some rows (what a reader found): each can be opened, and one choice set on it.
export interface AboutRows {
  table: string
  rows: { id: string; name: string; value: string | null }[]
  choice: { field: string; value: string; label: string } | null
}

export interface StreamLine {
  id: number
  at: string
  actor: 'person' | 'alpha' | 'agent' | 'connector' | 'system'
  kind: string
  words: string
  turn: string | null
  card: string | null
  module: { id: string; name: string } | null // the module it belongs to, for topic chips
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
  running: { id: string; name: string }[] // agents' runs going now
  attention: { connector: string; title: string }[] // connections that need the person to sign in
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

// One value's history, newest first.
export interface HistoryView {
  value: unknown
  source: SourceView | null
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
  names: Record<string, string> // the rows its relations point at, by name
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

// An agent as Settings shows it: its trigger in words, on or paused.
export interface AgentView {
  id: string
  name: string
  state: 'on' | 'paused'
  when: string
  lastRunAt: string | null
  running: boolean
}

// A module that does work on its own: from a kit or made in the desk.
export interface WorkingModuleView {
  id: string
  name: string
  kit: { name: string; version: string; source: string } | null
  network: string[] // the sites its readers may read
  agents: AgentView[]
}

// A module's head and its parts, for its screen.
export interface ModuleView {
  id: string
  name: string
  kit: { name: string; version: string } | null
  agents: AgentView[]
  sites: number // how many sites its readers may read
  notes: string // NOTES.md, as written
  tables: TableSummary[]
}

// What Alpha remembers: the standing instructions the person gave, for them or for everyone.
export interface InstructionView {
  for: 'me' | 'everyone'
  words: string
}

// The model Alpha runs on and how it reaches it, as Settings shows it.
export interface ModelView {
  desk: string
  route: 'subscription' | 'key'
}

// A run in Activity: an agent's or a reader's, or a connection reading its account.
export interface RunView {
  id: string
  kind: 'run' | 'read'
  name: string
  module: string | null
  startedAt: string
  ms: number | null // how long it took, once it ended
  state: 'running' | 'ok' | 'failed' | 'stopped'
  words: string | null
  tokens: number | null // null: no model was used
  quiet: boolean // it ended and changed nothing
  steps: { id: number; at: string; kind: string; words: string }[]
}

export type LiveEvent =
  | { type: 'lines' }
  | { type: 'live'; turn: string; text: string; doing: string | null }
  | { type: 'busy'; turn: string }
  | { type: 'idle' }
