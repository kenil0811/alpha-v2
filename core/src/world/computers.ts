// A person's paired computers: each runs the Bridge, which lends Alpha what the person turns on
// there (a folder, first) and runs the connectors for it. A computer is paired by a one-time link
// its person makes; the Bridge makes its own key there and the world keeps only the public half,
// against the person. A computer acts only as its person (docs/rules.md, B1). A removed one is
// turned away at its next word and kept for the record.
import { createHash, createPublicKey, randomBytes, verify } from 'node:crypto'
import { all, type Db, newId, now, one, run, tx } from './db.ts'
import { append } from './journal.ts'
import { Refused } from './kinds.ts'
import type { WriteCtx } from './shape/index.ts'

export interface Computer {
  id: string
  user: string // the person it acts as
  name: string // as the computer calls itself (Kenil's MacBook)
  platform: string // darwin, win32
  publicKey: string // PEM, the public half of the key it made
  pairedAt: string
  lastSeenAt: string | null
  removedAt: string | null
}

interface ComputerRow {
  id: string
  user_id: string
  name: string
  platform: string
  public_key: string
  paired_at: string
  last_seen_at: string | null
  removed_at: string | null
}

const toComputer = (r: ComputerRow): Computer => ({
  id: r.id,
  user: r.user_id,
  name: r.name,
  platform: r.platform,
  publicKey: r.public_key,
  pairedAt: r.paired_at,
  lastSeenAt: r.last_seen_at,
  removedAt: r.removed_at,
})

// A pairing link is good this long, and once.
const LINK_MINUTES = 15
const digest = (s: string) => createHash('sha256').update(s).digest('hex')

export class Computers {
  private db: Db

  constructor(db: Db) {
    this.db = db
  }

  get(id: string): Computer | undefined {
    const r = one<ComputerRow>(this.db, 'SELECT * FROM computers WHERE id = ?', id)
    return r ? toComputer(r) : undefined
  }

  // A person's computers still paired, the newest first.
  of(user: string): Computer[] {
    return all<ComputerRow>(
      this.db,
      'SELECT * FROM computers WHERE user_id = ? AND removed_at IS NULL ORDER BY paired_at DESC',
      user,
    ).map(toComputer)
  }

  // A one-time code for the person's next computer; only its hash is kept.
  link(user: string): { code: string; until: string } {
    const code = randomBytes(24).toString('base64url')
    const made = now()
    const until = new Date(Date.parse(made) + LINK_MINUTES * 60_000).toISOString()
    run(
      this.db,
      'INSERT INTO computer_links (code_hash, user_id, made_at, until) VALUES (?, ?, ?, ?)',
      digest(code),
      user,
      made,
      until,
    )
    return { code, until }
  }

  // The Bridge's first word: the code it was given, its key's public half and its name. The code
  // is spent here, whatever comes after; the person who made the link paired it.
  pair(code: string, computer: { publicKey: string; name: string; platform: string }): Computer {
    // the key must be one Alpha can check a signature with
    try {
      createPublicKey(computer.publicKey)
    } catch {
      throw new Refused('That is not a key this Alpha can read.')
    }
    return tx(this.db, () => {
      const l = one<{ user_id: string; until: string; used_at: string | null }>(
        this.db,
        'SELECT user_id, until, used_at FROM computer_links WHERE code_hash = ?',
        digest(code),
      )
      if (!l || l.used_at) throw new Refused('That pairing link was used already, or is not one.')
      if (l.until < now())
        throw new Refused('That pairing link is too old. Make a new one in Your computers.')
      run(this.db, 'UPDATE computer_links SET used_at = ? WHERE code_hash = ?', now(), digest(code))
      const id = newId('pc')
      const name = computer.name.trim().slice(0, 80) || 'A computer'
      run(
        this.db,
        'INSERT INTO computers (id, user_id, name, platform, public_key, paired_at) VALUES (?, ?, ?, ?, ?, ?)',
        id,
        l.user_id,
        name,
        computer.platform.slice(0, 20),
        computer.publicKey,
        now(),
      )
      append(this.db, {
        actor: { kind: 'person', id: l.user_id },
        kind: 'computer_paired',
        words: `Paired ${name}.`,
        data: { computer: id },
        user: l.user_id,
      })
      return this.get(id) as Computer
    })
  }

  // Whether this signature of the challenge was made with the computer's own key; a removed
  // computer never passes.
  proves(id: string, challenge: string, signature: string): Computer | null {
    const c = this.get(id)
    if (!c || c.removedAt) return null
    try {
      const ok = verify(
        null,
        Buffer.from(challenge),
        createPublicKey(c.publicKey),
        Buffer.from(signature, 'base64'),
      )
      return ok ? c : null
    } catch {
      return null
    }
  }

  seen(id: string): void {
    run(this.db, 'UPDATE computers SET last_seen_at = ? WHERE id = ?', now(), id)
  }

  // Removed by its person: turned away from now on; what it brought stays.
  remove(id: string, ctx: WriteCtx): void {
    const c = this.get(id)
    if (!c || c.removedAt) throw new Refused('That computer is not paired here.')
    if (ctx.user && ctx.user !== c.user) throw new Refused('That computer is not yours.')
    run(this.db, 'UPDATE computers SET removed_at = ? WHERE id = ?', now(), id)
    append(this.db, {
      actor: ctx.actor,
      kind: 'computer_removed',
      words: `Removed ${c.name}.`,
      data: { computer: id },
      user: c.user,
    })
  }
}
