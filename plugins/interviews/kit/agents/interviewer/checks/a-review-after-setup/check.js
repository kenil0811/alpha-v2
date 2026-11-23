// The Interviewer's review three days after setup (Vikas, 23 Nov; proposed for Kenil's review): it
// only looks, once per person, on the first look after their third day since they finished Get to
// know you (when their Interview sources were last marked), at what the daily reading of their
// computer brought since. It wakes the Interviewer only when a read brought something new; with
// nothing new it costs nothing, leaves no card and no task.
const DAY = 86_400_000
const AFTER = 3 * DAY
const READERS = ['connector browsing', 'connector apps']

export default async (alpha) => {
  const now = alpha.input?.now ? Date.parse(alpha.input.now) : Date.now()
  const since = alpha.input?.lastRun ? Date.parse(alpha.input.lastRun) : now - DAY
  const rows = async (table) => (await alpha.rows.list(table).catch(() => [])) ?? []
  // when each person set up: the last time their sources were marked in Get to know you
  const setUp = new Map()
  for (const r of await rows('Interview sources')) {
    const who = String(r.values.Person ?? '')
    const at = Date.parse(r.updatedAt ?? '')
    if (who && at && !(setUp.get(who) >= at)) setUp.set(who, at)
  }
  // whose third day passed since the last look: each person once
  const due = [...setUp].filter(([, at]) => at + AFTER > since && at + AFTER <= now)
  if (!due.length) return { wake: false }
  const from = Math.min(...due.map(([, at]) => at))
  // a read of their computer since that brought something new
  const reads = await alpha.journal.list({
    since: new Date(from).toISOString(),
    kinds: ['connection_read'],
    limit: 500,
  })
  if (!reads.some((l) => READERS.includes(l.who) && /something new/.test(l.words)))
    return { wake: false }
  const newer = async (table, field) =>
    (await rows(table))
      .filter((r) => r.updatedAt && Date.parse(r.updatedAt) > from)
      .map((r) => r.values[field])
      .filter(Boolean)
      .slice(0, 20)
  return {
    wake: true,
    found: {
      people: due.map(([p]) => p),
      sites: await newer('Sites', 'Site'),
      apps: await newer('Apps', 'App'),
    },
  }
}
