// A schedule that wakes an agent: its script looks first, when it has one, and what it found goes
// to the agent as a task in a fresh thread. A look that finds nothing leaves a line in the history
// and costs nothing.
import { scheduledText } from '../../engine/ask-words.ts'
import { agentName, cameDue, type Schedule, whenWords } from '../schedules.ts'
import type { ScheduleRunner } from './runner.ts'
import type { RunFor, RunOutcome, RunPlace } from './types.ts'

// What a check answers: wake or no wake, and with wake what it found.
export function checkAnswer(result: unknown): { wake: boolean; found: unknown } | null {
  const r = result as { wake?: unknown; found?: unknown } | null
  return r && typeof r === 'object' && typeof r.wake === 'boolean'
    ? { wake: r.wake, found: r.found ?? null }
    : null
}

export const NOT_AN_ANSWER =
  'its check must return { wake: false }, or { wake: true, found: ... } with what it found'

// What the agent reported the last time, so a run can say what is new since.
function lastReport(
  runner: ScheduleRunner,
  s: Schedule,
  by: string,
): { at: string; words: string } | null {
  const t = runner.world.tasks.lastOfSchedule(s.id)
  const line =
    t &&
    runner.world
      .lines({ user: by, turnPrefix: `task:${t.id}:`, kinds: ['replied'], limit: 400 })
      .at(-1)
  return t && line ? { at: t.doneAt ?? line.at, words: line.words } : null
}

export async function wake(
  runner: ScheduleRunner,
  s: Schedule,
  place: RunPlace,
  who: RunFor | undefined,
  given: object,
  options: { asked?: boolean },
): Promise<RunOutcome> {
  const agent = s.agent as string
  const by = s.by ?? runner.owner ?? who?.user ?? null
  const nowMs = Date.now()
  // read before its run moves the schedule's last run on
  const due = options.asked ? null : cameDue(s.trigger, s.lastRunAt, nowMs)
  let found: unknown = 'filed' in given ? (given as { filed: unknown }).filed : null
  let id: string
  if (s.runs) {
    const out = await runner.runScript(
      place,
      s.runs.script,
      { ...(s.runs.input ?? {}), ...given, lastRun: s.lastRunAt },
      s.name,
      s.id,
      { user: by, turn: who?.turn ?? null },
    )
    if (out.state !== 'ok') return out
    const said = checkAnswer(out.result)
    if (!said) {
      const words = `${s.name} did not finish: ${NOT_AN_ANSWER}.`
      runner.noteRun(out.id, words, {}, 'failed')
      return { ...out, state: 'failed', words }
    }
    if (!said.wake) {
      runner.noteRun(out.id, 'Nothing new.', { quiet: true })
      return { ...out, words: 'Nothing new.' }
    }
    found = said.found ?? found
    id = out.id
  } else id = runner.openRun(s, `${s.name} came due.`)
  const person = by ? runner.world.user(by) : undefined
  if (!by || !person || !runner.give) {
    const words = `${s.name} could not start its agent: it has nobody to work for.`
    runner.noteRun(id, words, {}, 'failed')
    return { id, state: 'failed', words, result: null }
  }
  const file = runner.fileOf(s.id, place)
  const task = runner.world.tasks.add(
    {
      title: s.name,
      owner: { kind: 'alpha', id: agent },
      on: s.module ? { module: s.module } : null,
    },
    { actor: { kind: 'schedule', id: s.name }, user: by, run: id },
  )
  runner.world.tasks.markScheduled(
    task.id,
    s.id,
    scheduledText({
      name: s.name,
      when: whenWords(s.trigger),
      what: file?.brief ?? '',
      found,
      due,
      nowMs,
      last: lastReport(runner, s, by),
      person: person.name,
    }),
  )
  runner.noteRun(id, `Woke ${agentName(runner.world, agent)}.`, { task: task.id })
  runner.give(by, task.id)
  return { id, state: 'ok', words: `${s.name} woke its agent.`, result: { task: task.id } }
}
