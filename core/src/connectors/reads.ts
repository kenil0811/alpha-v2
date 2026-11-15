// One of a connector's reads through one connection, for a module's script whose kit names the
// connector (the kit API's connections.read): only a read (the effect its tool says for this
// input); anything else is refused. A read that finds the sign-in gone says so on the connection,
// as a failed sync does; one that works after a failure says the connection works again.
import { Problem } from '@alpha/connector-sdk'
import { z } from 'zod'
import { Refused } from '../world/kinds.ts'
import type { World } from '../world/world.ts'
import { type ConnectorService, mcpName } from './service.ts'

export async function readThrough(
  service: ConnectorService,
  world: World,
  id: string,
  read: string,
  input: Record<string, unknown>,
): Promise<unknown> {
  const conn = world.connections.get(id)
  if (!conn) throw new Refused('That connection is not there.')
  if (conn.state === 'paused') throw new Refused(`${conn.account}'s connection is paused.`)
  const c = service.connector(conn.connector)
  const spec = c.tools[read]
  if (!spec) throw new Refused(`${c.manifest.title} has no read called ${read}.`)
  const effect = (await service.says(mcpName(c.manifest.name, read), input))?.effect
  if (effect !== 'read')
    throw new Refused(
      `${c.manifest.title}'s ${read} is not a read: a module's script only reads through a connection.`,
    )
  const given = z.object(spec.input).safeParse(input)
  if (!given.success)
    throw new Refused(`${c.manifest.title}'s ${read} was given ${z.prettifyError(given.error)}`)
  try {
    const out = await spec.run(service.call(c, conn, 'read'), given.data as never)
    if (conn.state !== 'connected')
      world.connections.setState(
        id,
        'connected',
        null,
        `${c.manifest.title} for ${conn.account} works again.`,
        { actor: { kind: 'connector', id: c.manifest.name } },
      )
    return out
  } catch (err) {
    if (err instanceof Problem && ['sign_in', 'waiting'].includes(err.kind)) service.failed(id, err)
    throw err
  }
}
