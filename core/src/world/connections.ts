// Connections: one account of one connector each (design §4). A connection points at its secret
// in the secret store and never holds it.
import { all, type Db, newId, now, one, run, tx } from './db.ts'
import { append } from './journal.ts'
import { Refused } from './kinds.ts'
import { actorName, type WriteCtx } from './shape/index.ts'

// waiting: a setup step only the customer can do (step 2, part 4); health says what, and syncs
// are not retried until Try again
export type ConnectionState = 'connected' | 'needs_sign_in' | 'broken' | 'paused' | 'waiting'

export interface Connection {
  id: string
  connector: string
  account: string
  state: ConnectionState
  health: string | null
  secretRef: string | null
  cursor: string | null
  lastSyncAt: string | null
  lastRows: number | null
  lastNewAt: string | null
  hosts: string[] // what the person approved beyond its connector's own hosts
  never: string[] // the sites, folders and words it never counts: the person's never-use list
  madeBy: string // who set it up (person:<id>, system): its owner
}

interface ConnectionRow {
  id: string
  connector: string
  account: string
  state: ConnectionState
  health: string | null
  secret_ref: string | null
  cursor: string | null
  last_sync_at: string | null
  last_rows: number | null
  last_new_at: string | null
  hosts: string
  never: string
  made_by: string
}

function toConnection(r: ConnectionRow): Connection {
  return {
    id: r.id,
    connector: r.connector,
    account: r.account,
    state: r.state,
    health: r.health,
    secretRef: r.secret_ref,
    cursor: r.cursor,
    lastSyncAt: r.last_sync_at,
    lastRows: r.last_rows,
    lastNewAt: r.last_new_at,
    hosts: JSON.parse(r.hosts || '[]') as string[],
    never: JSON.parse(r.never || '[]') as string[],
    madeBy: r.made_by,
  }
}

export class Connections {
  private db: Db

  constructor(db: Db) {
    this.db = db
  }

  list(): Connection[] {
    return all<ConnectionRow>(this.db, 'SELECT * FROM connections ORDER BY created_at').map(
      toConnection,
    )
  }

  get(id: string): Connection | undefined {
    const r = one<ConnectionRow>(this.db, 'SELECT * FROM connections WHERE id = ?', id)
    return r ? toConnection(r) : undefined
  }

  find(connector: string, account: string): Connection | undefined {
    const r = one<ConnectionRow>(
      this.db,
      'SELECT * FROM connections WHERE connector = ? AND lower(account) = lower(?)',
      connector,
      account,
    )
    return r ? toConnection(r) : undefined
  }

  add(
    connector: string,
    account: string,
    secretRef: string | null,
    title: string,
    ctx: WriteCtx,
  ): Connection {
    if (!account.trim()) throw new Refused('A connection needs its account.')
    return tx(this.db, () => {
      const known = this.find(connector, account)
      if (known) {
        run(
          this.db,
          "UPDATE connections SET state = 'connected', health = NULL, secret_ref = ? WHERE id = ?",
          secretRef,
          known.id,
        )
        append(this.db, {
          actor: ctx.actor,
          kind: 'connected',
          words: `Connected ${title} again for ${account}.`,
          data: { connection: known.id, connector },
          user: ctx.user ?? null,
        })
        return this.get(known.id) as Connection
      }
      const id = newId('k')
      run(
        this.db,
        `INSERT INTO connections (id, connector, account, state, secret_ref, made_by, created_at)
         VALUES (?, ?, ?, 'connected', ?, ?, ?)`,
        id,
        connector,
        account.trim(),
        secretRef,
        actorName(ctx.actor),
        now(),
      )
      append(this.db, {
        actor: ctx.actor,
        kind: 'connected',
        words: `Connected ${title} for ${account.trim()}.`,
        data: { connection: id, connector },
        user: ctx.user ?? null,
      })
      return this.get(id) as Connection
    })
  }

  setState(
    id: string,
    state: ConnectionState,
    health: string | null,
    words: string,
    ctx: WriteCtx,
  ): void {
    tx(this.db, () => {
      const c = this.get(id)
      if (!c) throw new Refused('That connection is not there.')
      if (c.state === state && c.health === health) return
      run(this.db, 'UPDATE connections SET state = ?, health = ? WHERE id = ?', state, health, id)
      append(this.db, {
        actor: ctx.actor,
        kind: 'connection',
        words,
        data: { connection: id, state, health },
      })
    })
  }

  // A host the person approved for this connection, from a refusal beside it (call 2: only a
  // connector that reads sites they choose offers it).
  approve(id: string, host: string, ctx: WriteCtx): void {
    tx(this.db, () => {
      const c = this.get(id)
      if (!c) throw new Refused('That connection is not there.')
      if (c.hosts.includes(host)) return
      run(
        this.db,
        'UPDATE connections SET hosts = ? WHERE id = ?',
        JSON.stringify([...c.hosts, host]),
        id,
      )
      append(this.db, {
        actor: ctx.actor,
        kind: 'connection',
        words: `${actorName(ctx.actor)} allowed ${c.account} to reach ${host}.`,
        data: { connection: id, host },
      })
    })
  }

  // What the connection never counts, as the person left it (an unticked site or folder, or the
  // list edited in Settings): journaled as how many, never which.
  setNever(id: string, never: string[], ctx: WriteCtx): void {
    tx(this.db, () => {
      const c = this.get(id)
      if (!c) throw new Refused('That connection is not there.')
      const list = [...new Set(never.map((x) => x.trim().toLowerCase()).filter(Boolean))].sort()
      run(this.db, 'UPDATE connections SET never = ? WHERE id = ?', JSON.stringify(list), id)
      append(this.db, {
        actor: ctx.actor,
        kind: 'connection',
        words: `${actorName(ctx.actor)} set ${list.length} thing${list.length === 1 ? '' : 's'} ${c.account} never counts.`,
        data: { connection: id, never: list.length },
      })
    })
  }

  setCursor(id: string, cursor: string | null): void {
    run(this.db, 'UPDATE connections SET cursor = ? WHERE id = ?', cursor, id)
  }

  // After a sync: what it brought and how the connection looks now. A health judgement is only
  // journaled when it changes.
  synced(id: string, rows: number, sawNew: boolean, health: string | null, ctx: WriteCtx): void {
    tx(this.db, () => {
      const c = this.get(id)
      if (!c) return
      const at = now()
      run(
        this.db,
        'UPDATE connections SET last_sync_at = ?, last_rows = ?, last_new_at = coalesce(?, last_new_at), health = ? WHERE id = ?',
        at,
        rows,
        sawNew ? at : null,
        health,
        id,
      )
      if (health && health !== c.health)
        append(this.db, {
          actor: ctx.actor,
          kind: 'connection',
          words: health,
          data: { connection: id, health },
        })
    })
  }

  // Disconnecting removes the connection; what it brought in stays in the world, and the journal
  // keeps that it was there.
  remove(id: string, title: string, ctx: WriteCtx): Connection {
    return tx(this.db, () => {
      const c = this.get(id)
      if (!c) throw new Refused('That connection is not there.')
      run(this.db, 'DELETE FROM connections WHERE id = ?', id)
      append(this.db, {
        actor: ctx.actor,
        kind: 'disconnected',
        words: `Disconnected ${title} for ${c.account}.`,
        data: { connection: id, connector: c.connector },
        user: ctx.user ?? null,
      })
      return c
    })
  }
}
