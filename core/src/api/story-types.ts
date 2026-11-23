// The window's contract for Set up Alpha, the first run told as a story of chapters (the 22 Nov
// onboarding redesign), beside types.ts, which re-exports it: where a person's story stands, and
// what each chapter's screen shows. Every count and every "connected" here comes from code.

export type ChapterState = 'done' | 'skipped' | 'now' | 'ahead'

export interface StoryView {
  chapters: { key: string; title: string; state: ChapterState }[]
  at: string | null // the chapter the person is on; none once they finished
  done: boolean
  declined: boolean
  fresh: boolean // nothing gone through yet: the window opens the story by itself
  row: string | null // Home's one row while the story waits; none once finished or declined
}

// A chapter's screen: its title, and the one line Alpha's face says at the top.
interface Screen {
  key: string
  title: string
  says: string
}

export interface WelcomeScreen extends Screen {
  key: 'welcome'
  promises: string[]
  workspace: string | null // a member's: the workspace they were added to
  addedBy: string | null // a member's: who added them
}

export interface ClaudeScreen extends Screen {
  key: 'claude'
  how: 'token' | 'signin' // a server takes a token; a Mac signs in in the browser
  set: boolean // Alpha reaches Claude now
  steps: string[] // what to do, in order
  command: string | null // what to run in Terminal, on a server, shown to copy
}

export interface WorkspaceScreen extends Screen {
  key: 'workspace'
  name: string | null
  suggested: string | null // the name guessed from the owner's own mail domain
  picture: boolean
  for: string | null // who the work is for, in the owner's own words (not asked on the first run)
  use: 'business' | 'personal' | null // a business may need its admin's approval later
  site: string | null // the site given
  guess: string | null // the site guessed from the email's domain, never a mail provider's
}

// Your accounts, and Your computer: the same tiles, the computer's on a step of its own
export interface ConnectScreen extends Screen {
  key: 'connect' | 'computer'
  tiles: ConnectTile[]
}

// A connection as a tile shows it: whose it is, how it stands, and what it holds, counted by code.
export interface TileConnection {
  id: string
  connector: string
  account: string
  state: string
  by: string // who connected it: You, a name, or Alpha
  landed: string[] // "412 mails"
}

// One tile of Connect (the redesign's calls 8 to 14): what it reads, said before anything is
// connected, the connectors it connects in place, and what has landed. Each keeps its size from
// the first frame: a tile that connects changes its words, never its shape.
export interface ConnectTile {
  key: string
  kind: 'connector' | 'calendar' | 'computer' | 'apps' | 'file'
  title: string
  reads: string
  connectors: string[] // connected in place, by name, as Settings › Connections connects them
  steps: { words: string; url: string | null }[] // a guided setup before the form (Gmail's)
  connections: TileConnection[]
  landed: string[] // what landed beyond its connections (Network filling, this month's events)
  note: string | null
  waits: string | null // what it waits on where nothing is pressed on it (a server's calendar)
  apps: AppFound[] // Apps you use, from the person's computer and mail
  // Apps you use: the computer's Apps reader where it comes with this Alpha, its connection once on
  reader: { id: string | null; read: boolean } | null
  server: boolean // the computer tile: Alpha runs on a server, so a computer pairs through Alpha Bridge
}

// An app the person uses: on their computer, as Alpha Bridge's Apps reader listed it (when it was
// last used and how often), or among their mail's senders (how many mails), or both; and how Alpha
// reaches it where it knows the app (a connector that ships, or its site, signed in to in Alpha's
// browser).
export interface AppFound {
  name: string
  last: string | null
  times: number | null
  mails: number
  site: string | null
  connector: string | null
  connected: boolean
}

export interface PeopleScreen extends Screen {
  key: 'people'
  people: { id: string; name: string; email: string | null; state: 'waiting' | 'in' }[]
  sees: string // what they will see on their first sign-in
}

export interface HereScreen extends Screen {
  key: 'here'
  workspace: string
  modules: { name: string; line: string | null }[]
  agents: { name: string; title: string }[]
  people: string[]
  shared: string // what is shared, said only as it is true today
}

export interface DoneScreen extends Screen {
  key: 'done'
  connected: string[]
  people: string[] // who the owner added
  none: string // what to say where nothing is connected: the owner's and a member's differ
  repeat: boolean // a box for something they repeat, where no plugin offers what to build
}

// A chapter a plugin adds: its own screen's fields beside these, drawn by its own window part.
export interface PluginScreen extends Screen {
  plugin: string
  [field: string]: unknown
}

export type ChapterScreen =
  | WelcomeScreen
  | ClaudeScreen
  | WorkspaceScreen
  | ConnectScreen
  | PeopleScreen
  | HereScreen
  | DoneScreen
  | PluginScreen
