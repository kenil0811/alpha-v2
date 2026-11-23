// Whether a newer Alpha is out (Vikas, 23 Nov: Check for updates in Settings › General). The feed
// is a JSON file `{ version, url }` at the address the install names in ALPHA_UPDATES; which
// address is Kenil's to choose. With none, updates are not set up on this Alpha.
import { z } from 'zod'
import { Refused } from '../world/kinds.ts'
import type { UpdateView } from './types.ts'

// Whether version a (1.2.3) is after b; a core run from a repository has no version and is
// never behind.
export const newer = (a: string, b: string) => {
  const [x, y] = [a, b].map((v) => v.split('.').map(Number))
  for (let i = 0; i < 3; i++)
    if ((x?.[i] ?? 0) !== (y?.[i] ?? 0)) return (x?.[i] ?? 0) > (y?.[i] ?? 0)
  return false
}

const Feed = z.object({
  version: z.string(),
  // only a web address is opened from the window
  url: z
    .string()
    .url()
    .refine((u) => /^https?:/.test(u)),
})

export async function updateFrom(
  feed: string | undefined,
  current: string,
  get: typeof fetch = fetch,
): Promise<UpdateView> {
  if (!feed) return { current, set: false }
  const out = await get(feed, { signal: AbortSignal.timeout(10_000) })
    .then((r) => (r.ok ? r.json() : null))
    .then((j) => Feed.safeParse(j))
    .catch(() => null)
  if (!out?.success) throw new Refused('The update feed did not answer; try again later.')
  const { version, url } = out.data
  return newer(version, current)
    ? { current, set: true, newest: version, url }
    : { current, set: true }
}
