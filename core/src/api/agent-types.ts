// An agent and its schedules as the window reads them.

// An agent as the window reads it; the Chief of staff is first and has no row.
export interface AgentView {
  id: string
  name: string
  title: string
  description: string
  model: string // what it runs on now
  chief: boolean
  // where it came from: Alpha's own, a kit's (its module), or made here; a shipped one changes
  // only with its source
  from: {
    kind: 'alpha' | 'kit' | 'here'
    label: string
    name: string | null
    module: string | null
  }
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
  tasks: { id: string; title: string; state: string }[]
  schedules: AgentScheduleView[]
  sites: string[] // the sites it opens with no card, shared with its scripts and shell (sites.yaml)
}

export interface ScheduleRunView {
  id: string
  at: string
  words: string // how it came out, in a few words
  task: string | null // the work it woke the agent for
  usd: number | null
}

export interface AgentScheduleView {
  id: string
  name: string
  state: 'on' | 'paused'
  what: string // what the agent does at each run
  when: string // in words
  every: { every: string; at: string | null } | null // none: a pattern the page does not edit
  hasCheck: boolean
  next: string | null
  lastRunAt: string | null
  running: boolean
  agent: { id: string; name: string }
  runs: ScheduleRunView[] // newest first
}
