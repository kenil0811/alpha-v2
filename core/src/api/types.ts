// What the window may import from the core: the shapes of the api, never its code.
import type { FieldView } from './row-types.ts'

export interface Health {
  ok: true
  version: string
  build: string | null // the window this core serves: a window on another build reloads
  now?: string // a demo's clock (ALPHA_CLOCK): the window's now is the core's
}

export type { Layout, Me, ModuleTabs } from './me-types.ts'
export type { FieldView, RowAround, RowPageTab, RowPageView } from './row-types.ts'

// What Find (⌘K) found beyond screens and tables: rows, by their words.
export interface FoundRow {
  label: string
  hint: string // its table
  href: string
}

// A row that says where it is (a field named Location, City, Address…), for Network's map.
export interface PlaceRow extends FoundRow {
  place: string // as the row says it: "Austin, TX"
  module: string
  at: { lat: number; lon: number } | null // on the map, once OpenStreetMap has said where
  finding: boolean // being looked up now
}

// A day worth seeing on the Calendar beside its events (Vikas, 3 Nov): a task due, or a row's
// date ahead of it (Due, Starts, Expires, Exclusivity ends…), from any module.
export interface DateRow extends FoundRow {
  at: string
  what: 'task' | 'row'
  module: string | null
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
  // the agent whose thread it is in: its run's agent, or the agent the person spoke to
  agent: { id: string; name: string } | null
  run: string | null
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
  // agents of a module that did not finish, each with its reason: Try again or Leave it on each
  failed?: { agent: string; name: string; words: string; times: number }[] | null
  agent?: { id: string; name: string } | null // the agent it came from
  run?: string | null // the run that opened it
  // the task it waits on the person for: named in its call, or the task its run serves
  task?: string | null
  createdAt?: string // when it was put to the person
}

// One card in full, for the side panel: the card, where it came from, the runs it rests on and
// its history in the journal.
export interface CardAbout {
  card: CardView
  agent: { id: string; name: string } | null
  runs: { id: string; state: string; words: string | null; startedAt: string }[]
  history: { id: number; at: string; words: string }[]
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
    word: 'add' | 'decline' | null // the person's word on it so far
  }[]
}

// Rows an agent puts to the person on one card: each with why, and the choices it offers.
export interface ReviewView {
  table: string
  field: string
  choices: string[] // the first is the usual yes
  rows: {
    id: string
    name: string
    note: string | null
    also: string | null // a second line after the note: where a drafted fact came from
    value: string | null
  }[]
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
  rows: {
    table: string
    module: string
    name: string
    field: string
    href: string
    record: string
  }[]
  history: {
    at: string
    channel: string
    by: 'you' | 'them' | null
    about: string | null
    href: string // its row
  }[]
  createdAt: string
}

// An agent's draft on its card: the email to change, what it is about, the Not now reasons, and Always when three unchanged sends of its kind have earned it.
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
  route: 'subscription' | 'key' | 'api'
  // each connector that asks for a place on the first open, as it describes itself
  steps: { connector: string; title: string; sub: string; done: boolean }[]
  chrome: boolean // Google Chrome, for sites the person signs in to
  keepAwake: boolean | null // the Mac kept from sleeping while plugged in; none where it can't be
  // what alpha.yaml says of this install: shown under This Mac
  install: { owner: string; port: number; home: string; reportTo: string | null }
  readers: {
    browser: 'ready' | 'preparing' | 'not yet' | 'failed' // the reading browser
    documents: 'ready' | 'preparing' | 'not yet' | 'failed' // the document reader
    problem: string | null
  }
}

// A rule as Governance and Settings › Permissions list it (core step 2), in code's own words.
export interface RuleView {
  id: string
  words: string
  said: string | null // the words it was asked in
  side: 'allow' | 'deny'
  kind: 'approved' | 'inferred'
  where: string // all of Alpha, a module or an agent, in words
  module: string | null
  agent: string | null // the agent it holds for, by name
  madeBy: string
  madeAt: string
  uses: number
  lastUsedAt: string | null
  revokedAt: string | null
  always: boolean // a standing permission given with Always
  noticedFrom: { id: number; at: string; words: string }[] // the lines Alpha noticed it in
  card?: string // not a rule yet: the Save card it waits on (GET /api/rules/waiting); Save makes it one
}

// A file that came by mail, waiting to be filed: the email, what the file is, the place the model proposed and how sure, and the rows named, to pick another.
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

// Interview me (Vikas, 30 Oct): the pool as it stands for the business or a module, as the button
// says it on a hover. No count is fixed: questions and left are those worth asking now.
// Onboarding from the footprint (30 Oct): each source with what it holds, its tick and what was
// read of it; the website given; the paste-back prompt; the draft's card while it waits.
export interface FootprintSource {
  id: string
  title: string
  unit: string
  sub: string
  count: number | null // what it holds, counted before any read
  needs: string | null // the connector to connect first
  ticked: boolean
  read: {
    at: string
    read: number
    skipped: number
    why: string | null // why some were skipped, in words
    items: string[] // a few of what was read
  } | null
}

export interface FootprintView {
  sources: FootprintSource[]
  countedAt: string | null
  site: string | null
  denied: boolean
  memoryPrompt: string
  memory: FootprintSource['read'] // what the AI-memory paste-back brought
  card: string | null
  done: boolean
}

export interface InterviewView {
  at: string | null // when the pool was last ranked
  today: boolean
  preparing: boolean // the pool is being ranked now
  questions: number
  left: number
  first: string | null // the most useful question, the one it would ask
}

export interface Stream {
  lines: StreamLine[]
  cards: CardView[]
  busy: boolean
  running: { id: string; name: string; module: string | null }[] // agents' runs going now
  reading: { connection: string; title: string; account: string }[] // connections being read now
  // connections that need the person to sign in; one read as them signs in in Chrome
  attention: { connector: string; title: string; connection: string; inBrowser: boolean }[]
  tasks: { open: number; overdue: number; today: number } // for the rail's badge
  settingUp: string | null // what the core is still putting in after it started (the kits)
  lastId: number
}

export interface TableSummary {
  id: string
  name: string
  rows: number
  place: 'main' | 'part' | 'setup' // a tab, on its row (`of`), or under Agents and notes (step 3a)
  of: string | null
}

export interface ModuleSummary {
  id: string
  name: string
  about: string | null // what it is for, its module.yaml's description
  parent: string | null // the module it sits inside
  people: boolean // People and Organizations are its tabs (module.yaml people: true)
  alpha: boolean // Alpha's own module (module.yaml core: true): its tables are the Second Brain
  pages: PageSummary[]
  tables: TableSummary[]
}

// A module's page (design §13): the file's name, its title, and whether the module opens on it.
export interface PageSummary {
  name: string
  title: string
  front: boolean
  for: { table: string; input: string } | null // a page of one row of that table: no tab
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

// A document as the window shows it at a value's place: a sheet's cells, a PDF's pages (drawn by /api/files/:hash/page/:n), or a text's lines.
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
  about: string | null // one sentence on what a row of it is
  aboutBy: 'kit' | 'alpha' | 'person' | null
  module: { id: string; name: string }
  fields: FieldView[]
  documents: string[] | null // the kinds of document its rows take, when it names them
  rows: RowView[]
  names: Record<string, string> // the rows its relations point at and the people it holds, by name
  views: SavedView[]
}

// A list kept outside a module's tables (people, organizations, tasks, agents, standing
// permissions), served as a table to draw and edit in place (UI batch 2, 26 Oct).
export interface KeptTable extends TableView {
  kept: { name: string; editable: string[]; why: string; counts?: Record<string, number> }
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
  | 'map'
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
  | 'due'
  | 'this_week'
  | 'next_days'
  | 'in'
  | 'all_of'
  | 'none_of'
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
  frozen: number // the columns that stay at the left as the table scrolls across
  wrap: string[] // the fields whose words run onto more lines
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
  about: string | null // the question the view answers
}

// The person's own data (Settings › Data): what the world holds and weighs, and its backups.
export interface BackupView {
  name: string
  at: string // when it was taken
  size: number // bytes
  kind: 'daily' | 'now' | 'before' | 'migration'
}

export interface DataPageView {
  world: { size: number; rows: number; lines: number; version: number }
  files: { size: number; count: number }
  modules: { size: number }
  backups: BackupView[] // newest first
  copyTo: string | null // the folder a copy of the newest backup goes to each day
  exportsTo: string // where Take my data puts the archive
}

// A connector as it describes itself (its manifest): the window draws every one the same way.
export interface ConnectorView {
  name: string
  title: string
  auth: 'secret' | 'oauth' | 'browser' | 'system' | 'path'
  icon: 'mail' | 'calendar' | 'people' | 'network' | 'folder' | 'plug'
  account: { label: string; placeholder?: string }
  secret?: { label: string; help: string; url?: string }
  system?: { pane: string } // the System Settings pane that turns Alpha on after a no
  setup?: { sub: string } // its step on the first open, when it asks for one
  warning?: string // what the person reads before connecting it
  // signed in to with the person's own app: where they make it, and the redirect it must name
  oauth?: { help: string; url?: string; redirect: string }
}

export interface ConnectionView {
  id: string
  connector: string
  title: string
  account: string
  inBrowser: boolean // signed in to in Google Chrome, and read as the person
  loaded: boolean // its connector is in the loaded set; else it waits until that is added
  state: 'connected' | 'needs_sign_in' | 'broken' | 'paused'
  health: string | null
  lastSyncAt: string | null
  tables: { id: string; name: string; hidden: boolean }[] // what it keeps, maybe out of the sidebar
  settings: string | null // the System Settings pane that turns Alpha on, when it needs that
}

export interface ConnectorsView {
  connectors: ConnectorView[]
  connections: ConnectionView[]
  // the packs that came with the release and are not loaded until added (LinkedIn)
  available: { file: string; name: string; title: string; version: string }[]
  added: string[] // the connectors loaded from Alpha's own connectors/, by name
  failed: { folder: string; why: string }[] // folders that did not load at start
}

// An agent as Settings shows it: its trigger in words, on or paused.
export interface AgentView {
  id: string
  name: string
  state: 'on' | 'paused'
  description: string | null
  needs: string | null // what it needs that is not there: "Gmail connected"
  when: string
  lastRunAt: string | null
  running: boolean
  module: { id: string; name: string }
  // each trigger in words, on a time or on an event (proposal 28 Oct §2 #1)
  triggers: { words: string; on: 'time' | 'event' }[]
  nextRunAt: string | null // worked out here from its triggers; null while paused or on events only
  // how its last run ended: what it did, or since when every run has failed
  lastResult: { words: string; ok: boolean; at: string; failedSince: string | null } | null
  fresh: boolean // never turned on: it shows Activate
  // from its file: what it is for, where it works and what it may call (§2 #3)
  brief: string
  reads: { id: string | null; name: string }[] // its needs.tables
  writes: { id: string | null; name: string }[] // its touches
  effects: string[] | null // null: the file says nothing, an older one
  connectors: string[]
  // its settings at a glance (Vikas, 3 Nov): the skills it runs, the documents it is handed, and
  // each gated call it may make, off when a rule of the person's denies it that call
  skills: { name: string; description: string }[]
  documents: string[]
  calls: { name: string; off: string | null }[] // off: the deny rule's id
  tasks: boolean
  function: string // what it does, as the Agents list groups it: Sourcing, Outreach, Admin…
  // why it is not doing its work, with the one action that unblocks it (Vikas, 29 Oct)
  blocked: {
    words: string
    action: { label: string; href: string | null; run: boolean }
  } | null
  // how often it runs, where that is one time on the clock the person can change
  schedule: { every: 'hour' | 'day' | 'week'; at: string | null } | null
}

// A module that does work on its own: from a kit or made in the desk.
export interface WorkingModuleView {
  id: string
  name: string
  kit: {
    name: string
    version: string
    source: string
    api: number
    maintainer: { name: string; address: string } | null
    core: boolean // Alpha's own kit: kept by the core, never uninstalled
    changes: number // changes of the person's a maintained kit's maintainer has not seen
  } | null
  agents: AgentView[]
}

// What of a kit is the person's now: changed files, rows, views and fields, and the fields the kit no longer uses with the rows still under them.
export interface YoursView {
  files: { path: string; state: 'changed' | 'removed' }[]
  rows: { table: string; tableId: string; key: string; id: string; name: string }[]
  views: { table: string; tableId: string; id: string; name: string }[]
  fields: { table: string; tableId: string; id: string; name: string }[]
  removed: { table: string; tableId: string; fieldId: string; name: string; rows: number }[]
}

// A module's head and its parts, for its screen.
export interface ModuleView {
  id: string
  name: string
  people: boolean // People and Organizations are its tabs
  kit: { name: string; version: string } | null
  agents: AgentView[]
  sites: number // how many sites its readers may read
  notes: string // NOTES.md, as written
  parent: string | null
  pages: PageSummary[]
  tables: TableSummary[]
  modules: InsideModuleView[] // the modules inside it
  files: ModuleFileView[] // the files on its rows, newest first
}

// A file on one of a module's rows, with the row it sits on.
export interface ModuleFileView extends RowFileView {
  row: { id: string; name: string; table: string }
}

// A module inside another, as the parent's Overview lists it: where it comes from and what goes on in it now, the modules inside it counted too.
export interface InsideModuleView extends ModuleSummary {
  kit: string | null
  agents: number // on
  running: number
  needs: number // cards waiting on the person
  tasks: number // open
}

// What Alpha remembers: the standing instructions the person gave, for them or for everyone.
export interface InstructionView {
  for: 'me' | 'everyone'
  words: string
}

// The model as the person chooses it: a provider per route, each saying what it can do.
export interface ProviderView {
  route: 'subscription' | 'key' | 'api'
  title: string
  can: string // what it can do, in a line
  cannot: string | null // what another listed provider can and this one cannot
  needsKey: boolean
  chosen: boolean
}

export interface ModelView {
  desk: string
  route: 'subscription' | 'key' | 'api' // their own subscription; the firm's key through Claude Code; the key through Alpha's own loop
  hasKey: boolean // a key is kept in the Keychain
  providers: ProviderView[]
}

// A run in Activity: an agent's or a reader's, or a connection reading its account.
export interface RunView {
  id: string
  // an agent's run, a connection's read, a turn of Alpha's that changed rows, a removal outside
  // both, or a revert the person made
  kind: 'run' | 'read' | 'turn' | 'removal' | 'revert'
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
  // Revert (or Bring back, on a removal) where it wrote rows since Alpha could undo; `what` names
  // it in the pop-up's question and in the line the revert writes
  undo: { target: UndoTarget; label: 'Revert' | 'Bring back'; what: string } | null
}

// What a revert puts back: an agent's run, a turn of Alpha's, or one line (a removal, a revert).
export type UndoTarget = { run: string } | { turn: string } | { line: number }

// What Revert or Bring back would do, said before it does it.
export interface UndoView {
  can: boolean
  words: string
  left: string[]
}

// Today, beside the stream on a wide window: what changed since the person last cleared it, and what is coming up; what needs them and what runs come with the stream.
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

// What the model's use cost over some days (Settings › Usage): by day, model, module and agent,
// with the costliest replies and runs. A reply's cost is the model's own; a run's is estimated
// from its tokens at the desk model's list price.
export interface UsageView {
  days: { day: string; chat: number; runs: number }[] // US dollars
  total: number
  models: {
    model: string
    usd: number
    input: number
    output: number
    cacheRead: number
    cacheWrite: number
    estimated: boolean // some of it counted from tokens at list price
  }[]
  modules: {
    id: string | null
    name: string
    usd: number
    tokens: number
    turns: number
    runs: number
  }[]
  agents: {
    id: string | null
    name: string
    module: string | null
    usd: number
    tokens: number
    runs: number
  }[]
  costly: {
    kind: 'reply' | 'run'
    id: string
    at: string
    words: string
    usd: number
    tokens: number
    module: string | null
  }[]
  cacheShare: number | null // of the tokens read in, how many came from the cache
  prices: {
    model: string
    input: number
    output: number
    cache_read: number
    cache_write: number
  }[]
  desk: string // the model chat and runs use
}

// The Second Brain (GET /api/brain): what each module holds, and the links between modules.
export interface BrainView {
  modules: {
    id: string
    name: string
    rows: number
    tables: number
    agents: number
    documents: number
  }[]
  links: { from: string; to: string; field: string; fromTable: string; toTable: string }[]
  totals: {
    people: number
    organizations: number
    decisions: number
    noticed: number
    followUps: number
  }
}
