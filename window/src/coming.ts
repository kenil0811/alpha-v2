// What the core does not send yet, read as optional: a screen shows each field once its core PR
// lands and nothing until then (Vikas, 1 Nov: the screens as designed now, their core after).
// Each field names the core PR that brings it; when it lands, its line here goes. A route the core
// does not have yet answers 404, and the part that reads it stays hidden (see `soon` in api.ts).
import type * as Core from '@alpha/core/api'

type Agent = { id: string; name: string }

export type Me = Core.Me & {
  textSize?: 'small' | 'medium' | 'large' | undefined // P1
}

export type Layout = Core.Layout &
  Partial<{
    pins: Record<string, string[]> // P1
    seen: Record<string, number> // P1
    docked: string[] | null // P1
    arrange: Record<string, string[][]> // P1
  }>

export type FieldView = Core.FieldView & {
  relatesTo?: string | null | undefined // P12
}

export type CardView = Omit<Core.CardView, 'proposed'> & {
  proposed?: ProposedView | null | undefined
  agent?: Agent | null | undefined // P2
  run?: string | null | undefined // P2
  task?: string | null | undefined // P2
  createdAt?: string | undefined // P2
  failed?: { agent: string; name: string; words: string; times: number }[] | null | undefined // P6
}

export type StreamLine = Core.StreamLine & {
  agent?: Agent | null | undefined // P2
  run?: string | null | undefined // P2
}

export type Stream = Omit<Core.Stream, 'lines' | 'cards'> & {
  lines: StreamLine[]
  cards: CardView[]
}

type Proposed = Core.ProposedView['tasks'][number] & {
  word?: 'add' | 'decline' | null | undefined // P7
}
export type ProposedView = Omit<Core.ProposedView, 'tasks'> & { tasks: Proposed[] }

export type WorkingModuleView = Omit<Core.WorkingModuleView, 'agents'> & { agents: AgentView[] }

type ReviewRow = Core.ReviewView['rows'][number] & {
  also?: string | null | undefined // P17
}
export type ReviewView = Omit<Core.ReviewView, 'rows'> & { rows: ReviewRow[] }

export type RuleView = Core.RuleView & {
  agent?: string | null | undefined // P9
  card?: string | undefined // P9
}

export type AgentView = Core.AgentView &
  Partial<{
    module: Agent // P4
    triggers: { words: string; on: 'time' | 'event' }[] // P4
    nextRunAt: string | null // P4
    lastResult: { words: string; ok: boolean; at: string; failedSince: string | null } | null // P4
    fresh: boolean // P4
    brief: string // P4
    reads: { id: string | null; name: string }[] // P4
    writes: { id: string | null; name: string }[] // P4
    effects: string[] | null // P4
    connectors: string[] // P4
    tasks: boolean // P4
    function: string // P4
    blocked: { words: string; action: { label: string; href: string | null; run: boolean } } | null // P4
    schedule: { every: 'hour' | 'day' | 'week'; at: string | null } | null // P4
  }>

export type ModuleSummary = Core.ModuleSummary & {
  about?: string | null | undefined // P10
}

export type ModuleFileView = Core.RowFileView & { row: { id: string; name: string; table: string } }

export type ModuleView = Core.ModuleView & {
  files?: ModuleFileView[] | undefined // P10
}

// P3: one card in full, for the side panel
export interface CardAbout {
  card: CardView
  agent: Agent | null
  runs: { id: string; state: string; words: string | null; startedAt: string }[]
  history: { id: number; at: string; words: string }[]
}

// P17: first-run onboarding
export interface FootprintSource {
  id: string
  title: string
  unit: string
  sub: string
  count: number | null
  needs: string | null
  ticked: boolean
  read: { at: string; read: number; skipped: number; why: string | null; items: string[] } | null
}
export interface FootprintView {
  sources: FootprintSource[]
  countedAt: string | null
  site: string | null
  denied: boolean
  memoryPrompt: string
  memory: FootprintSource['read']
  card: string | null
  done: boolean
}

// P16: Interview me
export interface InterviewView {
  at: string | null
  today: boolean
  preparing: boolean
  questions: number
  left: number
  first: string | null
}

// P11: the Second Brain
export interface BrainView {
  modules: {
    id: string
    name: string
    rows: number
    tables: number
    agents: number
    documents: number
  }[]
  links: { from: string; to: string; field: string; fromTable: string; toTable: string }[]
  totals: {
    people: number
    organizations: number
    decisions: number
    noticed: number
    followUps: number
  }
}
