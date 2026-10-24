// Watson: what the person said since last time, noticed and put to them.
const day = (at) => String(at).slice(0, 10)
const short = (w, n = 80) => (w.length > n ? `${w.slice(0, n - 1)}…` : w)
const dateIn = (why) => (/(\d{4}-\d{2}-\d{2})/.exec(why ?? '') ?? [])[1] ?? null

export default async (alpha) => {
  const lines = (await alpha.journal.list({ since: alpha.input.lastRun, kinds: ['said'] })).filter(
    (l) => l.words.trim().length > 12,
  )
  if (!lines.length) return { words: 'Nothing said since last time.' }
  const judged = await alpha.judge({
    groups: [
      {
        name: 'Promise',
        about:
          'the person promised to do something, or said someone owes them something; end why with the due date as YYYY-MM-DD when one is said or implied',
      },
      {
        name: 'Decision',
        about: 'the person decided something, settled a question, chose between options',
      },
      {
        name: 'Fact',
        about:
          'a fact about a person or a company the person stated: a role, a number, a relationship',
      },
    ],
    items: lines.map((l) => ({ id: String(l.id), facts: l.words })),
  })
  const byId = new Map(lines.map((l) => [String(l.id), l]))
  const promises = []
  const decisions = []
  const facts = []
  for (const j of judged) {
    const l = byId.get(String(j.id))
    if (!l || !j.group) continue
    if (j.group === 'Promise')
      promises.push({
        title: short(l.words),
        notes: `Said on ${day(l.at)}: “${l.words}”`,
        // a date only when the model found one in what was said
        ...(dateIn(j.why) ? { due: dateIn(j.why) } : {}),
        priority: 'normal',
      })
    else if (j.group === 'Decision')
      decisions.push({
        key: `line:${l.id}`,
        values: {
          Decision: short(l.words, 200),
          'Said on': day(l.at),
          State: 'Proposed',
          Why: j.why ?? '',
        },
      })
    else if (j.group === 'Fact')
      facts.push({
        key: `line:${l.id}`,
        values: {
          About: (j.why ?? '').split(':')[0].slice(0, 60),
          Fact: short(l.words, 200),
          'Said on': day(l.at),
          State: 'Proposed',
          Why: j.why ?? '',
        },
      })
  }
  const said = []
  if (promises.length) {
    await alpha.task.propose(
      promises,
      `Watson noticed ${promises.length === 1 ? 'a promise' : `${promises.length} promises`}`,
    )
    said.push(`${promises.length} ${promises.length === 1 ? 'promise' : 'promises'}`)
  }
  for (const [table, rows, choices, what] of [
    ['Decisions', decisions, ['Kept', 'Dropped'], 'decision'],
    ['Noticed', facts, ['Confirmed', 'Dropped'], 'fact'],
  ]) {
    if (!rows.length) continue
    await alpha.rows.land(table, rows)
    const ids = new Map((await alpha.rows.list(table)).map((r) => [r.key, r.id]))
    await alpha.review({
      words: `Watson noticed ${rows.length === 1 ? `a ${what}` : `${rows.length} ${what}s`}`,
      table,
      rows: rows.map((r) => ids.get(r.key)).filter(Boolean),
      field: 'State',
      choices,
      note: 'Why',
    })
    said.push(`${rows.length} ${rows.length === 1 ? what : `${what}s`}`)
  }
  return {
    words: said.length
      ? `Noticed ${said.join(', ')}, for your yes.`
      : `Read ${lines.length} lines; nothing to notice.`,
  }
}
