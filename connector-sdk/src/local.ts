// What a connector may read of the computer it runs on (onboarding design §4): one reader the
// core's platform layer gives it, the same on every computer. On a Mac a helper reaches what Node
// cannot and returns raw rows; counting, filters and words are shared code. Every moment is an
// ISO string, a folder one of three names, an access one of five words: nothing here names an
// operating system, so a Windows reader is one more file in the core, not a rewrite.

// Where a part stands: readable now; the computer will ask the person at the first read; the
// person must switch Alpha on in the computer's settings; not on this computer; refused.
export const ACCESS = ['ready', 'ask', 'settings', 'absent', 'refused'] as const
export type Access = (typeof ACCESS)[number]

export const FOLDERS = ['documents', 'desktop', 'downloads'] as const
export type Folder = (typeof FOLDERS)[number]

// A page seen in a browser: raw, counted and dropped, never kept.
export interface Visit {
  url: string
  title: string
  at: string
}

export interface Browser {
  id: string // chrome, safari
  name: string // Google Chrome
  format: 'chromium' | 'safari'
}

// An app on the computer, with its last use and how often it was opened where the computer keeps them.
export interface AppSeen {
  id: string
  name: string
  lastUsed?: string
  launches?: number
}

// The time spent in an app on one of the person's days.
export interface AppTime {
  id: string
  day: string // 2026-10-31, the person's own day
  seconds: number
}

// A name in one of the three folders: its path inside it, its kind (an extension, folder, or
// project for a folder with its own version history, not walked) and when it changed. Never what
// is in it.
export interface FileSeen {
  folder: Folder
  path: string
  kind: string
  modified: string
}

export interface LocalReader {
  // a part's state; where, in the platform's own words, it is switched on
  access(part: string): Promise<{ state: Access; where?: string }>
  browsers(): Promise<Browser[]>
  visits(browser: string, since: string): Promise<Visit[]>
  apps(): Promise<AppSeen[]>
  appTime(since: string): Promise<AppTime[]>
  files(folder: Folder): Promise<FileSeen[]>
  // the computer's settings for a part, opened with Alpha shown beside them to switch on or drag in
  showSettings(part: string): void
}
