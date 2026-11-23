// The window's contract for Settings › Connections, beside types.ts, which re-exports it: the
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
  alpha: boolean // Alpha's own app (core/config/signin.yaml): the person only signs in
  consent: string | null // where a business's admin approves Alpha's own app, once
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

// One account a person reads, as one line in Connect and in Settings › Connections (Vikas,
// 23 Nov): its address, how it stands, and what landed, counted by code. A Google account is one
// line for its sign-in (calendar and contacts) and its mail (an app password, while Google's mail
// scope waits on its review); a Microsoft account one line for its sign-in.
export interface AccountLine {
  key: string // provider:address
  provider: string // google, microsoft, or another mail connector's own name
  title: string // Google, Microsoft, or that connector's title
  account: string
  // connected: a green dot; reading: its first read runs; off: disconnected; failed: it asks
  // something of the person (a sign-in, a password, their IT)
  state: 'connected' | 'reading' | 'off' | 'failed'
  problem: string | null // what a failed one asks, in words
  landed: string[] // "412 mails", "30 events"
  reads: string[] // for its ⓘ: what it reads
  by: string // who connected it: You, a name, or Alpha
  connections: { id: string; connector: string; auth: string; state: string }[]
  // a Google line can add its mail (an app password) or its calendar and contacts (the sign-in)
  adds: ('mail' | 'calendar')[]
}

// What a person excluded, kept so it can come back: an account they deleted, or an app they left
// out of Apps you use.
export interface ExcludedView {
  kind: 'account' | 'app'
  provider: string // an account's provider; an app's is "app"
  name: string // the address, or the app's name
  title: string // Google, Microsoft, a connector's title, or "App"
}

export interface AccountsView {
  lines: AccountLine[]
  excluded: ExcludedView[]
  // each provider's one sign-in: ready to sign in (Alpha's own app, or the firm's set up), and
  // Microsoft's admin approval link for Alpha's own app
  google: { loaded: boolean; ready: boolean; mail: boolean }
  microsoft: { loaded: boolean; ready: boolean; consent: string | null }
  other: string[] // other mail connectors, by name, for Add › Other mail
  appPassword: { words: string; url: string | null }[] // Gmail's app password, step by step
  owner: boolean // setting up a provider's sign-in app is the owner's
  ownerName: string
}
