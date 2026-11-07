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
  // A web address opened in the person's own browser (a provider's sign-in page); false where
  // the core cannot, and the window opens it instead.
  openLink(url: string): boolean
  // A file or folder of the person's discarded on their word: the Mac's Trash where there is one.
  discard(path: string): void
}
