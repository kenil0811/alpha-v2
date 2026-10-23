// What is due: each agent's triggers, read against the clock and the journal, one run at a time.
import { type Trigger, triggersOf } from '@alpha/kit-sdk'
import { Cron } from 'croner'
import { run as exec, one } from '../../world/db.ts'
import { type Agent, agents } from '../agents.ts'
import type { AgentRunner } from './runner.ts'
import { CHANGE_KINDS, type Filed } from './types.ts'

// What is due by each agent's trigger, and tasks whose cards are all decided. One run of an
// agent at a time.
export async function runDue(runner: AgentRunner, nowMs = Date.now()): Promise<void> {
  runner.resumeTasks()
  for (const a of agents(runner.world)) {
    if (a.state !== 'on' || !triggersOf(a.trigger).length) continue
    if (one(runner.world.db, "SELECT 1 FROM runs WHERE agent_id = ? AND state = 'running'", a.id))
      continue
    const given = runner.due(a, nowMs)
    if (!given) continue
    const module = runner.world.shape.module(a.module)
    const file = module ? runner.fileOf(a.id, module) : null
    if (module && file && runner.overRuns(a, file, nowMs)) {
      // said once a day, not at every tick
      const said = runner.budgetSaid.get(a.id) ?? 0
      if (nowMs - said >= 86_400_000) {
        runner.budgetSaid.set(a.id, nowMs)
        runner.world.line({
          actor: { kind: 'agent', id: a.name },
          kind: 'run_step',
          words: `${a.name} has run ${file.budget.runs} time${file.budget.runs === 1 ? '' : 's'} in a day, its budget; it runs again tomorrow.`,
          module: module.id,
        })
      }
      continue
    }
    await runner.runAgent(a, undefined, given).catch(() => undefined)
    // the run counts at the tick's time, the clock its next one is judged by
    exec(
      runner.world.db,
      'UPDATE agents SET last_run_at = ? WHERE id = ?',
      new Date(nowMs).toISOString(),
      a.id,
    )
  }
}

// Whether an agent is due, and what its trigger hands it when it is (a filing's documents).
export function due(runner: AgentRunner, a: Agent, nowMs: number): false | { filed?: Filed[] } {
  const is = runner.isDue(a, nowMs)
  return is === true ? {} : is
}

// Due by any of its triggers. The ones that read the journal (filed, changes) share the
// agent's cursor: it is read once before and moved once after, so a list of them agrees.
export function isDue(runner: AgentRunner, a: Agent, nowMs: number): boolean | { filed: Filed[] } {
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
  if (reads)
    exec(
      runner.world.db,
      'UPDATE agents SET cursor = ? WHERE id = ?',
      String(runner.world.lastLineId()),
      a.id,
    )
  return due
}

export function isDueBy(
  runner: AgentRunner,
  a: Agent,
  t: Trigger,
  nowMs: number,
  seen: number,
): boolean | { filed: Filed[] } {
  const last = a.lastRunAt ? Date.parse(a.lastRunAt) : 0
  if ('every' in t) {
    if (t.every === 'hour') return nowMs - last >= 3_600_000
    const days = t.every === 'week' ? 7 : 1
    const at = new Date(nowMs)
    const [h, m] = (t.at ?? '00:00').split(':').map(Number)
    at.setHours(h ?? 0, m ?? 0, 0, 0)
    if (at.getTime() > nowMs) at.setDate(at.getDate() - 1)
    return last < at.getTime() && nowMs - last >= (days - 1) * 86_400_000 + 3_600_000
  }
  if ('cron' in t) {
    const next = new Cron(t.cron).nextRun(new Date(last || nowMs - 60_000))
    return !!next && next.getTime() <= nowMs
  }
  if ('filed' in t) {
    // a document read, or put on a row, since the agent last looked (not by the agent itself)
    const files = new Set<string>()
    for (const l of runner.world.lines({ after: seen, kinds: ['filed'] })) {
      const d = l.data as { file?: string; document?: string; record?: string; off?: boolean }
      if (l.actor.kind === 'agent' && l.actor.id === a.name) continue
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
  const lines = runner.world
    .lines({ after: seen, kinds: CHANGE_KINDS })
    .filter(
      (l) =>
        tables.has((l.data as { table?: string }).table) &&
        !(l.actor.kind === 'agent' && l.actor.id === a.name),
    )
  return lines.length > 0
}
