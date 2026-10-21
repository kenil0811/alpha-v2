// What the window may import from the core: the shapes of the api, never its code.

export interface Health {
  ok: true
  version: string
  build: string | null // the window this core serves: a window on another build reloads
}

export interface Me {
  user: { id: string; name: string }
  tenant: string
  theme: 'mac' | 'light' | 'dark' // Appearance: Match Mac, or one look
  layout: Layout
}

// How the person left the window: the rail folded to icons or not, the modules folded in it, and
// the side conversation's width (none: its usual 320px). Kept by Alpha, per person.
export interface Layout {
  railFolded: boolean
  folded: string[]
  panel: number | null
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
  filing?: FilingView | null // a file from the mail: where it is proposed to go
  draft?: DraftView | null // an agent's email for the person's yes
  match?: MatchView | null // people or companies that may be one, side by side
  review?: ReviewView | null // rows an agent puts to the person, a choice on each
  proposed?: ProposedView | null // tasks an agent proposes, for the person's yes
}

// Tasks an agent proposes on one card: each as it would be added, where and for whom.
export interface ProposedView {
  agent: string
  tasks: {
    title: string
    notes: string | null
    due: string | null
    priority: 'high' | 'normal' | 'low'
    place: string // in words
    owner: string // You, or the agent's name
  }[]
}

// Rows an agent puts to the person on one card: each with why, and the choices it offers.
export interface ReviewView {
  table: string
  field: string
  choices: string[] // the first is the usual yes
  rows: { id: string; name: string; note: string | null; value: string | null }[]
  open: number // rows not yet decided
}

// One side of a pair on a match card: enough to tell the two apart.
export interface SideView {
  id: string
  kind: 'person' | 'company'
  name: string
  emails: string[]
  phones: string[]
  profile: string | null
  companies: string[]
  from: string[] // the tables it came from
  last: string | null
  count: number
}

export interface MatchView {
  pairs: {
    id: string
    why: string
    state: 'found' | 'proposed' | 'merged' | 'apart' | 'withdrawn'
    a: SideView // the one known longer, which a merge keeps
    b: SideView
  }[]
  open: number
  samePlace: number // undecided pairs with the same name and company
}

// Someone, or a company, as the People list shows them.
export interface PersonLineView {
  id: string
  kind: 'person' | 'company'
  name: string
  emails: string[]
  phones: string[]
  companies: string[]
  domains: string[]
  last: string | null // the last message or meeting
  count: number // messages and meetings in the last days
  first: 'you' | 'them' | null // who wrote first in those days
  people: number // a company's
}

export interface PeopleView {
  kind: 'person' | 'company'
  days: number
  lines: PersonLineView[]
  people: number
  companies: number
  sources: string[] // the tables people come from; none until a connection is read
}

// A person's or company's page.
export interface PersonView {
  id: string
  kind: 'person' | 'company'
  name: string
  emails: string[]
  phones: string[]
  profile: string | null
  domains: string[]
  merged: { id: string; name: string }[] // each can be unmerged
  companies: {
    id: string
    name: string
    title: string | null
    since: string
    ended: string | null
  }[]
  people: { id: string; name: string; title: string | null }[] // a company's, now
  from: { table: string | null; name: string; count: number }[] // where Alpha knows them from
  contact: {
    days: number
    last: string | null
    count: number
    channels: { channel: string; count: number }[]
    first: 'you' | 'them' | null
  }
  // the rows of the person's modules that name them: a person field, or an address of theirs
  rows: { table: string; module: string; name: string; field: string; href: string }[]
  history: {
    at: string
    channel: string
    by: 'you' | 'them' | null
    about: string | null
    href: string // its row
  }[]
  createdAt: string
}

// An agent's draft on its card: the email to change, what it is about, the reasons a Not now picks
// from, and Always when three unchanged sends of its kind have earned it.
export interface DraftView {
  agent: string
  kind: string
  message: { to: string; cc?: string; subject: string; body: string }
  note: string | null
  about: { table: string; row: string; name: string } | null
  reasons: string[]
  always: string | null // the standing permission's sentence, when offered
}

// What this Mac still needs, for the first open and Settings › This Mac.
export interface SetupView {
  claude: { signedIn: boolean; email: string | null; how: string | null; problem: string | null }
  route: 'subscription' | 'key'
  connected: { gmail: boolean; calendar: boolean; contacts: boolean }
  chrome: boolean // Google Chrome, for sites the person signs in to
  keepAwake: boolean | null // the Mac kept from sleeping while plugged in; none where it can't be
  readers: {
    browser: 'ready' | 'preparing' | 'not yet' | 'failed' // the reading browser
    documents: 'ready' | 'preparing' | 'not yet' | 'failed' // the document reader
    problem: string | null
  }
}

// A standing permission as Settings lists it.
export interface PermissionView {
  id: string
  sentence: string
  grantedBy: string
  grantedAt: string
  uses: number
  lastUsedAt: string | null
  revokedAt: string | null
}

// A file that came by mail, waiting to be filed: the email, what the file is, the place the model
// proposed and how sure, and the rows the email or the file names, to pick another.
export interface FilingView {
  file: string
  name: string
  mime: string
  from: string
  subject: string
  date: string
  about: string
  sure: 'sure' | 'likely' | 'unsure'
  why: string
  table: string | null
  row: string | null
  kind: string | null
  already: string[] // the row's files of that kind already, which File it keeps and Replace takes off
  always: string | null // the standing permission's sentence, when offered
  places: { table: string; name: string; kinds: string[]; rows: { id: string; name: string }[] }[]
}

export interface Stream {
  lines: StreamLine[]
  cards: CardView[]
  busy: boolean
  running: { id: string; name: string; module: string | null }[] // agents' runs going now
  // connections that need the person to sign in; one read as them signs in in Chrome
  attention: { connector: string; title: string; connection: string; inBrowser: boolean }[]
  tasks: { open: number; overdue: number; today: number } // for the rail's badge
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
  parent: string | null // the module it sits inside
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
  open?:
    | {
        file: string
        cell?: string
        sheet?: string
        page?: number
        box?: [number, number, number, number] // in points, counted up from the page's foot
        line?: number
      }
    | { url: string }
    | { line: number }
  note?: string // a computed value's sum with its numbers, or each check it made
  // beside a value the person typed over: what Alpha works it out as now, which Reset brings back
  beside?: { value: unknown; words: string; note?: string }
}

// A document as the window shows it at a value's place: a sheet's cells, a PDF's pages (drawn by
// /api/files/:hash/page/:n), or a text's lines.
export interface FileView {
  hash: string
  name: string
  mime: string
  kind: 'sheet' | 'pdf' | 'text' | 'kept' | 'reading'
  sheets?: { name: string; cells: { cell: string; row: number; col: number; words: string }[] }[]
  pages?: number
  lines?: { line: number; words: string }[]
}

// A file on a row: a deal's CIM, a client's export.
export interface RowFileView {
  hash: string
  name: string
  size: number
  mime: string
  kind: string | null
  by: string // who put it there, in words
  at: string
  read: 'read' | 'reading' | 'kept' // read with its places, being read, or kept as it is
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
  documents: string[] | null // the kinds of document its rows take, when it names them
  rows: RowView[]
  names: Record<string, string> // the rows its relations point at and the people it holds, by name
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
  inBrowser: boolean // signed in to in Google Chrome, and read as the person
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
  parent: string | null
  pages: PageSummary[]
  tables: TableSummary[]
  modules: (ModuleSummary & { kit: string | null; agents: number })[] // the modules inside it
}

// What Alpha remembers: the standing instructions the person gave, for them or for everyone.
export interface InstructionView {
  for: 'me' | 'everyone'
  words: string
}

// The model Alpha runs on and how it reaches it, as Settings shows it.
export interface ModelView {
  desk: string
  route: 'subscription' | 'key' // the person's own Claude subscription, or the firm's API key
  hasKey: boolean // a key is kept in the Keychain
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

// A task as a list shows it: its state, due, priority, owner and where it sits.
export interface TaskLineView {
  id: string
  title: string
  state: 'todo' | 'doing' | 'waiting' | 'done' | 'dropped'
  due: string | null
  overdue: boolean
  remindAt: string | null
  repeat: string | null
  priority: 'high' | 'normal' | 'low'
  owner: string // in words: You, Alpha, an agent's name
  ownerKind: 'person' | 'alpha' | 'agent'
  place: { words: string; path: string[]; href: string | null }
  parent: string | null
  children: number
  childrenDone: number
  waitingForYou: boolean // a card about it waits on the person
  working: boolean // its agent is working on it now
}

export interface TasksView {
  list: string
  lines: TaskLineView[]
  counts: Record<string, number> // per saved list
}

// A task's page.
export interface TaskView extends TaskLineView {
  notes: string | null
  remindedAt: string | null
  madeBy: string
  placedBy: string | null
  placedWhy: string | null
  createdAt: string
  doneAt: string | null
  parentTitle: string | null
  children: number
  subtasks: TaskLineView[]
  touches: { kind: 'row' | 'person' | 'file'; name: string; href: string | null }[]
  // where it sits, as it is now: the row's values, and the other open tasks there
  context: {
    values: { field: string; value: string }[]
    siblings: TaskLineView[]
  }
  history: { at: string; words: string }[]
  owners: { kind: 'person' | 'alpha' | 'agent'; id: string | null; name: string }[]
  // the agent it is given to, and its runs on it, newest first (the one working now first)
  agent: {
    name: string
    on: boolean
    takes: boolean
    said: string | null // what its runs last said of the task: done with what, or what it waits for
    runs: RunView[]
  } | null
  cards: CardView[] // what its runs put to the person: waiting first, then the decided
}
