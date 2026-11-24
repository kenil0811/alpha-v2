// Every account a person reads, one line each, in Set up Alpha's Your accounts and in Settings ›
// Connections alike: the lines; Disconnect, which keeps the line to connect again; Delete, which
// removes the account and what it read, as removing a connection always does; and an app left out
// of what Alpha Bridge found, brought back.
import { z } from 'zod'
import { Refused } from '../../world/kinds.ts'
import { bringAppBack } from '../../world/story.ts'
import type { Ctx } from '../ctx.ts'
import { accountsView, lineConnections } from '../story-connect.ts'
import type { AccountsView } from '../types.ts'

export function registerConnect(ctx: Ctx): void {
  const { app, engine, user, live } = ctx
  const service = () => {
    if (!engine.connectors) throw new Refused('Connections are not set up in this core.')
    return engine.connectors
  }
  // a person's own connections, or anyone's for the owner
  const theirs = (madeBy: string) => user.role === 'owner' || madeBy === `person:${user.id}`

  app.get('/api/connect/accounts', async (req): Promise<AccountsView> => {
    const { mine } = z.object({ mine: z.string().optional() }).parse(req.query)
    return accountsView(ctx, mine === '1')
  })

  // Disconnect: reads stop and the kept sign-in or password goes; the line stays, to connect again
  app.post('/api/connections/:id/disconnect', async (req) => {
    const { id } = z.object({ id: z.string() }).parse(req.params)
    const k = ctx.world.connections.get(id)
    if (!k || !theirs(k.madeBy)) throw new Refused('That connection is not there.')
    await service().signOut(id, user.id)
    live()
    return { ok: true }
  })

  // Delete: every connection on the line goes, with what it read
  app.post('/api/connect/accounts/delete', async (req) => {
    const b = z
      .object({
        provider: z.string().trim().min(1).max(60),
        account: z.string().trim().min(1).max(320),
      })
      .parse(req.body)
    const conns = lineConnections(ctx, b.provider, b.account).filter((k) => theirs(k.madeBy))
    if (!conns.length) throw new Refused('That account is not there.')
    for (const k of conns) await engine.disconnect(user, k.id)
    live()
    return { ok: true }
  })

  // An app left out of what Alpha Bridge found, listed again
  app.post('/api/connect/apps/restore', async (req) => {
    const b = z.object({ name: z.string().trim().min(1).max(200) }).parse(req.body)
    bringAppBack(ctx.world.db, user.id, b.name)
    live()
    return { ok: true }
  })
}
