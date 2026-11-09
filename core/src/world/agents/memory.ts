// What an agent remembers (clean base step 7): short facts, each saying who said it and whether it
// is the firm's or one person's. A few essential ones are always loaded; the rest are found by
// search. What a person wrote or edited is theirs, and an agent cannot change it.
import { all, type Db, newId, now, one, run } from '../db.ts'
import { Refused } from '../kinds.ts'

export interface Memory {
  id: string
  agent: string
  user: string | null // none: the firm's
  text: string
  essential: boolean
  origin: 'agent' | 'person'
  saidBy: string | null
  createdAt: string
  updatedAt: string
}

interface MemoryRow {
  id: string
  agent_id: string
  user_id: string | null
  text: string
  essential: number
  origin: 'agent' | 'person'
  said_by: string | null
  created_at: string
  updated_at: string
}

const toMemory = (r: MemoryRow): Memory => ({
  id: r.id,
  agent: r.agent_id,
  user: r.user_id,
  text: r.text,
  essential: !!r.essential,
  origin: r.origin,
  saidBy: r.said_by,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
})

const normal = (t: string) => t.trim().toLowerCase().replace(/\s+/g, ' ')

export interface NewMemory {
  agent: string
  user: string | null
  text: string
  essential: boolean
  origin: 'agent' | 'person'
  saidBy: string | null
  turn: string | null
}

export class Memories {
  private db: Db
  private most: () => number

  constructor(db: Db, most: () => number) {
    this.db = db
    this.most = most
  }

  check(text: string): string {
    const t = text.trim()
    if (!t) throw new Refused('A memory needs its words.')
    if (t.length > this.most())
      throw new Refused(
        `A memory is one short fact (${t.length} characters; ${this.most()} at most). Save the fact, and put how to do something in a skill.`,
      )
    return t
  }

  // The same fact again changes only whether it is essential.
  save(m: NewMemory): Memory {
    const text = this.check(m.text)
    const key = normal(text)
    const twin = one<MemoryRow>(
      this.db,
      `SELECT * FROM agent_memories WHERE agent_id = ? AND COALESCE(user_id, '') = ? AND normalized = ?`,
      m.agent,
      m.user ?? '',
      key,
    )
    if (twin) {
      run(
        this.db,
        'UPDATE agent_memories SET essential = ?, updated_at = ? WHERE id = ?',
        m.essential || twin.essential ? 1 : 0,
        now(),
        twin.id,
      )
      return this.get(twin.id) as Memory
    }
    const id = newId('mem')
    const at = now()
    run(
      this.db,
      `INSERT INTO agent_memories (id, agent_id, user_id, text, normalized, essential, origin, said_by,
         turn_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id,
      m.agent,
      m.user,
      text,
      key,
      m.essential ? 1 : 0,
      m.origin,
      m.saidBy,
      m.turn,
      at,
      at,
    )
    return this.get(id) as Memory
  }

  get(id: string): Memory | undefined {
    const r = one<MemoryRow>(this.db, 'SELECT * FROM agent_memories WHERE id = ?', id)
    return r ? toMemory(r) : undefined
  }

  // A person's edit: from then on the memory is theirs.
  edit(id: string, to: { text?: string; essential?: boolean }): Memory {
    const was = this.get(id)
    if (!was) throw new Refused('That memory is not there.')
    const text = to.text === undefined ? was.text : this.check(to.text)
    run(
      this.db,
      `UPDATE agent_memories SET text = ?, normalized = ?, essential = ?, origin = 'person', updated_at = ?
       WHERE id = ?`,
      text,
      normal(text),
      (to.essential ?? was.essential) ? 1 : 0,
      now(),
      id,
    )
    return this.get(id) as Memory
  }

  // An agent forgets only what it wrote; a person forgets anything.
  forget(id: string, by: 'agent' | 'person'): Memory {
    const was = this.get(id)
    if (!was) throw new Refused('That memory is not there.')
    if (by === 'agent' && was.origin === 'person')
      throw new Refused('A person wrote that memory, so it stays until they change it.')
    run(this.db, 'DELETE FROM agent_memories WHERE id = ?', id)
    return was
  }

  // The firm's and this person's, newest first.
  list(agent: string, user: string | null): Memory[] {
    return all<MemoryRow>(
      this.db,
      `SELECT * FROM agent_memories WHERE agent_id = ? AND (user_id IS NULL OR user_id = ?)
       ORDER BY updated_at DESC, rowid DESC`,
      agent,
      user ?? '',
    ).map(toMemory)
  }

  // The essential ones, newest first, as many as the budget holds.
  essentials(agent: string, user: string | null, bytes: number): Memory[] {
    const out: Memory[] = []
    let used = 0
    for (const m of this.list(agent, user)) {
      if (!m.essential) continue
      used += Buffer.byteLength(m.text)
      if (used > bytes) break
      out.push(m)
    }
    return out
  }

  search(agent: string, user: string | null, query: string, limit: number): Memory[] {
    return query
      ? all<MemoryRow>(
          this.db,
          `SELECT m.* FROM agent_memories_fts f JOIN agent_memories m ON m.rowid = f.rowid
           WHERE agent_memories_fts MATCH ? AND m.agent_id = ? AND (m.user_id IS NULL OR m.user_id = ?)
           ORDER BY bm25(agent_memories_fts) LIMIT ?`,
          query,
          agent,
          user ?? '',
          limit,
        ).map(toMemory)
      : []
  }
}
