// A run of onboarding as it is kept and as the window reads it (GET /run): what it started from,
// every look and what it got, the answer as checked, and what the person did with it.
import type { Checked } from './answer.ts'

export interface Run {
  id: string
  at: string
  state: 'looking' | 'done' | 'failed'
  problem?: string
  overview: string // what it started from
  ids: string[]
  counts: Record<string, number>
  // every look, with what it got: all of it went to Claude
  calls: { id: string; tool: string; input: unknown; output: unknown }[]
  checked: Checked | null
  answered: Record<string, string> // a question's place, the person's answer
  decided: Record<string, 'added' | 'declined'> // suggestion:2, routine:0
}

// A card of the one-at-a-time cards (cards.ts), and the card as the page shows it.
export interface CardDef {
  name: string
  title: string
  reads: string
  never: string // what it leaves alone
  connect: string[] // the connectors Allow connects; none: connected in Connections (mail)
  parts?: Record<string, string[]> // the parts that must be readable, by connector
}

export interface Found {
  lines: string[] // what was found, in words
  ticks?: { item: string; sub: string; on: boolean }[] // sites or folders, each on or left out
  reading?: boolean // connected, its first read still landing
}

export interface CardView extends CardDef {
  at: number // its place, from 1
  of: number
  said: 'allowed' | 'skipped' | null
  connected: boolean
  states: Record<string, string> // each part the card needs, in the five words
  ready: boolean // what it needs can be read
  mail?: { name: string; title: string; connected: boolean }[]
  found: Found | null
  problem?: string | null
}

export type { Checked }
