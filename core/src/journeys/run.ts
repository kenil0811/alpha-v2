// The journeys runner (design §16): a journey is a YAML file of steps and checks on the world,
// run on a fresh tenant of its own with the real model. Checks read the world, not the model's
// prose. The report goes in docs/journeys/.
//   node src/journeys/run.ts <name> [--alone] [--keep] [--from <folder of journeys>]
// A client's journeys live in the client's own repository (--from ../alpha-avilo/journeys); their
// paths are then from that repository's root, and their reports go in its docs/journeys/.
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { createServer, type Server } from 'node:http'
import { homedir } from 'node:os'
import { join, normalize, resolve } from 'node:path'
import { BrowserEngine, MemorySecrets } from '@alpha/connector-sdk'
import { parse } from 'yaml'
import { z } from 'zod'
import { config } from '../config.ts'
import { ConnectorService } from '../connectors/service.ts'
import { Engine } from '../engine/engine.ts'
import { stillReading } from '../files/documents.ts'
import { agents, setAgentState } from '../modules/agents.ts'
import { install } from '../modules/kits.ts'
import { AgentRunner } from '../modules/runs.ts'
import type { User } from '../world/world.ts'
import { World } from '../world/world.ts'

const ROOT = join(import.meta.dirname, '..', '..', '..')

const Check = z.union([
  z.object({ tables: z.number() }),
  z.object({ rows: z.number() }),
  z.object({ stated: z.object({ matches: z.string(), from: z.string() }) }),
  z.object({ permission_cards: z.number() }),
  z.object({ cards_waiting: z.number() }),
  z.object({ errors: z.number() }),
  z.object({ documents: z.number() }),
  z.object({ rows_in: z.object({ table: z.string(), count: z.number() }) }),
  z.object({ reply_matches: z.string() }),
  z.object({
    card: z.object({
      gate: z.string(),
      words: z.string().optional(),
      detail: z.string().optional(),
    }),
  }),
  z.object({ connector_calls: z.object({ words: z.string(), count: z.number() }) }),
  z.object({ agents_on: z.number() }),
  z.object({ last_run: z.enum(['ok', 'failed', 'stopped']) }),
  z.object({ looked_up_from: z.object({ table: z.string(), url: z.string() }) }),
  z.object({ question: z.object({ words: z.string().optional(), options: z.string() }) }),
  z.object({
    field: z.object({
      table: z.string(),
      key: z.string(), // the row's own key, as a connection or a reader landed it
      field: z.string(),
      equals: z.string().optional(),
      count: z.number().optional(), // a relation's rows
    }),
  }),
  z.object({ told: z.object({ matches: z.string(), rows: z.number().optional() }) }),
])
type Check = z.infer<typeof Check>

const Journey = z.object({
  name: z.string(),
  title: z.string(),
  why: z.string(),
  steps: z.array(
    z.object({
      say: z.string().optional(),
      answer: z.object({ choice: z.string() }).optional(),
      // a folder of files given to Alpha, copied from the repository so the journey owns it
      folder: z.object({ from: z.string(), only: z.string().optional() }).optional(),
      // an account connected on recorded answers (journeys/fixtures), never a real one
      connect: z.object({ connector: z.string(), account: z.string() }).optional(),
      // a made-up site served on this Mac from the repository; later steps say it as {site}
      site: z.object({ from: z.string() }).optional(),
      // a kit installed from a folder, its agents on when the journey says so (all, or those named)
      kit: z
        .object({
          from: z.string(),
          agents: z.union([z.enum(['on', 'paused']), z.array(z.string())]).default('paused'),
        })
        .optional(),
      // the scheduler's tick: agents whose time or change has come run now
      due: z.boolean().optional(),
      checks: z.array(Check).default([]),
    }),
  ),
})

interface Outcome {
  check: string
  ok: boolean
  saw: string
}

function judge(world: World, user: User, check: Check): Outcome {
  const tables = world.shape.tables()
  if ('tables' in check)
    return {
      check: `tables: ${check.tables}`,
      ok: tables.length === check.tables,
      saw: `${tables.length}: ${tables.map((t) => t.name).join(', ')}`,
    }
  if ('rows' in check) {
    const n = tables.reduce((s, t) => s + world.records.count(t.id), 0)
    return { check: `rows: ${check.rows}`, ok: n === check.rows, saw: String(n) }
  }
  if ('stated' in check) {
    const said = world
      .lines({ user: user.id, kinds: ['said'] })
      .find((l) => l.words === check.stated.from)
    const re = new RegExp(check.stated.matches, 'i')
    const found: string[] = []
    for (const t of tables)
      for (const r of world.records.list(t.id))
        for (const [field, value] of Object.entries(r.values)) {
          const p = r.provenance[field]
          if (
            re.test(String(value)) &&
            p?.kind === 'stated' &&
            said &&
            p.source.message === said.id
          )
            found.push(`${t.name}.${field} = ${JSON.stringify(value)}`)
        }
    return {
      check: `a value matching /${check.stated.matches}/ stated in “${check.stated.from}”`,
      ok: found.length > 0,
      saw: found.join('; ') || 'none',
    }
  }
  if ('permission_cards' in check) {
    const n = Number(
      (
        world.db.prepare("SELECT count(*) AS n FROM cards WHERE kind = 'permission'").get() as {
          n: number
        }
      ).n,
    )
    return {
      check: `permission cards: ${check.permission_cards}`,
      ok: n === check.permission_cards,
      saw: String(n),
    }
  }
  if ('cards_waiting' in check) {
    const n = world.cards.waiting(user.id).length
    return {
      check: `cards waiting: ${check.cards_waiting}`,
      ok: n === check.cards_waiting,
      saw: String(n),
    }
  }
  if ('documents' in check) {
    const docs = world.files.documents()
    return {
      check: `documents: ${check.documents}`,
      ok: docs.length === check.documents,
      saw: `${docs.length}: ${docs.map((d) => `${d.title} (${d.chunks})`).join('; ')}`,
    }
  }
  if ('rows_in' in check) {
    const t = world.shape.table(check.rows_in.table)
    const n = t ? world.records.count(t.id) : -1
    return {
      check: `rows in ${check.rows_in.table}: ${check.rows_in.count}`,
      ok: n === check.rows_in.count,
      saw: t ? String(n) : 'no such table',
    }
  }
  if ('reply_matches' in check) {
    const reply = world.lines({ user: user.id, kinds: ['replied'] }).at(-1)?.words ?? ''
    const re = new RegExp(check.reply_matches, 'i')
    return {
      check: `the reply matches /${check.reply_matches}/`,
      ok: re.test(reply),
      saw: reply.slice(0, 160),
    }
  }
  if ('card' in check) {
    const cards = world.cards.waiting(user.id).filter((c) => c.gate === check.card.gate)
    const hit = cards.find(
      (c) =>
        (!check.card.words || new RegExp(check.card.words, 'i').test(c.words)) &&
        (!check.card.detail || new RegExp(check.card.detail, 'i').test(c.detail ?? '')),
    )
    return {
      check: `a ${check.card.gate} card waiting${check.card.detail ? ` showing /${check.card.detail}/` : ''}`,
      ok: !!hit,
      saw: cards.map((c) => `${c.words} | ${(c.detail ?? '').slice(0, 80)}`).join('; ') || 'none',
    }
  }
  if ('connector_calls' in check) {
    const n = world
      .lines({ kinds: ['connector_call'] })
      .filter((l) => l.words === check.connector_calls.words).length
    return {
      check: `“${check.connector_calls.words}” ${check.connector_calls.count} time(s)`,
      ok: n === check.connector_calls.count,
      saw: String(n),
    }
  }
  if ('agents_on' in check) {
    const n = agents(world).filter((a) => a.state === 'on').length
    return { check: `agents on: ${check.agents_on}`, ok: n === check.agents_on, saw: String(n) }
  }
  if ('last_run' in check) {
    const r = world.db
      .prepare('SELECT state, words FROM runs ORDER BY started_at DESC, rowid DESC LIMIT 1')
      .get() as { state: string; words: string } | undefined
    return {
      check: `the last run ended ${check.last_run}`,
      ok: r?.state === check.last_run,
      saw: r ? `${r.state}: ${r.words}` : 'no run',
    }
  }
  if ('looked_up_from' in check) {
    const t = world.shape.table(check.looked_up_from.table)
    const rows = t ? world.records.list(t.id) : []
    const off = rows.filter(
      (r) =>
        !Object.values(r.provenance).some(
          (p) => p?.kind === 'looked_up' && p.source.url?.includes(check.looked_up_from.url),
        ),
    )
    return {
      check: `every row in ${check.looked_up_from.table} looked up from a page with ${check.looked_up_from.url}`,
      ok: rows.length > 0 && off.length === 0,
      saw: `${rows.length - off.length} of ${rows.length}`,
    }
  }
  if ('question' in check) {
    const q = check.question
    const cards = world.cards
      .waiting(user.id)
      .filter((c) => c.kind === 'question' && c.options.includes(q.options))
      .filter((c) => !q.words || new RegExp(q.words, 'i').test(c.words))
    return {
      check: `a question waiting with the option ${q.options}`,
      ok: cards.length > 0,
      saw: world.cards
        .waiting(user.id)
        .map((c) => `${c.words} [${c.options.join(' / ')}]`)
        .join(' | '),
    }
  }
  if ('field' in check) {
    const f = check.field
    const t = world.shape.table(f.table)
    const row = t
      ? (world.db
          .prepare('SELECT id FROM records WHERE table_id = ? AND item_key = ?')
          .get(t.id, f.key) as { id: string } | undefined)
      : undefined
    const slug = t?.fields.find((x) => x.name === f.field)?.slug ?? ''
    const value =
      t && row ? world.records.list(t.id).find((r) => r.id === row.id)?.values[slug] : undefined
    const ok =
      f.equals !== undefined
        ? value === f.equals
        : f.count !== undefined
          ? Array.isArray(value) && value.length === f.count
          : value !== undefined
    return {
      check: `${f.field} of ${f.key} in ${f.table} ${f.equals !== undefined ? `is ${f.equals}` : `has ${f.count}`}`,
      ok,
      saw: JSON.stringify(value ?? null),
    }
  }
  if ('told' in check) {
    const told = world.lines({ user: user.id, kinds: ['told'] })
    const re = new RegExp(check.told.matches, 'i')
    const n = told.filter((l) => re.test(l.words)).length
    return {
      check: `told /${check.told.matches}/${check.told.rows !== undefined ? ` ${check.told.rows} time(s)` : ''}`,
      ok: check.told.rows !== undefined ? n === check.told.rows : n > 0,
      saw: told.map((l) => l.words).join(' | ') || 'nothing told',
    }
  }
  const n = world.lines({ kinds: ['error'] }).length
  return { check: `errors: ${check.errors}`, ok: n === check.errors, saw: String(n) }
}

// A folder served on loopback, for a journey's made-up site.
function serve(dir: string): Promise<{ server: Server; url: string }> {
  const server = createServer((req, res) => {
    const path = normalize(decodeURIComponent((req.url ?? '/').split('?')[0] ?? '/'))
    const file = join(dir, path)
    if (!file.startsWith(dir) || !existsSync(file) || path.endsWith('/')) {
      res.writeHead(404).end('Not found')
      return
    }
    res.writeHead(200, { 'content-type': file.endsWith('.txt') ? 'text/plain' : 'text/html' })
    res.end(readFileSync(file))
  })
  return new Promise((r) =>
    server.listen(0, '127.0.0.1', () => {
      const a = server.address()
      r({ server, url: `http://127.0.0.1:${typeof a === 'object' && a ? a.port : 0}` })
    }),
  )
}

async function main() {
  const args = process.argv.slice(2)
  const name = args.find((a) => !a.startsWith('--'))
  if (!name) throw new Error('Name a journey: node src/journeys/run.ts track-what-i-eat')
  const prompt = args.includes('--alone') ? 'alone' : 'appended'
  const fromAt = args.indexOf('--from')
  const journeys = fromAt >= 0 ? resolve(ROOT, args[fromAt + 1] ?? '') : join(ROOT, 'journeys')
  const base = fromAt >= 0 ? resolve(journeys, '..') : ROOT
  const journey = Journey.parse(parse(readFileSync(join(journeys, `${name}.yaml`), 'utf8')))
  const stamp = new Date().toISOString().slice(0, 16).replace('T', '-').replace(':', '')
  // Outside $TMPDIR, so the sandbox is as it is for the person.
  const home = join(homedir(), '.alpha-journeys', `${stamp}-${name}-${prompt}`)
  rmSync(home, { recursive: true, force: true })
  const world = await World.open(join(home, 'tenants', 't_journey'))
  const user = world.owner('Kenil')
  const connectors = new ConnectorService(world, {
    secrets: new MemorySecrets(),
    fixtures: join(ROOT, 'journeys', 'fixtures'),
  })
  // The browser Alpha reads with, kept with the repository's test data so it is set up once.
  const limits = config.limits()
  const browser = new BrowserEngine({
    browsers: join(ROOT, '.data', 'browsers'),
    profiles: join(home, 'browser-profiles'),
    pace: { minMs: limits.browser_pace_min_ms, maxMs: limits.browser_pace_max_ms },
    // journeys never read a real site: only the made-up ones served on this Mac
    only: ['127.0.0.1', 'localhost'],
  })
  const runner = new AgentRunner(world, () => browser, { owner: user.id })
  const engine = new Engine(world, {
    prompt,
    connectors,
    hands: { browser: () => browser, runner },
  })
  let site: { server: Server; url: string } | null = null
  const limit = config.limits().journey_step_minutes * 60_000
  const idle = () =>
    new Promise<boolean>((resolve) => {
      const timer = setTimeout(() => {
        engine.events.off('event', on)
        resolve(false)
      }, limit)
      const on = (e: { type: string; user: string }) => {
        if (e.type === 'idle' && e.user === user.id) {
          clearTimeout(timer)
          engine.events.off('event', on)
          resolve(true)
        }
      }
      engine.events.on('event', on)
    })

  const report: string[] = [
    `# Journey ${journey.name}: ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`,
    '',
    journey.title,
    '',
    `Fresh tenant, model ${config.models().desk}, Alpha's prompt ${prompt === 'alone' ? 'alone' : 'appended to Claude Code’s'}.`,
    '',
  ]
  let passed = true
  const started = Date.now()
  for (const [i, step] of journey.steps.entries()) {
    const t0 = Date.now()
    const done = step.say || step.answer ? idle() : Promise.resolve(true)
    let what: string
    if (step.say) {
      const words = site ? step.say.replaceAll('{site}', site.url) : step.say
      what = `Said “${words}”`
      engine.say(user, words)
    } else if (step.answer) {
      const card = world.cards.waiting(user.id)[0]
      if (!card) throw new Error(`Step ${i + 1}: no card is waiting to answer.`)
      what = `Answered “${card.words}” with ${step.answer.choice}`
      engine.answer(user, card.id, step.answer.choice)
    } else if (step.folder) {
      const dir = join(home, 'folder')
      mkdirSync(dir, { recursive: true })
      const from = resolve(base, step.folder.from)
      const names = readdirSync(from).filter(
        (n) => !step.folder?.only || n.includes(step.folder.only),
      )
      for (const n of names) copyFileSync(join(from, n), join(dir, n))
      what = `Gave Alpha a folder of ${names.length} file${names.length === 1 ? '' : 's'} from ${step.folder.from}`
      await engine.connect(user, 'folder', dir, null)
      await connectors.sync(world.connections.find('folder', dir)?.id ?? '')
      await stillReading()
    } else if (step.connect) {
      what = `Connected ${step.connect.connector} for ${step.connect.account}, on recorded answers`
      await engine.connect(user, step.connect.connector, step.connect.account, 'recorded')
      await connectors.sync(
        world.connections.find(step.connect.connector, step.connect.account)?.id ?? '',
      )
    } else if (step.site) {
      site = await serve(resolve(base, step.site.from))
      what = `Served the made-up site ${step.site.from} at ${site.url}`
    } else if (step.due) {
      await runner.runDue(Date.now())
      const ran = runner.runs(5).filter((r) => r.startedAt >= new Date(t0).toISOString())
      what = `The scheduler's tick: ${ran.map((r) => r.words).join('; ') || 'nothing was due'}`
    } else if (step.kit) {
      const m = await install(world, resolve(base, step.kit.from), {
        actor: { kind: 'person', id: user.id },
        user: user.id,
      })
      const on = step.kit.agents
      for (const a of agents(world, m.id))
        setAgentState(
          world,
          a.id,
          Array.isArray(on) ? (on.includes(a.name) ? 'on' : 'paused') : on,
          user.id,
        )
      what = `Installed the kit ${step.kit.from}, ${Array.isArray(on) ? `${on.join(', ')} on` : `its agents ${on}`}`
    } else throw new Error(`Step ${i + 1} neither says, answers, nor connects.`)
    const finished = await done
    const reply = world.lines({ user: user.id, kinds: ['replied', 'error'] }).at(-1)
    const steps = world
      .lines({ user: user.id, kinds: ['call'] })
      .filter((l) => l.turn === reply?.turn)
    const usage = (reply?.data.usage ?? {}) as Record<
      string,
      {
        inputTokens: number
        outputTokens: number
        cacheReadInputTokens: number
        cacheCreationInputTokens: number
      }
    >
    const tokens = Object.entries(usage)
      .map(
        ([m, u]) =>
          `${m}: in ${u.inputTokens + u.cacheReadInputTokens + u.cacheCreationInputTokens} (cache read ${u.cacheReadInputTokens}), out ${u.outputTokens}`,
      )
      .join('; ')
    report.push(`## ${i + 1}. ${what}`, '')
    if (step.say || step.answer) {
      report.push(
        `${finished ? '' : '**The turn did not finish.** '}Reply (${((Date.now() - t0) / 1000).toFixed(1)} s): ${reply?.words ?? '(none)'}`,
        '',
      )
      if (steps.length) report.push(`Steps: ${steps.map((s) => s.words).join('; ')}.`, '')
      if (tokens) report.push(`Tokens so far in the session: ${tokens}.`, '')
    } else report.push(`Took ${((Date.now() - t0) / 1000).toFixed(1)} s.`, '')
    for (const check of step.checks) {
      const o = judge(world, user, check)
      passed &&= o.ok
      report.push(`- ${o.ok ? 'pass' : '**FAIL**'}: ${o.check} (saw ${o.saw})`)
    }
    report.push('')
    if (!finished) {
      passed = false
      break
    }
  }
  report.splice(
    5,
    0,
    `**${passed ? 'Passed' : 'Failed'}** in ${((Date.now() - started) / 1000).toFixed(0)} s.`,
    '',
  )
  const tables = world.shape.tables()
  report.push('## The world after', '')
  for (const t of tables) {
    report.push(`${t.name}: ${t.fields.map((f) => `${f.name} (${f.kind})`).join(', ')}`, '')
    for (const r of world.records.list(t.id))
      report.push(
        `- ${Object.entries(r.values)
          .map(([k, v]) => `${k} ${JSON.stringify(v)} [${r.provenance[k]?.kind}]`)
          .join(', ')}`,
      )
    report.push('')
  }
  const out = join(base, 'docs', 'journeys', `${stamp}-${name}-${prompt}.md`)
  mkdirSync(join(base, 'docs', 'journeys'), { recursive: true })
  writeFileSync(out, `${report.join('\n').trim()}\n`)
  engine.close()
  await browser.close()
  site?.server.close()
  world.close()
  if (!args.includes('--keep')) rmSync(home, { recursive: true, force: true })
  console.log(`${passed ? 'passed' : 'FAILED'}: ${out}`)
  process.exitCode = passed ? 0 : 1
}

await main()
