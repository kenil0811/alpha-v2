// The window's contract for Intelligence › Connections, beside types.ts, which re-exports it: the
// connectors loaded, the person's connections and what each may reach (step 2, part 1, slice 2).

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
  // what its process may reach (its connector's hosts and those the person approved), and the
  // hosts it was refused, newest first; whether one can be allowed (a connector of chosen sites)
  reaches: string[]
  refused: { host: string; at: string }[]
  canAllow: boolean
}

export interface ConnectorsView {
  connectors: ConnectorView[]
  connections: ConnectionView[]
  // the packs that came with the release and are not loaded until added (LinkedIn)
  available: { file: string; name: string; title: string; version: string }[]
  added: string[] // the connectors loaded from Alpha's own connectors/, by name
  failed: { folder: string; why: string }[] // folders that did not load at start
}
