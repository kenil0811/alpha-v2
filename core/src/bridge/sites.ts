// Where a person signs in to a site, and where Alpha then works on it (step 4 of the Bridge,
// 17 Nov): on a hosted Alpha, a site that refuses a server (core/config/sites.yaml), or one whose
// sign-in on the server failed again and again, is signed in to on the person's own computer,
// through Alpha Bridge's Browser; every other site, and everything on a Mac's own Alpha, stays
// here. Alpha decides, never the person; with no computer ready, the sign-in says what it needs.
import type { BrowserEngine, OnComputer } from '@alpha/connector-sdk'
import { config } from '../config.ts'
import type { Computer } from '../world/computers.ts'
import type { World } from '../world/world.ts'
import { siteContext } from './cdp.ts'
import { bridges } from './hub.ts'

export type SignInPlace = { here: true } | { computer: Computer } | { refused: string }

// Whether this site is one the person signs in to on their own computer.
export const onComputer = (mine: BrowserEngine, site: string) =>
  config.sites().on_computer.includes(site) || mine.moved(site)

export function signInPlace(
  world: World,
  mine: BrowserEngine, // the browser as the person
  user: string,
  site: string,
  hosted: boolean,
): SignInPlace {
  if (!hosted || !onComputer(mine, site)) return { here: true }
  const pcs = world.computers.of(user)
  if (!pcs.length)
    return {
      refused: `${site} refuses Alpha on a server, so you sign in to it on your own computer: add the computer under Your computers with Alpha Bridge, turn on Browser in its menu, then sign in again.`,
    }
  const up = pcs.filter((p) => bridges.online(p.id) && !bridges.pausedOf(p.id))
  const first = pcs[0] as Computer
  if (!up.length)
    return { refused: `${first.name} is off now: turn it on, then sign in to ${site} again.` }
  const ready = up.find((p) => bridges.browserOn(p.id))
  if (!ready)
    return {
      refused: `Turn on Browser in Alpha Bridge's menu on ${(up[0] as Computer).name}, then sign in to ${site} again.`,
    }
  return { computer: ready }
}

// How the core's browser reaches a site signed in to on a computer.
export function computerSites(world: World): OnComputer {
  return {
    away: (pc, site) => {
      const name = world.computers.get(pc)?.name ?? 'Your computer'
      if (!bridges.online(pc))
        return `${name} is off now: Alpha works on ${site} there once it is back.`
      if (bridges.pausedOf(pc))
        return `${name} is paused by its person: Alpha works on ${site} there once it is resumed.`
      if (!bridges.browserOn(pc))
        return `Browser is off in Alpha Bridge on ${name}: once it is on, Alpha works on ${site} there.`
      return null
    },
    context: siteContext,
    signOut: (pc, site) => bridges.signOutSite(pc, site),
  }
}
