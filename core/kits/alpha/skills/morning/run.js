// Morning: the day in one line, and one or two suggestions as tasks on a card. It runs Alpha's
// daily skills first: Governance (noticed rules on their Save cards, walled agents named) and the
// Interviewer (Interview me's pool re-ranked), so the line counts what they put to the person.
const n = (k, one, many) => `${k} ${k === 1 ? one : many}`

export default async (alpha) => {
  const gov = await alpha.governance.review()
  const iv = await alpha.interview.prepare()
  const t = await alpha.home.today()
  const parts = []
  if (t.tasks.due.length) {
    const overdue = t.tasks.due.filter((x) => x.overdue).length
    parts.push(
      `${n(t.tasks.due.length, 'task is', 'tasks are')} due${overdue ? ` (${n(overdue, 'is', 'are')} overdue)` : ''}`,
    )
  } else parts.push('nothing is due')
  if (t.cards.length) parts.push(`${n(t.cards.length, 'card waits', 'cards wait')} for you`)
  const changed = t.changed.filter((r) => r.state === 'ok')
  const failed = t.changed.filter((r) => r.state === 'failed')
  if (changed.length)
    parts.push(
      `${n(changed.length, 'run', 'runs')} overnight: ${changed
        .slice(0, 3)
        .map((r) => r.words)
        .join('; ')}`,
    )
  if (failed.length) parts.push(`${n(failed.length, 'run', 'runs')} did not finish`)
  for (const w of gov.walls)
    parts.push(`${w.agent} keeps hitting a wall (${w.runs} runs this week)`)
  if (iv.count) parts.push(`${n(iv.count, 'question', 'questions')} worth asking in Interview me`)
  if (t.coming.length) {
    const next = t.coming[0]
    parts.push(
      `next up ${next.name} at ${new Date(next.at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`,
    )
  }
  // tell puts the agent's name in front, so the line reads "Morning: nothing is due; …"
  const line = parts.join('; ')
  await alpha.tell(`${line[0].toUpperCase()}${line.slice(1)}.`)

  // suggestions: at most one, a a task the person takes or leaves
  const tasks = []
  const quiet = t.tasks.quiet[0]
  if (quiet)
    tasks.push({
      title: `Pick up or drop: ${quiet.title}`,
      notes: `Open since ${quiet.since} with no change; decide whether it still matters.`,
      priority: 'low',
    })
  // never a task to answer cards: each card is its own row in Needs you (Vikas, 30 Oct)
  if (tasks.length) await alpha.task.propose(tasks, 'Morning suggests')
  return {
    words: `${parts[0]}${tasks.length ? `; ${n(tasks.length, 'suggestion', 'suggestions')} on a card` : ''}.`,
  }
}
