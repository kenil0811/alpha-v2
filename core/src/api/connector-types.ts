// The window's contract for Intelligence › Connections, beside types.ts, which re-exports it: the
// connectors loaded, the person's connections and what each may reach.

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
  signsInWith?: { provider: string; title: string } // oauth: whose sign-in
  onComputer?: boolean // runs only on a person's own computer here: lent from the Bridge there
}

// An organisation's sign-in app for a provider: set once by its IT, from the
// setup sheet, before anyone signs in with it.
export interface SignInAppView {
  provider: string
  title: string // Microsoft
  set: { app: string; directory?: string; secret?: boolean } | null // a secret kept is never said
  fields: {
    app: { label: string; example: string }
    directory?: { label: string; example: string } // Microsoft's organisation
    secret?: { label: string; example: string } // Intuit's Client Secret
  }
  sheet: { words: string; copy?: string[] }[]
  console: string // where IT manages the app
}

export interface ConnectionView {
  id: string
  connector: string
  title: string
  account: string
  inBrowser: boolean // signed in to in Google Chrome, and read as the person
  signsInWith: string | null // signed in as the person with a provider (Microsoft): its sign-in page
  loaded: boolean // its connector is in the loaded set; else it waits until that is added
  state: 'connected' | 'needs_sign_in' | 'broken' | 'paused' | 'waiting' // waiting: for the customer's own step, said in health
  owner: string // who set it up: You, a name, or Alpha
  health: string | null
  lastSyncAt: string | null
  tables: { id: string; name: string; hidden: boolean }[] // what it keeps, maybe out of the sidebar
  settings: string | null // the System Settings pane that turns Alpha on, when it needs that
  // what its process may reach (its connector's hosts and those the person approved), and the
  // hosts it was refused, newest first; whether one can be allowed (a connector of chosen sites)
  reaches: string[]
  refused: { host: string; at: string }[]
  canAllow: boolean
  computer: { name: string; online: boolean } | null // the person's computer it runs on (the Bridge)
  leftOut: number // what its last read left out as on the never-use list (rules N1)
}

// A connection that fills a table: Read now on the table reads every one that
// can be read now; one that can't says why, greyed (W3).
export interface ReadByView {
  connection: string
  title: string // Gmail
  account: string
  reason: string | null // why it can't be read now: a sign-in, or the customer's own step
  lastReadAt: string | null
}

export interface ConnectorsView {
  connectors: ConnectorView[]
  connections: ConnectionView[]
  added: string[] // the connectors loaded from Alpha's own connectors/, by name
  failed: { folder: string; why: string }[] // folders that did not load at start
  signInApps: SignInAppView[] // for the providers the loaded connectors sign in with
}

// A person's computer paired through the Bridge: whether it is connected now, and what it lends.
export interface ComputerView {
  id: string
  name: string // as it calls itself (Kenil's MacBook Pro)
  platform: string // darwin, win32
  online: boolean
  paused: { until: string | null } | null // by its person, for a while or until resumed
  pairedAt: string | null // none: the computer Alpha itself runs on (This Mac)
  lastSeenAt: string | null
  version: string | null // the Bridge it runs, while it is connected
  here: boolean // the computer Alpha itself runs on: its folders are added by path, not lent
  browser: boolean // Alpha Bridge's Browser switch is on there (while it is connected)
  sites: { site: string; at: string }[] // the sites its person signed in to there for Alpha
  lends: {
    connection: string
    connector: string
    title: string // Folder, Calendar, Contacts
    account: string
    state: ConnectionView['state']
    health: string | null
  }[]
}

// The Bridge's downloads this Alpha has, signed by Kenil.
export interface BridgeDownload {
  platform: string // darwin-arm64, win-x64
  title: string // Mac with an Apple chip
  url: string
  kind: 'installer' | 'zip' // the app, or step 1's zip run in a terminal
}

export interface ComputersView {
  computers: ComputerView[] // This Mac first, on the Mac app
  downloads: BridgeDownload[]
}

// A computer's own page: the computer, what it lends as connections, and its latest reads.
export interface ComputerPageView {
  computer: ComputerView
  lends: ConnectionView[]
  did: { id: number; at: string; words: string; failed: boolean }[] // newest first
}
