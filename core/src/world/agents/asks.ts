// One agent asking another (clean base step 7): each ask is a saved row delivered once. Alpha
// counts the asks of one person's request and the hops of a chain, so a model cannot reset them.
import { createHash } from 'node:crypto'
import { all, type Db, newId, now, one, parse, run } from '../db.ts'
import { Refused } from '../kinds.ts'

export type AskState = 'queued' | 'running' | 'answered' | 'failed' | 'stopped' | 'unknown'
export const OPEN: AskState[] = ['queued', 'running']

// A turn that serves a teammate's request carries the ask in its id: `a<ask>`, and `a<ask>.<n>` for
// the turn that reads the answers it was itself waiting on.
export const askOfTurn = (turn: string | null | undefined): string | null =>
  turn?.startsWith('a') ? (turn.slice(1).split('.')[0] ?? null) : null

export interface Brief {
  objective: string
  known: string
  answerWanted: string
  limits: string
  direct?: { said: number } | undefined // the person named this agent: their own message, not a teammate's
}

export interface Answer {
  status: 'done' | 'blocked' | 'failed'
  result: string
  evidence?: string | undefined
  unblock?: string | undefined
}

export interface AgentAsk {
  id: string
  root: string // the turn of the person's request that started the chain
  user: string
  from: string // the agent asking
  fromTurn: string
  parent: string | null // the ask the asker was itself answering
  to: string
  hop: number
  brief: Brief
  state: AskState
  answer: Answer | null
  reported: boolean // its answer has reached the asker's conversation
  createdAt: string
}

interface AskRow {
  id: string
  root: string
  user_id: string
  from_agent: string
  from_turn: string
  parent: string | null
  to_agent: string
  hop: number
  brief: string
  state: AskState
  answer: string | null
  reported: number
  created_at: string
}

const toAsk = (r: AskRow): AgentAsk => ({
  id: r.id,
  root: r.root,
  user: r.user_id,
  from: r.from_agent,
  fromTurn: r.from_turn,
  parent: r.parent,
  to: r.to_agent,
  hop: r.hop,
  brief: parse(r.brief, { objective: '', known: '', answerWanted: '', limits: '' }),
  state: r.state,
  answer: r.answer ? parse(r.answer, null) : null,
  reported: !!r.reported,
  createdAt: r.created_at,
})

const same = (t: string) => t.trim().toLowerCase().replace(/\s+/g, ' ')

export class AgentAsks {
  private db: Db

  constructor(db: Db) {
    this.db = db
  }

  // Asked once: the same objective to the same agent in one chain is refused.
  add(
    a: Pick<AgentAsk, 'root' | 'user' | 'from' | 'fromTurn' | 'parent' | 'to' | 'hop' | 'brief'>,
  ) {
    const key = createHash('sha256')
      .update([a.root, a.to, same(a.brief.objective)].join('\n'))
      .digest('hex')
    if (one(this.db, 'SELECT id FROM agent_asks WHERE key = ?', key))
      throw new Refused('That was already asked of this agent in this chain.')
    const id = newId('ask')
    run(
      this.db,
      `INSERT INTO agent_asks (id, root, user_id, from_agent, from_turn, parent, to_agent, hop, key, brief, state, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'queued', ?)`,
      id,
      a.root,
      a.user,
      a.from,
      a.fromTurn,
      a.parent,
      a.to,
      a.hop,
      key,
      JSON.stringify(a.brief),
      now(),
    )
    return this.get(id) as AgentAsk
  }

  get(id: string): AgentAsk | undefined {
    const r = one<AskRow>(this.db, 'SELECT * FROM agent_asks WHERE id = ?', id)
    return r ? toAsk(r) : undefined
  }

  start(id: string): void {
    run(this.db, "UPDATE agent_asks SET state = 'running' WHERE id = ? AND state = 'queued'", id)
  }

  settle(id: string, state: AskState, answer: Answer | null): void {
    run(
      this.db,
      `UPDATE agent_asks SET state = ?, answer = ?, settled_at = ? WHERE id = ? AND state IN ('queued', 'running')`,
      state,
      answer ? JSON.stringify(answer) : null,
      now(),
      id,
    )
  }

  // True the first time only: an answer reaches the asker once.
  report(id: string): boolean {
    return (
      Number(
        run(this.db, 'UPDATE agent_asks SET reported = 1 WHERE id = ? AND reported = 0', id)
          .changes,
      ) > 0
    )
  }

  private where(sql: string, ...params: string[]): AgentAsk[] {
    return all<AskRow>(
      this.db,
      `SELECT * FROM agent_asks WHERE ${sql} ORDER BY created_at, id`,
      ...params,
    ).map(toAsk)
  }

  ofTurn(fromTurn: string): AgentAsk[] {
    return this.where('from_turn = ?', fromTurn)
  }

  ofRoot(root: string): AgentAsk[] {
    return this.where('root = ?', root)
  }

  openOfRoot(root: string): AgentAsk[] {
    return this.ofRoot(root).filter((a) => OPEN.includes(a.state))
  }

  inState(state: AskState): AgentAsk[] {
    return this.where('state = ?', state)
  }

  // What this agent asked for this person and has not heard back on.
  waitingFor(user: string, from: string): AgentAsk[] {
    return this.where('reported = 0 AND user_id = ? AND from_agent = ?', user, from)
  }

  // Settled but never reported: a restart came between the answer and the end of its turn.
  unreported(): AgentAsk[] {
    return this.where(`reported = 0 AND state NOT IN ('queued', 'running')`)
  }

  // The first ask of a chain: the one the person's own conversation made.
  topOf(id: string): AgentAsk | undefined {
    let at = this.get(id)
    while (at?.parent) at = this.get(at.parent)
    return at
  }

  // How many asks this request may make: the first allowance, and more on each Continue.
  allowed(root: string, first: number): number {
    return (
      one<{ allowed: number }>(this.db, 'SELECT allowed FROM agent_ask_roots WHERE root = ?', root)
        ?.allowed ?? first
    )
  }

  allowMore(root: string, first: number): void {
    const n = this.allowed(root, first) + first
    run(
      this.db,
      'INSERT INTO agent_ask_roots (root, allowed) VALUES (?, ?) ON CONFLICT (root) DO UPDATE SET allowed = excluded.allowed',
      root,
      n,
    )
  }
}
