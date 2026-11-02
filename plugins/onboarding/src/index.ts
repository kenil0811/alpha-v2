// Let Alpha get to know you (onboarding design; Kenil's yes 2 Nov to a plugin of its own, and to B):
// one session that starts from the overview of what the person allowed Alpha to read on their
// computer, looks closer with read-only tools until it is satisfied, and answers once: about them,
// their routines, suggestions and questions. Every line lands in About you only on their word.
// Everything here goes through the plugin host: the core knows nothing of onboarding, and removing
// this folder removes it whole.
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { type Explored, type Plugin, type PluginHost, Refusal, type Row } from '@alpha/plugin-sdk'
import { type Checked, check, fromWords, SCHEMA, sameAs } from './answer.ts'
import { readSources } from './sources.ts'
import { buildSummary } from './summary.ts'
import { toolsOf } from './tools.ts'

const OWN = 'About you'
const TABLE = 'About you'
const words = readFileSync(new URL('../onboarding.md', import.meta.url), 'utf8')

// How many: "1 line", "3 lines".
const n = (k: number, one: string, many = `${one}s`) => `${k} ${k === 1 ? one : many}`

// The person's own day, as their computer says it: 2026-11-02.
const today = () => {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export interface Run {
  id: string
  at: string
  state: 'looking' | 'done' | 'failed'
  problem?: string
  overview: string // what it started from
  ids: string[]
  counts: Record<string, number>
  calls: Explored['calls'] // every look it took, with what it got: all of it went to Claude
  checked: Checked | null
  answered: Record<string, string> // a question's place, the person's answer
}

// A run of onboarding, kept in the plugin's own folder so Show the work shows everything that was
// sent and Forget deletes it.
export class Runs {
  readonly dir: string
  constructor(dir: string) {
    this.dir = join(dir, 'runs')
  }
  save(run: Run): void {
    mkdirSync(this.dir, { recursive: true })
    writeFileSync(join(this.dir, `${run.id}.json`), JSON.stringify(run, null, 1))
  }
  get(id: string): Run | null {
    const file = join(this.dir, `${id.replace(/[^\w-]/g, '')}.json`)
    return existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as Run) : null
  }
  latest(): Run | null {
    if (!existsSync(this.dir)) return null
    const last = readdirSync(this.dir)
      .filter((f) => f.endsWith('.json'))
      .sort()
      .at(-1)
    return last ? this.get(last.replace(/\.json$/, '')) : null
  }
  forget(id: string): boolean {
    const run = this.get(id)
    if (run) rmSync(join(this.dir, `${run.id}.json`))
    return !!run
  }
}

export function register(host: PluginHost): void {
  const runs = new Runs(host.dir)
  const rows = () => host.own.rows(TABLE)
  const kept = () => rows().filter((r: Row) => r.values.State === 'Kept')
  const can = () => {
    const c = host.catalogue()
    return {
      modules: c.modules.filter((m) => m.name !== OWN && m.name !== 'Alpha').map((m) => m.name),
      connectors: c.connectors.map((k) => k.name),
    }
  }
  let looking: Promise<void> | null = null

  // The session, to its end: the answer checked, its lines proposed in About you.
  async function look(run: Run) {
    try {
      const x = await host.explore(
        words,
        `Today is ${today()}.\n\n# Overview\n\n${run.overview}`,
        toolsOf(await readSources(host), host),
        SCHEMA,
      )
      const read = [run.overview, ...x.calls.map((c) => JSON.stringify(c.output))].join('\n')
      const checked = check(
        x.answer,
        { ids: [...run.ids, ...x.calls.map((c) => c.id)], text: read },
        can(),
        rows().map((r) => String(r.values.Line ?? '')),
      )
      const tools = Object.fromEntries(x.calls.map((c) => [c.id, c.tool]))
      const on = today()
      host.own.add(
        TABLE,
        checked.about.map((l) => ({
          values: {
            Line: l.line,
            From: fromWords(l.from, tools),
            Sure: l.sure === 'likely' ? 'Likely' : 'Guess',
            State: 'Proposed',
            'Noticed on': on,
          },
          basis: `Alpha's look of ${on}, from ${l.from.join(', ')}`,
        })),
      )
      runs.save({ ...run, state: 'done', calls: x.calls, checked })
      host.journal(
        `Looked closer ${n(x.calls.length, 'time')}, then wrote ${n(checked.about.length, 'line')} about the person, ${n(checked.routines.length, 'routine')}, ${n(checked.suggestions.length, 'suggestion')} and ${n(checked.questions.length, 'question')}; left out ${checked.dropped.length} nothing read backed.`,
        { run: run.id, looks: x.calls.length, lines: checked.about.length },
      )
    } catch (err) {
      const problem = err instanceof Error ? err.message : String(err)
      runs.save({ ...run, state: 'failed', problem })
      host.journal(`Could not finish getting to know the person: ${problem}`, { run: run.id })
    }
  }

  // Start the session; it runs on, and the run says when it is done.
  host.route('POST', '/look', async () => {
    if (looking) throw new Refusal('Alpha is getting to know you already: it says when it is done.')
    const s = await buildSummary(host, OWN)
    const run: Run = {
      id: `r-${Date.now()}`,
      at: new Date().toISOString(),
      state: 'looking',
      overview: s.text,
      ids: s.ids,
      counts: s.counts,
      calls: [],
      checked: null,
      answered: {},
    }
    runs.save(run)
    host.journal(
      `Started getting to know the person from ${n(s.counts.meetings, 'meeting')}, ${n(s.counts.contacts, 'contact')}, ${n(s.counts.mail, 'message')}, ${n(s.counts.sites, 'site')}, ${n(s.counts.apps, 'app')} and ${n(s.counts.files, 'file name')}.`,
      { run: run.id, ...s.counts },
    )
    looking = look(run).finally(() => {
      looking = null
    })
    return run
  })

  host.route('GET', '/run', async () => runs.latest())
  host.route('POST', '/forget', async ({ body }) => {
    const id = String((body as { run?: unknown })?.run ?? '')
    if (runs.get(id)?.state === 'looking') throw new Refusal('Wait until Alpha is done looking.')
    if (!runs.forget(id)) throw new Refusal('That run is not here.')
    host.journal('Forgot an onboarding run: everything sent and what came back.', { run: id })
    return { ok: true }
  })

  // A question Alpha could not settle, answered: the answer is the person's own, kept.
  host.route('POST', '/answer', async ({ body }) => {
    const b = (body ?? {}) as { run?: unknown; question?: unknown; answer?: unknown }
    const run = runs.get(String(b.run ?? ''))
    const at = Number(b.question)
    const q = run?.checked?.questions[at]
    if (!run || !q) throw new Refusal('That question is not here any more.')
    const answer = String(b.answer ?? '').trim()
    if (!answer) throw new Refusal('Say the answer in your own words.')
    const line = `${q.question} ${answer}`
    if (rows().some((r) => sameAs(String(r.values.Line ?? '')) === sameAs(line)))
      return { ok: true }
    const [id] = host.own.add(TABLE, [
      {
        values: { Line: line, From: 'Your answer', 'Noticed on': today() },
        basis: `Their answer to Alpha's question of ${run.at.slice(0, 10)}`,
      },
    ])
    if (id) host.own.set(TABLE, id, { Line: line, State: 'Kept' })
    runs.save({ ...run, answered: { ...run.answered, [String(at)]: answer } })
    return { ok: true }
  })

  // About you: each line kept, changed and kept, or dropped, on the person's word.
  host.route('GET', '/about', async () => rows())
  host.route('POST', '/about/:id/keep', async ({ params }) => {
    host.own.set(TABLE, params.id ?? '', { State: 'Kept' })
    return { ok: true }
  })
  host.route('POST', '/about/:id/edit', async ({ params, body }) => {
    const line = String((body as { line?: unknown })?.line ?? '').trim()
    if (!line) throw new Refusal('Say the line in your own words.')
    host.own.set(TABLE, params.id ?? '', { Line: line, State: 'Kept' })
    return { ok: true }
  })
  host.route('POST', '/about/:id/drop', async ({ params }) => {
    host.own.set(TABLE, params.id ?? '', { State: 'Dropped' })
    return { ok: true }
  })

  // What the person kept, at the start of every conversation: all of it, theirs to keep or drop.
  host.startBlock(() => {
    const lines = kept().map((r) => `- ${String(r.values.Line ?? '')}`)
    return lines.length ? `## About the person (they kept these)\n${lines.join('\n')}` : null
  })
}

export const plugin: Plugin = {
  name: 'onboarding',
  title: 'Let Alpha get to know you',
  kit: 'kit',
  register,
}
