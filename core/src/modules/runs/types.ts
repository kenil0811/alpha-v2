// Runs (design §11): a run's outcome, who it is for, its row, a proposed task, a filing.
import { parse as fromJson } from '../../world/db.ts'

// The card that asks whether a schedule that did not finish three times runs again or is left.
export const RUN_AGAIN = 'run_again'

export interface RunOutcome {
  id: string
  state: 'ok' | 'failed' | 'stopped'
  words: string
  result: unknown
}

export interface RunFor {
  user: string | null
  turn: string | null
}

export interface RunRow {
  id: string
  schedule: string | null
  module: string | null
  startedAt: string
  endedAt: string | null
  state: 'running' | 'ok' | 'failed' | 'stopped'
  words: string | null
  tokens: number | null // the model's, when the run asked it to read something
}

export const CHANGE_KINDS = ['wrote', 'changed', 'landed', 'removed', 'reverted']

// What a filing hands the schedules waiting on one: each document read or put on a row since they
// last looked, with the rows it sits on.
export interface Filed {
  file: string
  name: string
  document: string
  kind: string // sheet, pdf, text
  rows: { table: string; row: string; kind: string | null }[]
}

export interface RunRowDb {
  id: string
  schedule_id: string | null
  module_id: string | null
  started_at: string
  ended_at: string | null
  state: RunRow['state']
  words: string | null
  data: string
}

export function toRun(r: RunRowDb): RunRow {
  return {
    id: r.id,
    schedule: r.schedule_id,
    module: r.module_id,
    startedAt: r.started_at,
    endedAt: r.ended_at,
    state: r.state,
    words: r.words,
    tokens: fromJson<{ tokens?: number | null }>(r.data, {}).tokens ?? null,
  }
}
