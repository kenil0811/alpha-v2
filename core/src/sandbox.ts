// The one sandbox the core's children run under (design §2, §5): Anthropic's sandbox runtime, its
// proxy in the core's own process. Nothing is allowed for everyone: a child reaches only the hosts
// listed for its own process under its id (a connector's, step 2, part 1, slice 2), so a script,
// which is given no list, reaches nothing. What the proxy refuses is told to whoever listed the id.
import { randomBytes } from 'node:crypto'
import { realpathSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { SandboxManager } from '@anthropic-ai/sandbox-runtime'

// alpha-v2: its node_modules, the core and the connectors that ship with it
export const CODE = realpathSync(join(import.meta.dirname, '..', '..'))

let ready: Promise<void> | null = null
const refusedTo = new Map<string, (host: string) => void>()
const seen = new WeakSet<object>()

// A start that fails is forgotten, so the next child tries again rather than failing for ever
// (item 14 of the problems list, 25 Oct).
export function sandbox(): Promise<void> {
  if (!ready) {
    const starting = SandboxManager.initialize({
      network: { allowedDomains: [], deniedDomains: [], strictAllowlist: false },
      filesystem: { denyRead: [homedir()], allowRead: [CODE], allowWrite: [], denyWrite: [] },
    }).then(() => {
      SandboxManager.getSandboxViolationStore().subscribe((all) => {
        for (const v of all) {
          if (seen.has(v)) continue
          seen.add(v)
          const id = v.encodedCommand ? Buffer.from(v.encodedCommand, 'base64').toString() : ''
          const host = /network-outbound (\S+)/.exec(v.line)?.[1]
          if (host) refusedTo.get(id)?.(host)
        }
      })
    })
    ready = starting
    starting.catch(() => {
      if (ready === starting) ready = null
    })
  }
  return ready
}

// An id for one child's allow list: unguessable, as the proxy takes whoever presents it.
export const newId = () => randomBytes(16).toString('base64url')

// The hosts one child may reach (host or host:port), replacing what it had; and who hears of a
// host it was refused.
export function allow(id: string, hosts: string[], refused?: (host: string) => void): void {
  SandboxManager.registerCommandNetworkLists(id, { allowedDomains: hosts })
  if (refused) refusedTo.set(id, refused)
}

export function forget(id: string): void {
  SandboxManager.unregisterCommandNetworkLists(id)
  refusedTo.delete(id)
}
