// Read now: on a connection, and on a table, which reads every connection that fills it and can
// be read now (Mail: Gmail and Outlook in one press). One waiting on a sign-in or the customer's
// own step is not read, and says why (W3). Both go the same way: a connection signed in as the
// person renews its token first, so a sign-in revoked since shows at once; one with nothing to
// read is checked.
import { z } from 'zod'
import type { Connection } from '../../world/connections.ts'
import { Refused } from '../../world/kinds.ts'
import type { BaseCtx } from '../ctx.ts'
import type { ReadByView } from '../types.ts'

// Why a connection can't be read now, or null when it can.
export function whyNot(conn: Connection, title: string): string | null {
  if (conn.state === 'needs_sign_in')
    return `${title} needs you to sign in again, in Intelligence › Connections.`
  if (conn.state === 'waiting') return conn.health ?? `${title} is waiting for the customer.`
  return null
}

// The connections that fill a table, each with whether it can be read now and when it last was.
export function readByOf(ctx: BaseCtx, tableId: string): ReadByView[] {
  return (ctx.engine.connectors?.filling(tableId) ?? []).map(({ conn, c }) => ({
    connection: conn.id,
    title: c.manifest.title,
    account: conn.account,
    reason: whyNot(conn, c.manifest.title),
    lastReadAt: conn.lastSyncAt,
  }))
}

export function registerReadNow(ctx: BaseCtx): void {
  const { app, world, engine, user, live } = ctx
  const signIn = engine.connectors?.signIn

  const readNow = async (id: string) => {
    const conn = world.connections.get(id)
    const c = conn ? engine.connectors?.find(conn.connector) : undefined
    if (c?.manifest.auth === 'oauth') signIn?.forget(id)
    if (c && !c.sync) await engine.connectors?.checkNow(id)
    else await engine.sync(user, id)
  }

  // Read now, and Try again, on a connection
  app.post('/api/connections/:id/sync', async (req) => {
    const { id } = z.object({ id: z.string() }).parse(req.params)
    await readNow(id)
    live()
    return { ok: true }
  })

  // Read now on a table: every connection filling it that can be read now
  app.post('/api/tables/:id/read', async (req) => {
    const { id } = z.object({ id: z.string() }).parse(req.params)
    const t = world.shape.table(id)
    if (!t) throw new Refused('That table is not there.')
    const by = readByOf(ctx, t.id)
    const now = by.filter((r) => !r.reason)
    if (!now.length)
      throw new Refused(by[0]?.reason ?? `Nothing reads into ${t.name}: it is kept by hand.`)
    for (const r of now) await readNow(r.connection)
    live()
    return { read: now.map((r) => r.title) }
  })
}
