// What a connector's process may reach and read (step 2, part 1, slice 2): the hosts its
// connectors name and those the person approved on their connections; the folders their
// connections are, for a connector of folders. A host it was refused is a line where the person
// sees it.
import { existsSync, realpathSync } from 'node:fs'
import type { Connector } from '@alpha/connector-sdk'
import type { World } from '../world/world.ts'
import type { Described, ProcessRules } from './process.ts'

export function rulesFor(
  world: World,
  find: (name: string) => Connector | undefined,
): ProcessRules {
  const of = (described: Described[]) => {
    const names = described.map((d) => d.manifest.name)
    return world.connections.list().filter((k) => names.includes(k.connector))
  }
  return {
    hosts: (described) => [
      ...new Set([
        ...described.flatMap((d) => d.manifest.reaches ?? []),
        ...of(described).flatMap((k) => k.hosts),
      ]),
    ],
    reads: (described) =>
      of(described.filter((d) => d.manifest.auth === 'path'))
        .map((k) => k.account)
        .filter((dir) => existsSync(dir))
        .map((dir) => realpathSync(dir))
        .sort(),
    refused: (host, name) => {
      const title = find(name)?.manifest.title ?? name
      world.line({
        actor: { kind: 'connector', id: name },
        kind: 'reach_refused',
        words: `${title} tried to reach ${host}: refused.`,
        data: { connector: name, host, title },
      })
    },
  }
}
