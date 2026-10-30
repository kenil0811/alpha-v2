// The pieces of a computer the core needs and cannot reach the same way everywhere (decision 12,
// step 4): secrets, a notification, keeping the machine awake, its settings, the person's name,
// the region. One interface; a Mac implementation and a plain one; `process.platform` is read in
// one file (index.ts). The server shape later is a linux.ts here, not a search through the core.
import type { SecretStore } from '@alpha/connector-sdk'

export interface Platform {
  readonly name: 'mac' | 'plain'
  // what this computer can do; where it cannot, the plain words are said where a person looks
  readonly can: { notify: boolean; keepAwake: boolean; settings: boolean }
  // The secret store, and the helper app it runs through where there is one (the Mac's
  // Keychain through Alpha's helper; built in development when its source changed).
  secrets(helper: string | null): { store: SecretStore; helper: string | null }
  // A notification outside Alpha's window (a reminder due while the window is closed).
  notify(title: string, words: string): void
  // The machine kept from sleeping while the core runs (plugged in; the screen still turns off).
  keepAwake(on: boolean): void
  // The system's own settings opened at a pane (Privacy & Security › Contacts); refused in
  // words where there is none.
  openSettings(pane: string): void
  // The computer's own name for its user, else the account name.
  personName(): string
  // The region phone numbers are read in (SG), else none.
  region(): string | null
  // A file or folder of the person's discarded on their word: the Mac's Trash where there is one.
  discard(path: string): void
  // Where this computer keeps what onboarding reads from the footprint (step 2), for one home.
  places(home: string): Places
}

// Named here, read by the footprint's readers, which open only what browsers.ts allows.
export interface Places {
  apps: string[] // the folders apps are installed in
  app: string // what marks an app there (.app, .lnk)
  pinned: () => string[] // the apps kept at hand, by name
  pinnedIn: string // where they are kept (the Dock, the taskbar)
  recent: (days: number) => string[] // files opened lately, by path
  chromium: [string, string][] // [browser, its user-data folder]
  firefox: string[] // the folders Firefox's profiles are in
  safari: string | null
  plist: ((file: string) => string) | null // a property list as XML, where the computer has the tool
  access: string | null // the system switch a refused read needs (Full Disk Access), where there is one
}
