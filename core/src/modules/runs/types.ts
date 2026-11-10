// Runs: a run's outcome, who it is for, its row, a proposed task, a filing.
import { parse as fromJson } from '../../world/db.ts'

// The card that asks whether a schedule that did not finish three times runs again or is left.
export const RUN_AGAIN = 'run_again'

export interface RunOutcome {
  id: string
  state: 'ok' | 'failed' | 'stopped'
  words: string
  result: unknown
}

// Where a script runs from: a module, or an agent's folder (no module), where its script keeps to
// its own box.
export interface RunPlace {
  id: string | null
  name: string
  dir: string
  box?: string
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
  task: string | null // the task it woke an agent with
  quiet: boolean // its check found nothing
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
    task: fromJson<{ task?: string | null }>(r.data, {}).task ?? null,
    quiet: fromJson<{ quiet?: boolean }>(r.data, {}).quiet === true,
  }
}
