// What the connectors serve the desk (decision 11): every loaded connector's tools as entries of
// the tool registry, each under its connector's server, and what the start layer says about the
// connections. Out of service.ts so that file stays one reader's length.
import { Problem } from '@alpha/connector-sdk'
import { z } from 'zod'
import { entry, type ToolEntry } from '../engine/registry.ts'
import { Refused } from '../world/kinds.ts'
import type { World } from '../world/world.ts'
import { type ConnectorService, mcpName } from './service.ts'

// Every connector's tools as entries of the tool registry (decision 11), each under its
// connector's server: the model sees mcp__<connector>__<tool>, and what Gmail can do is
// Gmail's list.
export function entriesOf(service: ConnectorService): ToolEntry[] {
  return service.known().flatMap((c) =>
    Object.entries(c.tools).map(([t, spec]) =>
      entry(
        c.manifest.name,
        t,
        `${c.manifest.title}: ${spec.description}`,
        { ...spec.input, account: z.string().optional() },
        async (input: Record<string, unknown>) => {
          try {
            const { account, ...rest } = input
            const conn = service.connectionFor(c, typeof account === 'string' ? account : undefined)
            const effect = (await service.says(mcpName(c.manifest.name, t), rest))?.effect
            const out = await spec.run(service.call(c, conn, effect ?? 'outward'), rest as never)
            return { content: [{ type: 'text' as const, text: JSON.stringify(out, null, 1) }] }
          } catch (err) {
            const words =
              err instanceof Refused || err instanceof Problem
                ? err.message
                : `Something went wrong: ${err instanceof Error ? err.message : String(err)}`
            return { content: [{ type: 'text' as const, text: words }], isError: true }
          }
        },
      ),
    ),
  )
}

// What the start layer says about connections.
export function describeConnections(service: ConnectorService, world: World): string {
  const conns = world.connections.list()
  if (!conns.length)
    return 'None yet. The person connects accounts and folders in Settings › Connections.'
  return conns
    .map((k) => {
      const c = service.find(k.connector)
      if (!c)
        return `### ${k.connector}: ${k.account} (its connector is not loaded; the person adds it in Settings › Connections)`
      const state =
        k.state === 'connected'
          ? 'connected'
          : k.state === 'needs_sign_in'
            ? 'needs the person to sign in again'
            : k.state
      return `### ${c.manifest.title}: ${k.account} (${state}${k.health ? `; ${k.health}` : ''})\n${c.guide.replace(/^# .*\n+/, '').trim()}`
    })
    .join('\n\n')
}
