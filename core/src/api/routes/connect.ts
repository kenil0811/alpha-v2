// Every account a person reads, one line each, in Connect and in Settings › Connections alike
// (Vikas, 23 Nov): the lines, Disconnect and Delete on each, and Excluded, where a deleted account
// and an app left out wait to be restored. A deleted account comes back disconnected, ready to sign
// in again.
import { z } from 'zod'
import { Refused } from '../../world/kinds.ts'
import { bringAppBack, excludeAccount, unexcludeAccount } from '../../world/story.ts'
import type { Ctx } from '../ctx.ts'
import { accountsView, lineConnections } from '../story-connect.ts'
import type { AccountsView } from '../types.ts'

const Line = z.object({
  provider: z.string().trim().min(1).max(60),
  account: z.string().trim().min(1).max(320),
})

export function registerConnect(ctx: Ctx): void {
  const { app, engine, user, live } = ctx
  const service = () => {
    if (!engine.connectors) throw new Refused('Connections are not set up in this core.')
    return engine.connectors
  }
  // a person's own connections, or the owner's for anyone's
  const theirs = (madeBy: string) => user.role === 'owner' || madeBy === `person:${user.id}`

  app.get('/api/connect/accounts', async (req): Promise<AccountsView> => {
    const { mine } = z.object({ mine: z.string().optional() }).parse(req.query)
    return accountsView(ctx, mine === '1')
  })

  // Disconnect: reads stop and the kept sign-in goes; the line stays, to reconnect
  app.post('/api/connections/:id/disconnect', async (req) => {
    const { id } = z.object({ id: z.string() }).parse(req.params)
    const k = ctx.world.connections.get(id)
    if (!k || !theirs(k.madeBy)) throw new Refused('That connection is not there.')
    await service().signOut(id, user.id)
    live()
    return { ok: true }
  })

  // Delete: the account's connections go, and it is kept under Excluded
  app.post('/api/connect/accounts/delete', async (req) => {
    const b = Line.parse(req.body)
    const conns = lineConnections(ctx, b.provider, b.account).filter((k) => theirs(k.madeBy))
    if (!conns.length) throw new Refused('That account is not there.')
    for (const k of conns) await engine.disconnect(user, k.id)
    excludeAccount(ctx.world.db, user.id, {
      provider: b.provider,
      account: conns[0]?.account ?? b.account,
      connectors: [...new Set(conns.map((k) => k.connector))],
    })
    live()
    return { ok: true }
  })

  // Restore from Excluded: an app listed again, or an account back, disconnected
  app.post('/api/connect/excluded/restore', async (req) => {
    const b = z
      .object({ kind: z.enum(['account', 'app']), provider: z.string(), name: z.string().min(1) })
      .parse(req.body)
    if (b.kind === 'app') bringAppBack(ctx.world.db, user.id, b.name)
    else {
      const was = unexcludeAccount(ctx.world.db, user.id, {
        provider: b.provider,
        account: b.name,
      })
      if (!was) throw new Refused('That account is not under Excluded.')
      for (const name of was.connectors)
        if (service().find(name)) await service().restore(name, was.account, user.id)
    }
    live()
    return { ok: true }
  })
}
