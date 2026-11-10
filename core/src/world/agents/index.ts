// The firm's agents: a row each, and a folder beside the world holding its instructions and skills
// (modules/agents.ts writes those). Every agent can do what the Chief of staff can; they differ by
// instructions, memory, skills and model. What one may reach is decided in one place (agentReach),
// which grants every folder today, so limits can come later as a small change.
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { all, type Db, json, now, one, parse, run } from '../db.ts'

// Today's Alpha: always first, never deleted, with no row of its own.
export const CHIEF = 'chief'

export interface Agent {
  id: string
  name: string
  title: string
  description: string // when to use it: every agent reads this to decide whom to ask
  model: string | null // one of the config's; none is the desk's
  reach: unknown | null
  madeBy: string | null
  createdAt: string
  updatedAt: string
}

interface AgentRow {
  id: string
  name: string
  title: string
  description: string
  model: string | null
  reach: string | null
  made_by: string | null
  created_at: string
  updated_at: string
}

const toAgent = (r: AgentRow): Agent => ({
  id: r.id,
  name: r.name,
  title: r.title,
  description: r.description,
  model: r.model,
  reach: r.reach ? parse(r.reach, null) : null,
  madeBy: r.made_by,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
})

// The Chief of staff as a teammate reads it.
export const CHIEF_CARD = {
  id: CHIEF,
  name: 'Chief of staff',
  title: 'Runs the team',
  description: 'Can do anything here, knows every agent, and makes and changes agents.',
}

export class Agents {
  private db: Db
  private dir: string

  // The model someone chose for an agent; none is the desk's. The Chief of staff has no row, so
  // its choice is kept in meta.
  modelOf(id: string | null): string | null {
    if (id && id !== CHIEF) return this.get(id)?.model ?? null
    return (
      one<{ value: string }>(this.db, "SELECT value FROM meta WHERE key = 'chief_model'")?.value ??
      null
    )
  }

  setChiefModel(model: string): void {
    run(
      this.db,
      "INSERT INTO meta (key, value) VALUES ('chief_model', ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value",
      model,
    )
  }

  constructor(db: Db, dir: string) {
    this.db = db
    this.dir = dir
  }

  list(): Agent[] {
    return all<AgentRow>(this.db, 'SELECT * FROM agents ORDER BY name COLLATE NOCASE').map(toAgent)
  }

  get(id: string): Agent | undefined {
    const r = one<AgentRow>(this.db, 'SELECT * FROM agents WHERE id = ?', id)
    return r ? toAgent(r) : undefined
  }

  byName(name: string): Agent | undefined {
    const r = one<AgentRow>(
      this.db,
      'SELECT * FROM agents WHERE name = ? COLLATE NOCASE',
      name.trim(),
    )
    return r ? toAgent(r) : undefined
  }

  // Its folder: instructions, skills and files.
  dirOf(id: string): string {
    const d = join(this.dir, id)
    mkdirSync(d, { recursive: true })
    return d
  }

  add(a: Pick<Agent, 'id' | 'name' | 'title' | 'description' | 'model' | 'madeBy'>): Agent {
    const at = now()
    run(
      this.db,
      `INSERT INTO agents (id, name, title, description, model, reach, made_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, NULL, ?, ?, ?)`,
      a.id,
      a.name,
      a.title,
      a.description,
      a.model,
      a.madeBy,
      at,
      at,
    )
    return this.get(a.id) as Agent
  }

  change(id: string, to: Partial<Pick<Agent, 'name' | 'title' | 'description' | 'model'>>): void {
    const was = this.get(id) as Agent
    run(
      this.db,
      'UPDATE agents SET name = ?, title = ?, description = ?, model = ?, updated_at = ? WHERE id = ?',
      to.name ?? was.name,
      to.title ?? was.title,
      to.description ?? was.description,
      to.model === undefined ? was.model : to.model,
      now(),
      id,
    )
  }

  // Its instructions changed: its next session starts from them.
  touch(id: string): void {
    run(this.db, 'UPDATE agents SET updated_at = ? WHERE id = ?', now(), id)
  }

  remove(id: string): void {
    run(this.db, 'DELETE FROM agents WHERE id = ?', id)
    run(this.db, 'DELETE FROM agent_memories WHERE agent_id = ?', id)
    run(this.db, 'DELETE FROM desk_sessions WHERE agent_id = ?', id)
  }

  setReach(id: string, reach: unknown): void {
    run(this.db, 'UPDATE agents SET reach = ?, updated_at = ? WHERE id = ?', json(reach), now(), id)
  }
}

// What an agent may reach: the folders it is granted, all of them until a limit is wanted. The one
// place limits would go.
export function agentReach(_agent: Agent | null, granted: string[]): string[] {
  return granted
}
