// What the window may import from the core: the shapes of the api, never its code.

export interface Health {
  ok: true
  version: string
}

export interface Me {
  user: { id: string; name: string }
  tenant: string
  theme: 'mac' | 'light' | 'dark' // Appearance: Match Mac, or one look
}

// What Find (⌘K) found beyond screens and tables: rows, by their words.
export interface FoundRow {
  label: string
  hint: string // its table
  href: string
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
  connector: string | null // for a connection's sign-in: which form to open
  site: string | null // for a site's sign-in: the site, opened in a window of Alpha's browser
  options: string[]
  cannotUndo: string | null
  answer: string | null
  restsOn: string[] // what the card rests on, in words
  module: string | null // the module it belongs to, for a lens
}

export interface Stream {
  lines: StreamLine[]
  cards: CardView[]
  busy: boolean
  running: { id: string; name: string; module: string | null }[] // agents' runs going now
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
  pages: PageSummary[]
  tables: TableSummary[]
}

// A module's page (design §13): the file's name, its title, and whether the module opens on it.
export interface PageSummary {
  name: string
  title: string
  front: boolean
}

export interface FieldView {
  id: string
  name: string
  slug: string
  kind: string
  choices: string[]
  tones: Record<string, 'good' | 'warn' | 'bad' | 'accent'> // a choice's colour, where it is a state
}

// Where a value came from, in words the person reads, with what to open.
export interface SourceView {
  kind: 'stated' | 'looked_up' | 'estimated' | 'assumed' | 'computed'
  words: string
  at: string
  open?: { file: string; cell?: string; sheet?: string } | { url: string } | { line: number }
  note?: string // a computed value's sum with its numbers, or each check it made
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
  views: SavedView[]
}

// A saved view (world/views.ts), its fields by id.
export type ViewKind =
  | 'table'
  | 'board'
  | 'list'
  | 'gallery'
  | 'calendar'
  | 'timeline'
  | 'chart'
  | 'form'
export type FilterOp =
  | 'is'
  | 'is_not'
  | 'contains'
  | 'not_contains'
  | 'starts'
  | 'ends'
  | 'eq'
  | 'ne'
  | 'gt'
  | 'lt'
  | 'between'
  | 'before'
  | 'after'
  | 'today'
  | 'this_week'
  | 'next_days'
  | 'in'
  | 'empty'
  | 'not_empty'
export type TotalOp =
  | 'sum'
  | 'avg'
  | 'min'
  | 'max'
  | 'count'
  | 'empty'
  | 'filled'
  | 'unique'
  | 'earliest'
  | 'latest'
export interface FilterRule {
  field: string
  op: FilterOp
  value?: string | number | null | undefined
  value2?: string | number | null | undefined
  values?: string[] | undefined
}
export interface ViewConfig {
  kind: ViewKind
  search: string
  filters: { match: 'all' | 'any'; rules: FilterRule[] }
  sorts: { field: string; dir: 'asc' | 'desc' }[]
  group: string | null
  by: string | null
  measure: string | null
  hidden: string[]
  order: string[]
  widths: Record<string, number>
  totals: Record<string, TotalOp>
  colours: {
    tint: string | null
    when: {
      field: string
      op: 'gt' | 'lt' | 'eq' | 'before' | 'after'
      value: string | number | null
      tone: 'good' | 'warn' | 'bad' | 'accent'
    }[]
  }
}
export interface SavedView {
  id: string
  name: string
  config: ViewConfig
  isDefault: boolean
  madeBy: 'person' | 'alpha' | 'kit'
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
  pages: PageSummary[]
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
  module: string | null // its name
  moduleId: string | null
  startedAt: string
  ms: number | null // how long it took, once it ended
  state: 'running' | 'ok' | 'failed' | 'stopped'
  words: string | null
  tokens: number | null // null: no model was used
  quiet: boolean // it ended and changed nothing
  steps: { id: number; at: string; kind: string; words: string }[]
}

// Today, beside the stream on a wide window: what changed since the person last cleared it, and
// what is coming up. What needs them and what is running come with the stream.
export interface TodayView {
  since: string // when they last cleared it, or the start of today
  changed: RunView[] // runs and reads that ended having changed something, or did not finish
  coming: { agent: string; name: string; module: string; moduleName: string; at: string }[]
}

export type LiveEvent =
  | { type: 'lines' }
  | { type: 'live'; turn: string; text: string; doing: string | null }
  | { type: 'busy'; turn: string }
  | { type: 'idle' }
