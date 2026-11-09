// What the window may import from the core: the shapes of the api, never its code.
import type { ReadByView } from './connector-types.ts'
import type { FieldView } from './row-types.ts'

export interface Health {
  ok: true
  version: string
  build: string | null // the window this core serves: a window on another build reloads
}

export type {
  ConnectionView,
  ConnectorsView,
  ConnectorView,
  ReadByView,
  SignInAppView,
} from './connector-types.ts'
export type { Layout, Me } from './me-types.ts'
export type { FieldView, Pick, RowAround, RowPageView } from './row-types.ts'

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
  actor: 'person' | 'alpha' | 'schedule' | 'connector' | 'system'
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
  draft?: DraftView | null // a schedule's email for the person's yes
  match?: MatchView | null // people or companies that may be one, side by side
  review?: ReviewView | null // rows a schedule puts to the person, a choice on each
}

// Rows a schedule puts to the person on one card: each with why, and the choices it offers.
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

// A person's or company's page.
export interface PersonView {
  id: string
  // their rows in the one-row-per-person tables of People's module (core step 3d)
  per: { table: { id: string; name: string }; fields: FieldView[]; row: RowView | null }[]
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

// A schedule's draft on its card: the email to change, what it is about, the Not now reasons, and Always when three unchanged sends of its kind have earned it.
export interface DraftView {
  schedule: string
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
  where: string // all of Alpha, a module or a schedule, in words
  module: string | null
  madeBy: string
  madeAt: string
  uses: number
  lastUsedAt: string | null
  revokedAt: string | null
  always: boolean // a standing permission given with Always
  noticedFrom: { id: number; at: string; words: string }[] // the lines Alpha noticed it in
}

// A rule waiting on its Save card (Batch B, pick 18): Approve and Decline answer the card itself,
// by its yes and no as their words.
export interface WaitingRuleView {
  card: string
  words: string // the rule as it would hold, in code's own words
  side: 'allow' | 'deny'
  where: string // all of Alpha, a module or a schedule, in words
  askedAt: string
  yes: string
  no: string
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

export interface Stream {
  lines: StreamLine[]
  cards: CardView[] // every card waiting for the person
  asked: string[] // those raised by agents this conversation asked
  busy: boolean
  running: { id: string; name: string; module: string | null }[] // schedules' runs going now
  reading: { connection: string; title: string; account: string }[] // connections being read now
  // connections that need the person to sign in; one read as them signs in in Chrome
  // connections that need the person: a sign-in, or the customer's own step (waiting, with what)
  attention: {
    connector: string
    title: string
    connection: string
    inBrowser: boolean
    signsInWith: string | null // signed in as the person with a provider (Microsoft)
    waiting: string | null
  }[]
  tasks: { open: number; overdue: number; today: number } // for the rail's badge
  settingUp: string | null // what the core is still putting in after it started (the kits)
  lastId: number
}

export interface TableSummary {
  id: string
  name: string
  rows: number
  place: 'main' | 'part' | 'setup' | 'people' // a tab, on its row (`of`), setup, People's columns
  of: string | null
  tab: boolean // a part or setup table kept as a tab too (28 Oct)
}

export interface ModuleSummary {
  id: string
  name: string
  parent: string | null // the module it sits inside
  people: boolean // People and Organizations are its tabs (module.yaml people: true)
  pages: PageSummary[]
  tables: TableSummary[]
}

// A module's page (design §13): the file's name, its title, and whether the module opens on it.
export interface PageSummary {
  name: string
  title: string
  front: boolean
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
  // beside a value the person typed over: what a page or a connection read since, or what Alpha
  // works it out as now (rules D3), which Reset brings back
  beside?: { value: unknown; words: string; reset: string; note?: string }
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
  read?: { from: string; at: string } // a mirror's row: when its system was last read (D12)
  gone?: string // when its source deleted it; kept, out of the default list (D8)
}

export interface TableView {
  id: string
  name: string
  about: string | null // one sentence on what a row of it is
  aboutBy: 'kit' | 'alpha' | 'person' | null
  module: { id: string; name: string }
  mirror: string | null // the system that keeps its rows' record (rules D1)
  managed: string | null // who manages its module, when it is managed: its shape is fixed (M2)
  fields: FieldView[]
  documents: string[] | null // the kinds of document its rows take, when it names them
  rows: RowView[]
  names: Record<string, string> // the rows its relations point at and the people it holds, by name
  views: SavedView[]
  readBy: ReadByView[] // the connections that fill it, read again from its ⋮ (Batch B, pick 15)
}

// A list kept outside a module's tables (people, organizations, tasks, schedules, standing
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
  exportsTo: string // where Take my data puts the archive
}

// A schedule as Settings shows it: its trigger in words, on or paused.
export interface ScheduleView {
  id: string
  name: string
  state: 'on' | 'paused'
  description: string | null
  needs: string | null // what it needs that is not there: "Gmail connected"
  when: string
  lastRunAt: string | null
  running: boolean
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
  schedules: ScheduleView[]
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
  kit: {
    name: string
    version: string
    maintainer: { name: string; address: string } | null
    core: boolean
    changes: number
  } | null
  schedules: ScheduleView[]
  sites: number // how many sites its readers may read
  notes: string // NOTES.md, as written
  // what it is for (core step 3e), and whose words: the kit's, Alpha's (assumed) or the person's
  businessCase: {
    for: string
    keeps: string
    decides: string
    by: 'kit' | 'alpha' | 'person'
  } | null
  parent: string | null
  pages: PageSummary[]
  tables: TableSummary[]
  modules: InsideModuleView[] // the modules inside it
}

// A module inside another, as the parent's Overview lists it: where it comes from and what goes on in it now, the modules inside it counted too.
export interface InsideModuleView extends ModuleSummary {
  kit: string | null
  schedules: number // on
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
  route: 'subscription' | 'key'
  title: string
  can: string // what it can do, in a line
  cannot: string | null // what another listed provider can and this one cannot
  needsKey: boolean
  chosen: boolean
}

export interface ModelView {
  desk: string
  route: 'subscription' | 'key' // their own subscription; the firm's key through Claude Code
  hasKey: boolean // a key is kept in the Keychain
  providers: ProviderView[]
}

// A run in Activity: a schedule's or a reader's, or a connection reading its account.
export interface RunView {
  id: string
  // a schedule's run, a connection's read, Alpha's turn changing rows, a removal, a person's revert
  kind: 'run' | 'read' | 'turn' | 'removal' | 'revert'
  name: string
  module: string | null // its name
  moduleId: string | null
  startedAt: string
  ms: number | null // how long it took, once it ended
  state: 'running' | 'ok' | 'failed' | 'stopped'
  words: string | null
  tokens: number | null // null: no model was used
  usd: number | null // what its uses of the model cost (core plan step 5); null: none, or unknown
  quiet: boolean // it ended and changed nothing
  steps: { id: number; at: string; kind: string; words: string }[]
  // Revert, or Bring back a removal, where it wrote rows; `what` names it in the pop-up and line
  undo: { target: UndoTarget; label: 'Revert' | 'Bring back'; what: string } | null
}

// What a revert puts back: a schedule's run, a turn of Alpha's, or one line (a removal, a revert).
export type UndoTarget = { run: string } | { turn: string } | { line: number }

// What Revert or Bring back would do, said before it does it.
export interface UndoView {
  can: boolean
  words: string
  left: string[]
}

export type LiveEvent =
  | { type: 'lines'; agent?: string }
  | { type: 'live'; turn: string; text: string; doing: string | null; agent?: string }
  | { type: 'busy'; turn: string; agent?: string }
  | { type: 'idle'; agent?: string }

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
  owner: string // in words: You or Alpha
  ownerKind: 'person' | 'alpha'
  place: { words: string; path: string[]; href: string | null }
  parent: string | null
  children: number
  childrenDone: number
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
  owners: { kind: 'person' | 'alpha'; id: string | null; name: string }[]
}

// An agent as the window reads it (clean base step 7); the Chief of staff is first and has no row.
export interface AgentView {
  id: string
  name: string
  title: string
  description: string
  model: string | null
  chief: boolean
}

export interface MemoryView {
  id: string
  text: string
  essential: boolean
  yours: boolean // a person wrote or edited it: the agent cannot change it
  firm: boolean // for everyone here, not only this person
  at: string
}

export interface AgentDetail extends AgentView {
  instructions: string
  skills: { name: string; description: string }[]
  files: string[]
  memories: MemoryView[]
}
