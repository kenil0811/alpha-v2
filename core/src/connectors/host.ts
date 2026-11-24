// What a connector's call reaches in the core, for one connection: its account and kept sign-in,
// its cursor, landing and marking gone in its tables, the browser as the connection's owner, files
// kept, the journal, and what the never-use list left out (rules N1). Made by the connector service.
import { createHash } from 'node:crypto'
import type { BrowserEngine, Connector, Host, SecretStore } from '@alpha/connector-sdk'
import { Problem } from '@alpha/connector-sdk'
import { takeIn } from '../files/documents.ts'
import { type Connection, ownerOf } from '../world/connections.ts'
import type { World } from '../world/world.ts'
import { tableOf } from './places.ts'
import type { SignIn } from './signin.ts'
import type { Count } from './tally.ts'

export interface HostDeps {
  world: World
  secrets: SecretStore
  signIn: SignIn | undefined
  browser: (() => BrowserEngine) | undefined
  // what the read under way met, by table (tally.ts): its counts, added to
  count: (connection: string, table: string, name: string, c: Partial<Count>) => void
}

function hashOf(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex')
}

export function hostFor(d: HostDeps, c: Connector, conn: Connection): Host {
  const actor = { kind: 'connector' as const, id: c.manifest.name }
  const world = d.world
  return {
    account: conn.account,
    // read fresh: the sign-in that names it may come after this host was made
    get place() {
      return world.connections.get(conn.id)?.place ?? null
    },
    // signed in as the person: a short-lived token, renewed by the core
    secret: async () => {
      if (c.manifest.auth !== 'oauth') return conn.secretRef ? d.secrets.get(conn.secretRef) : null
      if (!d.signIn) throw new Problem('Signing in is not set up in this core.')
      return d.signIn.token(conn, c)
    },
    cursor: () => d.world.connections.get(conn.id)?.cursor ?? null,
    setCursor: (cursor) => d.world.connections.setCursor(conn.id, cursor),
    land: (tableName, items, options) => {
      const t = tableOf(d.world, c, tableName)
      if (!t) throw new Problem(`The table ${tableName} is not there.`)
      const out = d.world.records.land(
        t.id,
        items,
        { connector: c.manifest.name, account: conn.account },
        { actor },
        options,
      )
      // what it met and did not bring in: rows a person removed before, or a read that only keeps
      // rows up to date
      const skipped = items.length - out.added - out.changed - out.same
      d.count(conn.id, t.id, t.name, { ...out, read: items.length, skipped })
      return out
    },
    gone: (tableName, keys, options) => {
      const t = tableOf(d.world, c, tableName)
      if (!t) throw new Problem(`The table ${tableName} is not there.`)
      const itemKeys = d.world.records.itemKeys(t.id)
      const by = options?.by
      return d.world.records.gone(
        t.id,
        by
          ? d.world.records.idsWhere(t.id, by, keys).flatMap((id) => itemKeys.get(id) ?? [])
          : keys,
        { connector: c.manifest.name, account: conn.account },
        { actor },
      )
    },
    // the browser as the connection's owner: their profile for its site
    ...(d.browser ? { browser: () => (d.browser as () => BrowserEngine)().as(ownerOf(conn)) } : {}),
    keys: (tableName) => {
      const t = tableOf(d.world, c, tableName)
      return t ? d.world.records.keys(t.id) : []
    },
    keepFile: (name, bytes, mime) => {
      const known = d.world.files.file(hashOf(bytes))
      takeIn(d.world, bytes, name, mime, { actor })
      d.count(conn.id, 'files', 'Files', { read: 1, ...(known ? { same: 1 } : { added: 1 }) })
      return { isNew: !known }
    },
    journal: (words, data) => {
      d.world.line({
        actor,
        kind: 'connector_call',
        words,
        data: { ...(data ?? {}), connection: conn.id },
      })
    },
    // counted for the read under way, and said on the connection when it ends (rules N1)
    leftOut: (table, n) => {
      const t = table === 'files' ? null : tableOf(d.world, c, table)
      d.count(conn.id, t?.id ?? table, t?.name ?? 'Files', { read: n, leftOut: n })
    },
  }
}
