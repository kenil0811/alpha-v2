// A connection as the window shows it, the same on Connections and on a computer's page: its
// account and state, who set it up, what it keeps, what it may reach and was refused, and the
// computer it runs on.
import { bridges } from '../bridge/hub.ts'
import { tableOf } from '../connectors/places.ts'
import type { Connection } from '../world/connections.ts'
import type { ConnectionView } from './connector-types.ts'
import type { BaseCtx } from './ctx.ts'

export function connectionViews(ctx: BaseCtx): (k: Connection) => ConnectionView {
  const { world, engine, user } = ctx
  // the hosts each connector was refused, newest first, once each
  const refused = new Map<string, { host: string; at: string }[]>()
  for (const l of world.lines({ kinds: ['reach_refused'], limit: 500 }).reverse()) {
    const name = String(l.data.connector)
    const list = refused.get(name) ?? []
    if (!list.some((r) => r.host === l.data.host) && list.length < 5)
      list.push({ host: String(l.data.host), at: l.at })
    refused.set(name, list)
  }
  // who set a connection up, in words
  const ownerWords = (madeBy: string) => {
    const [kind, id] = madeBy.split(/:(.*)/s)
    if (kind === 'person') return id === user.id ? 'You' : (world.user(id ?? '')?.name ?? 'Someone')
    return 'Alpha'
  }
  // the person's computer a connection runs on, by the name it calls itself
  const computerOf = (id: string | null) => {
    const pc = id ? world.computers.get(id) : undefined
    return pc ? { name: pc.name, online: bridges.online(pc.id) } : null
  }
  const signIn = engine.connectors?.signIn
  return (k) => {
    const c = engine.connectors?.find(k.connector)
    return {
      id: k.id,
      connector: k.connector,
      title: c?.manifest.title ?? k.connector,
      account: k.account,
      inBrowser: c?.manifest.auth === 'browser',
      signsInWith:
        c?.manifest.oauth && signIn ? signIn.provider(c.manifest.oauth.provider).title : null,
      loaded: !!c,
      state: k.state,
      owner: ownerWords(k.madeBy),
      health: c ? k.health : 'Its connector is not loaded, so this connection does not read.',
      lastSyncAt: k.lastSyncAt,
      settings: k.state === 'needs_sign_in' ? (c?.manifest.system?.pane ?? null) : null,
      tables: (c?.tables ?? []).flatMap((spec) => {
        const t = c && tableOf(world, c, spec.name)
        return t ? [{ id: t.id, name: t.name, hidden: t.hidden }] : []
      }),
      reaches: [...new Set([...(c?.manifest.reaches ?? []), ...k.hosts])],
      refused: refused.get(k.connector) ?? [],
      canAllow: !!c?.manifest.chosenSites,
      computer: computerOf(k.computer),
      leftOut: k.leftOut ?? 0,
    }
  }
}
