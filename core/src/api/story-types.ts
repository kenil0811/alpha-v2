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
}

export interface WorkspaceScreen extends Screen {
  key: 'workspace'
  name: string | null
  picture: boolean
  for: string | null // who the work is for, in the owner's own words
  kinds: string[] // the words offered for it, with a box for any other
  site: string | null // the site given
  guess: string | null // the site guessed from the email's domain, never a mail provider's
}

export interface ConnectScreen extends Screen {
  key: 'connect'
  connections: {
    id: string
    title: string // Gmail
    account: string
    state: string
    by: string // who connected it: You, a name, or Alpha
    landed: string[] // what it holds, counted by code ("412 mails")
  }[]
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
