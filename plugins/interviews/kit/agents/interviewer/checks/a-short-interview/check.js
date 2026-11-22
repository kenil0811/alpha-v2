// The Interviewer's regular check (the onboarding plan, call 35; the redesign of 22 Nov, call 21):
// it only looks, at what changed since it last looked (the month before, the first time), and
// wakes the Interviewer only when it found something worth a short interview. A month with
// nothing new costs nothing, leaves no row and no task.
const MONTH = 31 * 86_400_000
const same = (w) =>
  String(w)
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

export default async (alpha) => {
  const since = alpha.input?.lastRun ?? new Date(Date.now() - MONTH).toISOString()
  const lines = await alpha.journal.list({ since, kinds: ['said', 'wrote', 'task'], limit: 500 })
  const theirs = lines.filter((l) => String(l.who).startsWith('person '))
  // the same request said three times or more
  const said = new Map()
  for (const l of theirs.filter((x) => x.kind === 'said')) {
    const k = same(l.words).slice(0, 100)
    if (k.length >= 12) said.set(k, (said.get(k) ?? 0) + 1)
  }
  const again = [...said].filter(([, n]) => n >= 3).map(([request, times]) => ({ request, times }))
  // values they typed over a machine's, and tasks they made by hand
  const corrected = theirs.filter((l) => l.kind === 'wrote').length
  const tasks = theirs.filter((l) => l.kind === 'task').length
  // apps and sites their computer's readers listed again since
  const newer = async (table, field) =>
    (await alpha.rows.list(table).catch(() => []))
      .filter((r) => r.updatedAt && r.updatedAt > since)
      .map((r) => r.values[field])
      .filter(Boolean)
  const apps = await newer('Apps', 'App')
  const sites = await newer('Sites', 'Site')
  const wake =
    again.length > 0 || corrected >= 3 || tasks >= 3 || apps.length > 0 || sites.length > 0
  if (!wake) return { wake: false }
  return {
    wake: true,
    found: { since, again, corrected, tasks, apps: apps.slice(0, 20), sites: sites.slice(0, 20) },
  }
}
