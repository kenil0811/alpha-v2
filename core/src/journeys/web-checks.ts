// A journey's checks on what left for the web: what reached its made-up site, which web calls
// the gate let go, and the browser's steps kept with their pictures. Read from the site and the journal, never from the model's prose.
import { z } from 'zod'
import type { World } from '../world/world.ts'
import type { Site } from './site.ts'

export const SiteRequests = z.object({
  path: z.string(),
  count: z.number(),
  at_least: z.boolean().optional(),
})
// browser steps (browse) kept with a picture of the page, at least so many
export const StepPictures = z.number()
// web calls (WebFetch, look) that ran, their address matching
export const WebCalls = z.object({ matches: z.string(), count: z.number() })

type Saw = { check: string; ok: boolean; saw: string }

export function webCheck(check: object, site: Site | null, world: World): Saw | null {
  if ('site_requests' in check) {
    const { path, count, at_least } = check.site_requests as z.infer<typeof SiteRequests>
    const got = (site?.requests ?? []).filter((r) => r.split('?')[0] === path)
    return {
      check: `${at_least ? 'at least ' : ''}${count} requests to the made-up site at ${path}`,
      ok: at_least ? got.length >= count : got.length === count,
      saw: got.join(', ') || 'none',
    }
  }
  if ('web_calls' in check) {
    const { matches, count } = check.web_calls as z.infer<typeof WebCalls>
    const ran = new Set(
      world.lines({ kinds: ['called'] }).map((l) => (l.data as { call?: string }).call),
    )
    const re = new RegExp(matches, 'i')
    const urls = world
      .lines({ kinds: ['call'] })
      .map((l) => l.data as { tool?: string; call?: string; input?: { url?: unknown } })
      .filter((d) => (d.tool === 'WebFetch' || d.tool === 'look') && ran.has(d.call))
      .map((d) => String(d.input?.url ?? ''))
      .filter((u) => re.test(u))
    return {
      check: `${count} web calls let go to an address matching /${matches}/`,
      ok: urls.length === count,
      saw: urls.join(', ') || 'none',
    }
  }
  if ('step_pictures' in check) {
    const want = check.step_pictures as number
    const got = world
      .lines({ kinds: ['called'] })
      .filter((l) => (l.data as { picture?: string }).picture).length
    return {
      check: `at least ${want} steps kept with a picture of the page`,
      ok: got >= want,
      saw: String(got),
    }
  }
  return null
}
