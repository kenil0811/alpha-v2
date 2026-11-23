// What is due: each schedule's triggers, read against the clock and the journal, one run at a time.
import { type Trigger, triggersOf } from '@alpha/kit-sdk'
import { Cron } from 'croner'
import { config } from '../../config.ts'
import { all, run as exec, one } from '../../world/db.ts'
import { gapOf, latestAt, type Schedule, shownSchedules } from '../schedules.ts'
import type { ScheduleRunner } from './runner.ts'
import { CHANGE_KINDS, type Filed, RUN_AGAIN, type RunOutcome, type RunRowDb } from './types.ts'

// What is due by each schedule's trigger, and tasks whose cards are all decided. One run of a
// schedule at a time. Each schedule is judged on its own: one that cannot be judged says so, and
// the others still run.
export async function runDue(runner: ScheduleRunner, nowMs = Date.now()): Promise<void> {
  resumeRuns(runner)
  for (const a of shownSchedules(runner.world)) {
    let judged: Judged | null
    try {
      judged = judge(runner, a, nowMs)
    } catch (err) {
      const why = err instanceof Error ? err.message : String(err)
      const cursor = readsJournal(a) ? String(runner.world.lastLineId()) : null
      failed(runner, a, { start: why }, {}, cursor)
      continue
    }
    if (!judged) continue
    const { given, cursorTo } = judged
    // an agent's check is told the tick's time, so a look "three days after" counts by its clock
    const handed = a.agent ? { ...given, now: new Date(nowMs).toISOString() } : given
    const out = await runner.runSchedule(a, undefined, handed).catch(
      (err): RunOutcome => ({
        id: '',
        state: 'failed',
        words: err instanceof Error ? err.message : String(err),
        result: null,
      }),
    )
    if (out.state === 'ok') {
      runner.failures.delete(a.id)
      // the run counts at the tick's time, the clock its next one is judged by
      exec(
        runner.world.db,
        'UPDATE schedules SET cursor = coalesce(?, cursor), last_run_at = ? WHERE id = ?',
        cursorTo,
        new Date(nowMs).toISOString(),
        a.id,
      )
      continue
    }
    // a run that stopped at the person's card (a sign-in, a site to reach) is waiting on them, not
    // failing: it goes again on their yes
    if (
      out.id &&
      one(
        runner.world.db,
        "SELECT 1 FROM cards WHERE run_id = ? AND kind = 'permission' AND state = 'waiting'",
        out.id,
      )
    )
      continue
    failed(runner, a, { run: out.words }, given, cursorTo)
  }
}

interface Judged {
  given: { filed?: Filed[] }
  cursorTo: string | null // where the journal stood as it was judged
}

// Whether a schedule runs now, and what it is handed: none when it is off, running, waiting on the
// person, not due, or past its budget.
function judge(runner: ScheduleRunner, a: Schedule, nowMs: number): Judged | null {
  if (a.state !== 'on' || !triggersOf(a.trigger).length) return null
  if (one(runner.world.db, "SELECT 1 FROM runs WHERE schedule_id = ? AND state = 'running'", a.id))
    return null
  // waiting on the person's Try again or Leave it
  if (runner.held.has(a.id)) return null
  // a run of it waits on the person's card (a sign-in, a site to allow): it goes again on their
  // yes, not at every tick before it
  if (
    one(
      runner.world.db,
      "SELECT 1 FROM cards c JOIN runs r ON r.id = c.run_id WHERE r.schedule_id = ? AND c.kind = 'permission' AND c.state = 'waiting'",
      a.id,
    )
  )
    return null
  // a run still open holds the next one, and they become one when it closes
  if (runner.world.tasks.openOfSchedule(a.id)) return null
  // where the journal stands as the schedule is judged: its place moves here only after a run
  // that ended well, so a failed run is handed the same things again
  const cursorTo = readsJournal(a) ? String(runner.world.lastLineId()) : null
  const given = runner.due(a, nowMs)
  if (!given) return null
  const place = runner.placeOf(a)
  const file = place ? runner.fileOf(a.id, place) : null
  if (place && file && runner.overRuns(a, file, nowMs)) {
    // said once a day, not at every tick
    const said = runner.budgetSaid.get(a.id) ?? 0
    if (nowMs - said >= 86_400_000) {
      runner.budgetSaid.set(a.id, nowMs)
      runner.world.line({
        actor: { kind: 'schedule', id: a.name },
        kind: 'run_step',
        words: `${a.name} has run ${file.budget.runs} time${file.budget.runs === 1 ? '' : 's'} in a day, its budget; it runs again tomorrow.`,
        module: a.module,
      })
    }
    return null
  }
  return { given, cursorTo }
}

// A schedule that did not finish a run, or could not be judged to start one. A run says so in its
// own row; a start that failed says so in a line. After run_retries in a row the person decides on a
// card, and the schedule waits on it.
function failed(
  runner: ScheduleRunner,
  a: Schedule,
  why: { run: string } | { start: string },
  given: { filed?: Filed[] },
  cursorTo: string | null,
): void {
  const times = (runner.failures.get(a.id) ?? 0) + 1
  runner.failures.set(a.id, times)
  if ('start' in why) {
    runner.world.line({
      actor: { kind: 'schedule', id: a.name },
      kind: 'job_failed',
      words: `${a.name} could not start: ${why.start}`,
      data: { schedule: a.id, times },
      module: a.module,
    })
    runner.notify()
  }
  if (times < config.limits().run_retries) return
  const files = given.filed?.map((f) => f.name) ?? []
  const card = runner.world.cards.open({
    kind: 'suggestion',
    words:
      'start' in why
        ? `${a.name} could not start ${times} times: ${why.start}`
        : `${a.name} did not finish ${times} times${files.length ? ` on ${files.join(', ')}` : ''}: ${why.run}`,
    restsOn: [`${a.name}'s last ${times} ${'start' in why ? 'starts' : 'runs'}`],
    options: ['Try again', 'Leave it'],
    call: { tool: RUN_AGAIN, input: { schedule: a.id, cursor: cursorTo } },
    actor: { kind: 'schedule', id: a.name },
    user: runner.owner,
    module: a.module,
  })
  runner.held.set(a.id, card.id)
  runner.notify()
}

// A schedule's run that opened a card (a sign-in, a site to reach, a removal) and ended on it goes
// again at the next tick once the person has said yes, as a task's does: the yes is used while it
// still means what it meant, not at the schedule's next trigger, which can be the next day. A card
// the desk's own turn opened is the desk's to carry on; a draft's yes sends the draft itself and
// starts nothing.
export function resumeRuns(runner: ScheduleRunner): void {
  for (const a of shownSchedules(runner.world)) {
    if (runner.held.has(a.id)) continue
    const last = one<RunRowDb>(
      runner.world.db,
      'SELECT * FROM runs WHERE schedule_id = ? ORDER BY started_at DESC LIMIT 1',
      a.id,
    )
    const ended = last?.ended_at
    if (!last || !ended || last.state === 'running') continue
    const cards = all<{ state: string; decided_at: string | null }>(
      runner.world.db,
      `SELECT state, decided_at FROM cards WHERE run_id = ? AND kind = 'permission' AND turn_id IS NULL
         AND json_extract(call, '$.tool') != 'schedule_draft'`,
      last.id,
    )
    if (!cards.length || cards.some((c) => c.state === 'waiting')) continue
    if (!cards.some((c) => c.state === 'yes' && c.decided_at && c.decided_at > ended)) continue
    runner.world.line({
      actor: { kind: 'schedule', id: a.name },
      kind: 'run_step',
      words: `${a.name} runs again on your yes.`,
      module: a.module,
    })
    // the run started here is the schedule's newest, so the next tick finds no yes after it
    runner
      .runSchedule(a, { user: runner.owner, turn: null }, {}, { asked: true })
      .catch(() => undefined)
  }
}

// Whether any of a schedule's triggers reads the journal (a filing, a change), so its place in it
// matters.
function readsJournal(a: Schedule): boolean {
  return triggersOf(a.trigger).some((t) => 'filed' in t || 'changes' in t)
}

// Whether a schedule is due, and what its trigger hands it when it is (a filing's documents).
export function due(
  runner: ScheduleRunner,
  a: Schedule,
  nowMs: number,
): false | { filed?: Filed[] } {
  const is = runner.isDue(a, nowMs)
  return is === true ? {} : is
}

// Due by any of its triggers. The ones that read the journal (filed, changes) share the
// schedule's cursor: it is read once before and moved once after, so a list of them agrees.
export function isDue(
  runner: ScheduleRunner,
  a: Schedule,
  nowMs: number,
): boolean | { filed: Filed[] } {
  const seen = Number(a.cursor ?? 0)
  let due: boolean | { filed: Filed[] } = false
  let reads = false
  for (const t of triggersOf(a.trigger)) {
    const is = runner.isDueBy(a, t, nowMs, seen)
    if ('filed' in t || 'changes' in t) reads = true
    if (is === true && due === false) due = true
    else if (typeof is === 'object')
      due = typeof due === 'object' ? { filed: [...due.filed, ...is.filed] } : is
  }
  // the cursor moves in runDue, after a run that ended well; nothing moves here
  void reads
  return due
}

export function isDueBy(
  runner: ScheduleRunner,
  a: Schedule,
  t: Trigger,
  nowMs: number,
  seen: number,
): boolean | { filed: Filed[] } {
  const last = a.lastRunAt ? Date.parse(a.lastRunAt) : 0
  if ('every' in t) {
    if (t.every === 'hour') return nowMs - last >= 3_600_000
    return last < latestAt(t, nowMs).getTime() && nowMs - last >= gapOf(t.every)
  }
  if ('cron' in t) {
    const next = new Cron(t.cron).nextRun(new Date(last || nowMs - 60_000))
    return !!next && next.getTime() <= nowMs
  }
  if ('filed' in t) {
    // a document read, or put on a row, since the schedule last looked (not by the schedule itself)
    const files = new Set<string>()
    for (const l of runner.world.lines({ after: seen, kinds: ['filed'] })) {
      const d = l.data as { file?: string; document?: string; record?: string; off?: boolean }
      if (l.actor.kind === 'schedule' && l.actor.id === a.name) continue
      if (d.file && (d.document || (d.record && !d.off))) files.add(d.file)
    }
    const filed: Filed[] = []
    for (const hash of files) {
      const doc = runner.world.files.document(hash)
      if (!doc) continue // a PDF still being read comes when it is read
      filed.push({
        file: hash,
        name: runner.world.files.file(hash)?.name ?? doc.title,
        document: doc.id,
        kind: doc.kind,
        rows: runner.world.rowsOfFile(hash).map((r) => ({
          table: runner.world.shape.table(r.table)?.name ?? r.table,
          row: r.record,
          kind: r.kind,
        })),
      })
    }
    return filed.length ? { filed } : false
  }
  const tables = new Set(
    (Array.isArray(t.changes) ? t.changes : [t.changes])
      .map((name) => runner.world.shape.table(name)?.id)
      .filter(Boolean),
  )
  if (!tables.size) return false
  const lines = runner.world.lines({ after: seen, kinds: CHANGE_KINDS }).filter(
    (l) =>
      // a revert names every table it put back
      [
        (l.data as { table?: string }).table,
        // (a module's deletion once counted its tables there: a number, not names)
        ...listOf((l.data as { tables?: unknown }).tables),
      ].some((id) => tables.has(id)) &&
      !(l.actor.kind === 'schedule' && l.actor.id === a.name) &&
      !undidOwn(runner, l.data, a),
  )
  return lines.length > 0
}

const listOf = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((t) => typeof t === 'string') : []

// A revert of the schedule's own run does not wake it to do that work again.
function undidOwn(runner: ScheduleRunner, data: Record<string, unknown>, a: Schedule): boolean {
  const run = (data.target as { run?: string } | undefined)?.run
  return (
    !!run &&
    one<{ schedule_id: string | null }>(
      runner.world.db,
      'SELECT schedule_id FROM runs WHERE id = ?',
      run,
    )?.schedule_id === a.id
  )
}
