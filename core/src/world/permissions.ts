// Standing permissions (design §7, §12): a yes given once for one agent's one kind of thing (its
// CIM requests, the P&L exports one sender mails for one client), shown as a sentence, used and
// counted, revoked in Settings. One is granted only on a card that offered Always, and a card
// offers Always only after three unchanged yeses in a row for exactly that: a wall in code.
import { all, type Db, json, newId, now, one, parse, run, tx } from './db.ts'
import { append } from './journal.ts'
import { Refused } from './kinds.ts'
import type { WriteCtx } from './shape.ts'

// What a yes or a permission covers: the action (send_email, file_from_mail), the agent and its
// module when an agent asks, and the place (a kind of message; a sender, a row and a kind).
export interface Covered {
  action: string
  agent: string | null
  module: string | null
  place: Record<string, string>
}

export interface Permission extends Covered {
  id: string
  sentence: string
  grantedBy: string
  grantedAt: string
  uses: number
  lastUsedAt: string | null
  revokedAt: string | null
}

// The yeses in a row that earn the offer of Always.
export const ALWAYS_AFTER = 3

// One key per thing covered, whatever order its place was written in.
export function keyOf(c: Covered): string {
  const place = Object.fromEntries(Object.entries(c.place).sort(([a], [b]) => a.localeCompare(b)))
  return JSON.stringify([c.action, c.agent, c.module, place])
}

interface Row {
  id: string
  sentence: string
  action: string
  agent: string | null
  module_id: string | null
  place: string
  granted_by: string
  granted_at: string
  uses: number
  last_used_at: string | null
  revoked_at: string | null
}

const toPermission = (r: Row): Permission => ({
  id: r.id,
  sentence: r.sentence,
  action: r.action,
  agent: r.agent,
  module: r.module_id,
  place: parse<Record<string, string>>(r.place, {}),
  grantedBy: r.granted_by,
  grantedAt: r.granted_at,
  uses: r.uses,
  lastUsedAt: r.last_used_at,
  revokedAt: r.revoked_at,
})

export class Permissions {
  private db: Db

  constructor(db: Db) {
    this.db = db
  }

  // Every permission, live ones first, newest first.
  list(): Permission[] {
    return all<Row>(
      this.db,
      'SELECT * FROM permissions ORDER BY revoked_at IS NOT NULL, granted_at DESC',
    ).map(toPermission)
  }

  get(id: string): Permission | undefined {
    const r = one<Row>(this.db, 'SELECT * FROM permissions WHERE id = ?', id)
    return r ? toPermission(r) : undefined
  }

  // The live permission that covers exactly this, if any.
  covering(c: Covered): Permission | undefined {
    const key = keyOf(c)
    return all<Row>(
      this.db,
      'SELECT * FROM permissions WHERE action = ? AND revoked_at IS NULL',
      c.action,
    )
      .map(toPermission)
      .find((p) => keyOf(p) === key)
  }

  // A person's answer on a card for something a permission could cover: yes or no, and whether
  // they changed it first (other words, another row). The count of Always starts here.
  decided(c: Covered, d: { yes: boolean; changed: boolean; card?: string | null }, ctx: WriteCtx) {
    append(this.db, {
      actor: ctx.actor,
      kind: 'decided',
      words: d.yes ? (d.changed ? 'Said yes, after a change.' : 'Said yes.') : 'Said no.',
      data: { key: keyOf(c), yes: d.yes, changed: d.changed },
      user: ctx.user ?? null,
      card: d.card ?? null,
      module: c.module,
    })
  }

  // Unchanged yeses in a row for exactly this, newest back: a no, a change or a revoke ends it.
  streak(c: Covered): number {
    const key = keyOf(c)
    const lines = all<{ kind: string; data: string }>(
      this.db,
      "SELECT kind, data FROM journal WHERE kind IN ('decided', 'revoked_permission') ORDER BY id DESC LIMIT 200",
    )
    let n = 0
    for (const l of lines) {
      const d = parse<{ key?: string; yes?: boolean; changed?: boolean }>(l.data, {})
      if (d.key !== key) continue
      if (l.kind !== 'decided' || !d.yes || d.changed) break
      n++
    }
    return n
  }

  // Whether a card for this offers Always: enough unchanged yeses, and no permission yet.
  offers(c: Covered): boolean {
    return this.streak(c) >= ALWAYS_AFTER && !this.covering(c)
  }

  grant(c: Covered, sentence: string, ctx: WriteCtx & { card?: string | null }): Permission {
    if (ctx.actor.kind !== 'person')
      throw new Refused('Only the person gives a standing permission.')
    return tx(this.db, () => {
      const had = this.covering(c)
      if (had) return had
      if (this.streak(c) < ALWAYS_AFTER)
        throw new Refused(
          `Always comes after ${ALWAYS_AFTER} yeses in a row without a change; this has ${this.streak(c)}.`,
        )
      const id = newId('p')
      const at = now()
      run(
        this.db,
        `INSERT INTO permissions (id, sentence, action, agent, module_id, place, granted_by,
           granted_at, card_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        id,
        sentence,
        c.action,
        c.agent,
        c.module,
        json(c.place),
        `person:${ctx.actor.id ?? ''}`,
        at,
        ctx.card ?? null,
      )
      append(this.db, {
        actor: ctx.actor,
        kind: 'granted_permission',
        words: `Gave a standing permission: ${sentence}`,
        data: { permission: id, key: keyOf(c) },
        user: ctx.user ?? null,
        card: ctx.card ?? null,
        module: c.module,
      })
      return this.get(id) as Permission
    })
  }

  // A permission let something through: counted, and journaled as allowed.
  used(p: Permission, words: string, ctx: WriteCtx): void {
    tx(this.db, () => {
      run(
        this.db,
        'UPDATE permissions SET uses = uses + 1, last_used_at = ? WHERE id = ?',
        now(),
        p.id,
      )
      append(this.db, {
        actor: ctx.actor,
        kind: 'allowed',
        words,
        data: { permission: p.id, key: keyOf(p) },
        user: ctx.user ?? null,
        run: ctx.run ?? null,
        module: p.module,
      })
    })
  }

  revoke(id: string, ctx: WriteCtx): Permission {
    if (ctx.actor.kind !== 'person')
      throw new Refused('Only the person revokes a standing permission.')
    return tx(this.db, () => {
      const p = this.get(id)
      if (!p) throw new Refused('That permission is not there.')
      if (p.revokedAt) return p
      run(
        this.db,
        'UPDATE permissions SET revoked_at = ?, revoked_by = ? WHERE id = ?',
        now(),
        `person:${ctx.actor.id ?? ''}`,
        id,
      )
      append(this.db, {
        actor: ctx.actor,
        kind: 'revoked_permission',
        words: `Revoked a standing permission: ${p.sentence}`,
        data: { permission: id, key: keyOf(p) },
        user: ctx.user ?? null,
        module: p.module,
      })
      return this.get(id) as Permission
    })
  }
}
