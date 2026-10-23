// Runs (design §11): a run's outcome, who it is for, its row, a proposed task, a filing.
import { parse as fromJson } from '../../world/db.ts'

export interface RunOutcome {
  id: string
  state: 'ok' | 'failed' | 'stopped'
  words: string
  result: unknown
}

export interface RunFor {
  user: string | null
  turn: string | null
  task?: string | null
}

// A task an agent proposes, as it would be added on the person's yes.
export interface ProposedTask {
  title: string
  notes: string | null
  due: string | null
  priority: 'high' | 'normal' | 'low'
  on: { table?: string; row?: string; field?: string; page?: string; module?: string } | null
  owner: 'person' | 'agent' // the agent's own: it takes it, and works on it when started
}

export const PROPOSE_TASKS = 'propose_tasks'

export interface RunRow {
  id: string
  agent: string | null
  module: string | null
  startedAt: string
  endedAt: string | null
  state: 'running' | 'ok' | 'failed' | 'stopped'
  words: string | null
  tokens: number | null // the model's, when the run asked it to read something
  task: string | null // the task it served
}

export const CHANGE_KINDS = ['wrote', 'changed', 'landed', 'removed']

// What a filing hands the agents waiting on one: each document read or put on a row since they
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
  agent_id: string | null
  module_id: string | null
  started_at: string
  ended_at: string | null
  state: RunRow['state']
  words: string | null
  data: string
  task_id: string | null
}

export function toRun(r: RunRowDb): RunRow {
  return {
    id: r.id,
    agent: r.agent_id,
    module: r.module_id,
    startedAt: r.started_at,
    endedAt: r.ended_at,
    state: r.state,
    words: r.words,
    tokens: fromJson<{ tokens?: number | null }>(r.data, {}).tokens ?? null,
    task: r.task_id,
  }
}
