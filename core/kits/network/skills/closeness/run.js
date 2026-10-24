// Closeness: how close each person in a circle is, by the person's own rules (Closeness rules: the
// first by Order whose numbers someone meets), worked out from their messages and meetings, with
// the rule and the numbers beside the label. In the circles kept warm, someone with an address who
// is quiet for longer than the circle's days is a follow-up, once per quiet spell; those found
// together wait on one card. A note the person says to draft is drafted from Notes for their yes, one address at a time,
// and what became of it is written on the next run.

const DAY = 86_400_000
const KIND = 'Follow-up'
const today = () => new Date().toISOString().slice(0, 10)
const first = (v) => (Array.isArray(v) ? v[0] : v)
const date = (at) => (at ? String(at).slice(0, 10) : null)
const ago = (at) => Math.floor((Date.now() - Date.parse(at)) / DAY)

function ruleWords(r) {
  const parts = []
  if (r.values['At least in 90 days'] != null)
    parts.push(`at least ${r.values['At least in 90 days']} in 90 days`)
  if (r.values['Last within (days)'] != null)
    parts.push(`last within ${r.values['Last within (days)']} days`)
  return `${r.values.Closeness}: ${parts.join(' and ') || 'any contact'}`
}

// the label and the rule that gave it
function closeness(p, rules) {
  if (!p.last) return { label: 'No contact yet', rule: 'No message or meeting known' }
  const days = ago(p.last)
  for (const r of rules) {
    const least = r.values['At least in 90 days']
    const within = r.values['Last within (days)']
    if ((least == null || p.count >= least) && (within == null || days <= within))
      return { label: r.values.Closeness, rule: ruleWords(r) }
  }
  return { label: 'Quiet', rule: 'Quiet: meets none of the rules' }
}

const fill = (words, p) =>
  String(words ?? '')
    .replaceAll('{first}', String(p.name).split(/\s+/)[0] ?? '')
    .replaceAll('{company}', p.companies[0] ?? 'your end')

export default async (alpha) => {
  // what became of the notes since the last run
  const decided = (alpha.input.decided ?? []).filter((o) => o.kind === KIND && o.about)
  if (decided.length)
    await alpha.rows.land(
      'Follow-ups',
      decided.map((o) => ({
        key: `row:${o.about.row}`,
        row: o.about.row,
        values: { Note: o.outcome === 'sent' ? 'Sent' : 'Not sent' },
      })),
    )

  const circles = new Map((await alpha.rows.list('Circles')).map((c) => [c.id, c]))
  const rules = (await alpha.rows.list('Closeness rules'))
    .filter((r) => r.values.Closeness)
    .sort((a, b) => (a.values.Order ?? 99) - (b.values.Order ?? 99))
  const people = new Map((await alpha.people.list()).map((p) => [p.id, p]))
  const inCircles = new Map()
  for (const m of await alpha.rows.list('Members')) {
    if (m.values.State !== 'In') continue
    const c = circles.get(first(m.values.Circle))
    if (!c || !people.has(m.values.Person)) continue
    inCircles.set(m.values.Person, [...(inCircles.get(m.values.Person) ?? []), c])
  }

  // how close each one is
  const rows = [...inCircles].map(([id, cs]) => {
    const p = people.get(id)
    return {
      key: id,
      values: {
        Person: id,
        Circles: cs.map((c) => c.values.Name).join(', '),
        'Last contact': date(p.last),
        'In 90 days': p.count,
        'Wrote first': p.first === 'you' ? 'You' : p.first === 'them' ? 'They' : null,
      },
    }
  })
  if (rows.length) await alpha.rows.land('Closeness', rows)
  const kept = new Map((await alpha.rows.list('Closeness')).map((r) => [r.key, r]))
  for (const [id] of inCircles) {
    const row = kept.get(id)
    const p = people.get(id)
    if (!row) continue
    const { label, rule } = closeness(p, rules)
    const numbers = p.last
      ? `${p.count} in 90 days, last ${date(p.last)} (${ago(p.last)} days ago)`
      : 'No message or meeting known'
    if (row.values.Closeness === label && row.notes?.Closeness === numbers) continue
    await alpha.rows.compute(
      'Closeness',
      row.id,
      { Closeness: label },
      { Closeness: rule },
      { Closeness: numbers },
    )
  }

  // follow-ups: someone quiet for longer than a kept-warm circle's days, once per quiet spell
  const ups = new Map((await alpha.rows.list('Follow-ups')).map((r) => [r.key, r]))
  const due = []
  for (const [id, cs] of inCircles) {
    const warm = cs.filter((c) => c.values['Keep warm'] === 'Yes' && c.values['Every (days)'])
    if (!warm.length) continue
    const every = Math.min(...warm.map((c) => c.values['Every (days)']))
    const p = people.get(id)
    // a follow-up is a note to write: someone with no address to write to is not one
    if (!p.emails.length) continue
    const quiet = p.last ? ago(p.last) : null
    if (quiet !== null && quiet <= every) continue
    const key = `${id}:${date(p.last) ?? 'never'}`
    if (ups.has(key)) continue
    const circle = warm.find((c) => c.values['Every (days)'] === every)?.values.Name
    due.push({
      key,
      values: {
        Person: id,
        'Due since': today(),
        Why:
          quiet === null
            ? `No message or meeting yet; ${circle}: every ${every} days`
            : `No word in ${quiet} days; ${circle}: every ${every} days`,
      },
    })
  }
  if (due.length) {
    await alpha.rows.land('Follow-ups', due)
    const now = new Map((await alpha.rows.list('Follow-ups')).map((r) => [r.key, r.id]))
    await alpha.review({
      words: `${due.length} ${due.length === 1 ? 'person you keep warm is' : 'people you keep warm are'} going quiet`,
      table: 'Follow-ups',
      rows: due.map((d) => now.get(d.key)).filter(Boolean),
      field: 'Answer',
      choices: ['Draft a note', 'Not now'],
      note: 'Why',
    })
  }

  // the notes the person said to draft
  const note = (await alpha.rows.list('Notes')).find((n) => n.values.Kind === KIND)
  let drafted = 0
  let sent = 0
  for (const r of await alpha.rows.list('Follow-ups')) {
    if (r.values.Answer !== 'Draft a note' || r.values.Note || !note) continue
    const p = people.get(r.values.Person)
    const to = p?.emails[0]
    if (!to) {
      await alpha.rows.land('Follow-ups', [
        { key: r.key, row: r.id, values: { Note: 'Needs an address' } },
      ])
      continue
    }
    const out = await alpha.draft.email({
      to,
      subject: fill(note.values.Subject, p),
      body: fill(note.values.Body, p),
      kind: KIND,
      key: r.id,
      about: { table: 'Follow-ups', row: r.id },
      note: r.values.Why,
    })
    await alpha.rows.land('Follow-ups', [
      { key: r.key, row: r.id, values: { Note: out.sent ? 'Sent' : 'Waiting for you' } },
    ])
    if (out.sent) sent++
    else drafted++
  }

  return {
    words: `${[
      `${inCircles.size} in circles`,
      due.length ? `${due.length} going quiet` : '',
      drafted ? `${drafted} note${drafted === 1 ? '' : 's'} drafted for your yes` : '',
      sent ? `${sent} sent under your standing permission` : '',
    ]
      .filter(Boolean)
      .join(', ')}.`,
  }
}
