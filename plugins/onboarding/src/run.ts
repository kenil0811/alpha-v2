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

export type { Checked }
