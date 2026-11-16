// The connections whose items carry files (an email's attachments), for the files that come by
// mail (files/intake.ts), and an item's files fetched through its connection.
import type { ItemFile } from '@alpha/connector-sdk'
import type { FileSource } from '../files/intake.ts'
import { Refused } from '../world/kinds.ts'
import type { World } from '../world/world.ts'
import { tableOf } from './places.ts'
import type { ConnectorService } from './service.ts'

export function fileSources(service: ConnectorService, world: World): FileSource[] {
  return world.connections
    .list()
    .filter((k) => k.state === 'connected')
    .flatMap((k) => {
      const c = service.find(k.connector)
      return c?.files
        ? [
            {
              connection: k.id,
              title: c.manifest.title,
              table: tableOf(world, c, c.files.table)?.id ?? c.files.table,
              field: c.files.field,
              connector: k.connector,
              account: k.account,
            },
          ]
        : []
    })
}

export async function fetchFiles(
  service: ConnectorService,
  world: World,
  connection: string,
  item: string,
): Promise<ItemFile[]> {
  const conn = world.connections.get(connection)
  if (!conn) throw new Refused('That connection is not there.')
  const c = service.connector(conn.connector)
  if (!c.files) throw new Refused(`${c.manifest.title} carries no files.`)
  return c.files.fetch(service.call(c, conn), item)
}
