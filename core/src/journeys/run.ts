// The journeys runner (design §16): a journey is a YAML file of steps and checks on the world,
// run on a fresh tenant of its own with the real model. Checks read the world, not the model's
// prose. The report goes in docs/journeys/.
// One run of one journey is here (runOne); main.ts runs them: one, N times, or a whole folder.
// A client's journeys live in the client's own repository (--from ../<client>/journeys); their
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
import { extname, join, normalize, resolve } from 'node:path'
import { BrowserEngine, MemorySecrets } from '@alpha/connector-sdk'
import { parse } from 'yaml'
import { z } from 'zod'
import { config } from '../config.ts'
import { loadSet, STANDARD_DIR } from '../connectors/discover.ts'
import { ConnectorService } from '../connectors/service.ts'
import { Engine } from '../engine/engine.ts'
import { stillReading } from '../files/documents.ts'
import { agents, setAgentState } from '../modules/agents.ts'
import { DRAFT, Drafts } from '../modules/drafts.ts'
import { install } from '../modules/kits/index.ts'
import { REVIEW } from '../modules/reviews.ts'
import { AgentRunner } from '../modules/runs/index.ts'
import { Refused } from '../world/kinds.ts'
import { revert, undoable } from '../world/records/index.ts'
import { World } from '../world/world.ts'
import { Check, judge } from './checks.ts'

const ROOT = join(import.meta.dirname, '..', '..', '..')

const Journey = z.object({
  name: z.string(),
  title: z.string(),
  why: z.string(),
  steps: z.array(
    z.object({
      say: z.string().optional(),
      in: z.string().optional(), // say it in this module's Conversation

      // the first waiting card answered; an agent's draft can be sent with Always when offered
      answer: z.object({ choice: z.string(), always: z.boolean().optional() }).optional(),
      // a folder of files given to Alpha, copied from the repository so the journey owns it
      folder: z.object({ from: z.string(), only: z.string().optional() }).optional(),
      // files dropped on a row in the window, as the person drops them (a client's exports)
      drop: z
        .object({
          from: z.string(),
          only: z.string().optional(),
          on: z.object({ table: z.string(), row: z.string() }),
        })
        .optional(),
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
      // every waiting card of an agent's rows decided: each row not yet decided takes this choice
      review: z.object({ choice: z.string(), words: z.string().optional() }).optional(),
      // Revert from Activity, as the person: the newest run or turn that wrote rows, or revert
      revert: z.enum(['last_run', 'last_turn', 'last_revert']).optional(),
      // two people merged by the person, by their names (core step 3d), and one merged in let go
      merge: z.object({ keep: z.string(), other: z.string() }).optional(),
      unmerge: z.string().optional(),
      checks: z.array(Check).default([]),
    }),
  ),
})

// What a dropped file is, by its name, as the window's drop says it.
const MIME: Record<string, string> = {
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.csv': 'text/csv',
  '.pdf': 'application/pdf',
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

// Where the journeys are and where their reports go: this repository's, or a client's (--from).
export function placesOf(args: string[]): { journeys: string; base: string } {
  const fromAt = args.indexOf('--from')
  const journeys = fromAt >= 0 ? resolve(ROOT, args[fromAt + 1] ?? '') : join(ROOT, 'journeys')
  return { journeys, base: fromAt >= 0 ? resolve(journeys, '..') : ROOT }
}

export const stampOf = () =>
  new Date().toISOString().slice(0, 16).replace('T', '-').replace(':', '')

// One run of one journey on a fresh world: whether it passed, and its report.
export async function runOne(
  name: string,
  args: string[],
  run: { at: number; of: number } = { at: 1, of: 1 },
): Promise<{ passed: boolean; report: string; seconds: number }> {
  // Alpha's prompt alone is the default since 24 Oct; --appended tries it on Claude Code's own
  const prompt = args.includes('--appended') ? 'appended' : 'alone'
  const { journeys, base } = placesOf(args)
  const journey = Journey.parse(parse(readFileSync(join(journeys, `${name}.yaml`), 'utf8')))
  const stamp = `${stampOf()}${run.of > 1 ? `-run${run.at}` : ''}`
  // Outside $TMPDIR, so the sandbox is as it is for the person.
  const home = join(homedir(), '.alpha-journeys', `${stamp}-${name}-${prompt}`)
  rmSync(home, { recursive: true, force: true })
  const world = await World.open(join(home, 'tenants', 't_journey'))
  const user = world.owner('Kenil')
  const connectors = new ConnectorService(world, {
    secrets: new MemorySecrets(),
    fixtures: join(ROOT, 'journeys', 'fixtures'),
    known: (await loadSet(STANDARD_DIR)).connectors,
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
  const drafts = new Drafts(
    world,
    { send: (connector, message) => connectors.runTool(connector, 'send', { ...message }) },
    user,
    (agent, module) => {
      const a = agents(world, module).find((x) => x.name === agent)
      if (a) void runner.runAgent(a).catch(() => undefined)
    },
  )
  runner.drafts = drafts
  const engine = new Engine(world, {
    prompt,
    connectors,
    hands: { browser: () => browser, runner, browsers: join(ROOT, '.data', 'browsers'), drafts },
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
    // a said sentence and an answered question start a desk turn; an agent's draft answered does not
    const first = step.answer ? world.cards.waiting(user.id)[0] : undefined
    const turns = !!step.say || (!!step.answer && first?.call?.tool !== DRAFT)
    const done = turns ? idle() : Promise.resolve(true)
    let what: string
    if (step.say) {
      const words = site ? step.say.replaceAll('{site}', site.url) : step.say
      const m = step.in ? world.shape.module(step.in) : undefined
      if (step.in && !m) throw new Error(`Step ${i + 1}: no module ${step.in} to say it in.`)
      what = `Said “${words}”${m ? ` in ${m.name}` : ''}`
      engine.say(user, words, m ? { id: m.id, name: m.name } : null)
    } else if (step.answer) {
      const card = world.cards.waiting(user.id)[0]
      // no card to answer fails the journey, and the journeys after it still run
      if (!card) {
        passed = false
        what = `**No card was waiting to answer with ${step.answer.choice}.**`
      } else {
        what = `Answered “${card.words}” with ${step.answer.choice}${step.answer.always ? ', and always' : ''}`
        if (card.call?.tool === DRAFT)
          await (step.answer.always
            ? drafts.send(card.id, null, user, true)
            : engine.answerDraft(user, card.id, step.answer.choice))
        else engine.answer(user, card.id, step.answer.choice)
      }
    } else if (step.review) {
      const review = step.review
      const cards = world.cards
        .waiting(user.id)
        .filter((c) => c.call?.tool === REVIEW && (!review.words || c.words.includes(review.words)))
      if (!cards.length) throw new Error(`Step ${i + 1}: no card of rows is waiting.`)
      for (const c of cards)
        runner.reviews.choose(c.id, 'rest', review.choice, {
          actor: { kind: 'person', id: user.id },
          user: user.id,
        })
      what = `Decided ${cards.length} card${cards.length === 1 ? '' : 's'} of rows: ${review.choice} for every row`
    } else if (step.folder) {
      const dir = join(home, 'folder')
      mkdirSync(dir, { recursive: true })
      const from = resolve(base, step.folder.from)
      const names = readdirSync(from).filter(
        (n) => !step.folder?.only || n.includes(step.folder.only),
      )
      for (const n of names) copyFileSync(join(from, n), join(dir, n))
      what = `Gave Alpha a folder of ${names.length} file${names.length === 1 ? '' : 's'} from ${step.folder.from}`
      // the connector that takes a place on this Mac, whatever it is called
      const place = connectors.known().find((c) => c.manifest.auth === 'path')?.manifest.name
      if (!place) throw new Error('No loaded connector takes a folder.')
      await engine.connect(user, place, dir, null)
      await connectors.sync(world.connections.find(place, dir)?.id ?? '')
      await stillReading()
    } else if (step.drop) {
      const d = step.drop
      const t = world.shape.table(d.on.table)
      const row = t
        ? world.records.list(t.id).find((r) => world.rowName(t, r.values) === d.on.row)
        : undefined
      if (!t || !row) throw new Error(`No row ${d.on.row} in ${d.on.table} to drop files on.`)
      const from = resolve(base, d.from)
      const names = readdirSync(from).filter((n) => !d.only || n.includes(d.only))
      for (const n of names) {
        const out = engine.drop(
          user,
          readFileSync(join(from, n)),
          n,
          MIME[extname(n)] ?? 'application/octet-stream',
        )
        world.placeFile(out.file.hash, row.id, null, {
          actor: { kind: 'person', id: user.id },
          user: user.id,
        })
      }
      await stillReading()
      what = `Dropped ${names.length} file${names.length === 1 ? '' : 's'} from ${d.from} on ${d.on.row} in ${d.on.table}`
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
      // a kit the core refuses fails the journey, and the journeys after it still run
      try {
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
      } catch (err) {
        if (!(err instanceof Refused)) throw err
        passed = false
        what = `**Could not install the kit ${step.kit.from}:** ${err.message}`
      }
    } else if (step.revert) {
      const rows = world.lines({ kinds: ['wrote', 'changed', 'removed', 'landed'] })
      const target =
        step.revert === 'last_run'
          ? { run: runner.runs(20).find((r) => undoable(world.records, { run: r.id }))?.id ?? '' }
          : step.revert === 'last_turn'
            ? { turn: rows.filter((l) => l.turn && !l.run).at(-1)?.turn ?? '' }
            : { line: world.lines({ kinds: ['reverted'] }).at(-1)?.id ?? 0 }
      const person = { actor: { kind: 'person' as const, id: user.id }, user: user.id }
      // a revert refused fails the journey, and the journeys after it still run
      try {
        const undone = revert(world.records, target, person, `the ${step.revert.replace('_', ' ')}`)
        what = `Reverted the ${step.revert.replace('_', ' ')}: ${[undone.words, ...undone.left].join(' ')}`
      } catch (err) {
        if (!(err instanceof Refused)) throw err
        passed = false
        what = `**Could not revert the ${step.revert.replace('_', ' ')}:** ${err.message}`
      }
    } else if (step.merge || step.unmerge) {
      const person = { actor: { kind: 'person' as const, id: user.id }, user: user.id }
      const named = (name: string) => {
        const p = world.db
          .prepare("SELECT id FROM people WHERE kind = 'person' AND lower(name) = lower(?)")
          .get(name) as { id: string } | undefined
        if (!p) throw new Error(`No one called ${name} to merge.`)
        return p.id
      }
      if (step.merge) {
        world.people.merge(named(step.merge.keep), named(step.merge.other), person)
        what = `Merged ${step.merge.other} into ${step.merge.keep}`
      } else {
        world.people.unmerge(named(step.unmerge as string), person)
        what = `Unmerged ${step.unmerge}`
      }
    } else throw new Error(`Step ${i + 1} neither says, answers, nor connects.`)
    const finished = await done
    // an agent's run the turn started (on a task, say) ends before the world is judged
    for (
      let w = 0;
      w < 300 && world.db.prepare("SELECT 1 FROM runs WHERE state = 'running'").get();
      w++
    )
      await new Promise((ok) => setTimeout(ok, 200))
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
      const o = await judge(world, user, check)
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
  return { passed, report: out, seconds: Math.round((Date.now() - started) / 1000) }
}
