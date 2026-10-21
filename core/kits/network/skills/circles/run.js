// Circles: who belongs in each of the person's circles, proposed for their yes. Each person is
// read with what is known of them (title, company, address domain, the rows of the person's
// modules that name them, how often they are in touch); a name alone is never enough, so someone
// known by nothing else is not sorted. The model sorts them against the person's own words for
// each circle; each proposal lands in Members as Proposed with why, and each circle's proposals wait
// on one card. What the person decided (In, Left out) is never proposed again.

const today = () => new Date().toISOString().slice(0, 10)
const first = (v) => (Array.isArray(v) ? v[0] : v)
const MAIL_SERVICES =
  /@(gmail|googlemail|outlook|hotmail|live|yahoo|icloud|me|mac|aol|proton|protonmail)\./i

// What is known of someone, in a line: never their name alone.
function facts(p) {
  const work = p.emails.filter((e) => !MAIL_SERVICES.test(e)).map((e) => e.split('@')[1])
  return [
    p.titles.length ? `title: ${p.titles.join(', ')}` : '',
    p.companies.length ? `at ${p.companies.join(', ')}` : '',
    work.length ? `address at ${[...new Set(work)].join(', ')}` : '',
    ...p.named.map(
      (n) => `named in ${n.table} (${n.field}) on ${n.rows} row${n.rows === 1 ? '' : 's'}`,
    ),
    p.count ? `${p.count} emails or meetings in 90 days, last ${String(p.last).slice(0, 10)}` : '',
  ]
    .filter(Boolean)
    .join('; ')
}

export default async (alpha) => {
  const circles = (await alpha.rows.list('Circles')).filter(
    (c) => c.values.Name && c.values['Who belongs'],
  )
  if (!circles.length) return { words: 'No circle says who belongs in it yet.' }
  const since = alpha.input.lastRun ?? null
  // a circle new or changed since the last run is read against everyone; otherwise only people
  // Alpha met since then
  const changed = circles.some((c) => !since || c.updatedAt > since)
  const members = await alpha.rows.list('Members')
  const asked = new Set(members.map((m) => `${m.values.Person}:${first(m.values.Circle)}`))
  const people = (await alpha.people.list()).filter(
    (p) => facts(p) && (changed || (p.since && p.since > since)),
  )
  if (!people.length) return { words: 'No one new to sort into circles.' }
  const judged = await alpha.judge({
    groups: circles.map((c) => ({ name: c.values.Name, about: c.values['Who belongs'] })),
    items: people.map((p) => ({ id: p.id, facts: `${p.name}; ${facts(p)}` })),
  })
  const byName = new Map(circles.map((c) => [c.values.Name, c]))
  const fresh = new Map()
  for (const j of judged) {
    const c = j.group ? byName.get(j.group) : null
    if (!c || asked.has(`${j.id}:${c.id}`)) continue
    const list = fresh.get(c.id) ?? []
    list.push({
      key: `${j.id}:${c.id}`,
      values: { Person: j.id, Circle: c.id, State: 'Proposed', Why: j.why, 'Proposed on': today() },
    })
    fresh.set(c.id, list)
  }
  if (!fresh.size) return { words: `Read ${people.length} people; none newly fits a circle.` }
  await alpha.rows.land('Members', [...fresh.values()].flat())
  const rows = new Map((await alpha.rows.list('Members')).map((m) => [m.key, m.id]))
  const said = []
  for (const [cid, list] of fresh) {
    const name = circles.find((c) => c.id === cid)?.values.Name
    await alpha.review({
      words: `${list.length} ${list.length === 1 ? 'person looks' : 'people look'} like ${name}`,
      table: 'Members',
      rows: list.map((i) => rows.get(i.key)).filter(Boolean),
      field: 'State',
      choices: ['In', 'Left out'],
      note: 'Why',
    })
    said.push(`${list.length} for ${name}`)
  }
  return { words: `Proposed ${said.join(', ')}, for your yes.` }
}
