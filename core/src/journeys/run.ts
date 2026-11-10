// The journeys runner: a journey is a YAML file of steps and checks on the world,
// run on a fresh tenant of its own with the real model. Checks read the world, not the model's
// prose. The report goes in docs/journeys/.
// One run of one journey is here (runOne); main.ts runs them: one, N times, or a whole folder.
// A client's journeys live in the client's own repository (--from ../<client>/journeys); their
// paths are then from that repository's root, and their reports go in its docs/journeys/.
import {
  copyFileSync,
  cpSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { extname, join, resolve } from 'node:path'
import { BrowserEngine, MemorySecrets } from '@alpha/connector-sdk'
import { parse } from 'yaml'
import { z } from 'zod'
import { buildServer } from '../api/server.ts'
import type { WaitingRuleView } from '../api/types.ts'
import { config } from '../config.ts'
import { linkShared, loadConnector, loadSet, STANDARD_DIR } from '../connectors/discover.ts'
import { ConnectorService } from '../connectors/service.ts'
import { revertAll } from '../connectors/takeback.ts'
import { Engine } from '../engine/engine.ts'
import { tokenRoute } from '../engine/route.ts'
import { stillReading } from '../files/documents.ts'
import { DRAFT, Drafts } from '../modules/drafts.ts'
import { install } from '../modules/kits/index.ts'
import { REVIEW } from '../modules/reviews.ts'
import { ScheduleRunner } from '../modules/runs/index.ts'
import { agentSchedules, schedules, setScheduleState } from '../modules/schedules.ts'
import { CHIEF } from '../world/agents/index.ts'
import { verify } from '../world/audit.ts'
import { Refused } from '../world/kinds.ts'
import { MAINTAINED_SHAPE } from '../world/maintained.ts'
import { undoable } from '../world/records/index.ts'
import { World } from '../world/world.ts'
import { Check, judge } from './checks.ts'
import { installSigned } from './signed.ts'
import { type Site, serve } from './site.ts'
import { spentIn } from './spent.ts'
import { Edit, inWindow, Remove, Reset } from './window.ts'

const ROOT = join(import.meta.dirname, '..', '..', '..')

const Journey = z.object({
  name: z.string(),
  title: z.string(),
  why: z.string(),
  steps: z.array(
    z.object({
      say: z.string().optional(),
      in: z.string().optional(), // say it in this module's Conversation
      to: z.string().optional(), // say it to this agent, in its own conversation
      named: z.array(z.string()).optional(), // the agents picked with @ in the message

      // the first waiting card answered; a schedule's draft can be sent with Always when offered; on
      // its own page, through the window's routes
      answer: z
        .object({
          choice: z.string(),
          always: z.boolean().optional(),
          on_page: z.boolean().optional(),
        })
        .optional(),
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
      // a made-up site served on this Mac from the repository; later steps say it as {site}. Named
      // again with a state, it serves that state's pages at the same address (site.ts)
      site: z.object({ from: z.string(), state: z.string().optional() }).optional(),
      // a made-up connector added from a folder, its {site}, {other} and {host} said as the site's
      // (by its name, by another, and its host), connected and read once
      connector: z.object({ from: z.string(), account: z.string() }).optional(),
      // the customer's own step done: a file of this name in the journey's own
      // folder ({tmp}, the account a made-up connector is connected to)
      customer_does: z.string().optional(),
      // Run now on an agent's schedule, as the person presses it: its first, or the one named
      run_now: z.object({ agent: z.string(), name: z.string().optional() }).optional(),
      // Try again on a connection waiting for the customer, by its connector
      try_again: z.string().optional(),
      // a table renamed as the person renames it, by double-clicking its name
      rename: z.object({ table: z.string(), to: z.string() }).optional(),
      // Read now, as the person presses it on a connection, by its connector
      read_now: z.string().optional(),
      // the rule waiting on its Save card approved in Permissions, by its name, through the
      // window's routes
      approve_rule: z.string().optional(),
      // a kit installed from a folder, its schedules on when the journey says so (all, or those named)
      kit: z
        .object({
          from: z.string(),
          schedules: z.union([z.enum(['on', 'paused']), z.array(z.string())]).default('paused'),
          signed: z.boolean().optional(), // from a pack signed with a key the journey makes (M1)
        })
        .optional(),
      // the scheduler's tick: schedules whose time or change has come run now
      due: z.boolean().optional(),
      // every waiting card of a schedule's rows decided: each row not yet decided takes this choice
      review: z.object({ choice: z.string(), words: z.string().optional() }).optional(),
      // Revert from Activity, as the person: the newest run or turn that wrote rows, or revert
      revert: z.enum(['last_run', 'last_turn', 'last_revert']).optional(),
      // two people merged by the person, by their names, and one merged in let go
      merge: z.object({ keep: z.string(), other: z.string() }).optional(),
      unmerge: z.string().optional(),
      // a value typed over a row's, a row removed, Reset on a value: in the window (window.ts)
      edit: Edit.optional(),
      remove: Remove.optional(),
      reset: Reset.optional(),
      // a check that waits on what it names, as a rule of docs/rules.md does, passes while it
      // fails, and fails the day it holds, until its waits comes off
      checks: z
        .array(z.intersection(Check, z.object({ waits: z.string().min(1).optional() })))
        .default([]),
    }),
  ),
})

// What a dropped file is, by its name, as the window's drop says it.
const MIME: Record<string, string> = {
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.csv': 'text/csv',
  '.pdf': 'application/pdf',
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
): Promise<{ passed: boolean; report: string; seconds: number; usd: number | null }> {
  // Alpha's prompt alone is the default; --appended tries it on Claude Code's own
  const prompt = args.includes('--appended') ? 'appended' : 'alone'
  const { journeys, base } = placesOf(args)
  const journey = Journey.parse(parse(readFileSync(join(journeys, `${name}.yaml`), 'utf8')))
  // a journey whose every check waits is not run: nothing in it can hold yet
  const checks = journey.steps.flatMap((s) => s.checks)
  if (checks.length && checks.every((c) => c.waits)) {
    const on = [...new Set(checks.map((c) => c.waits))].sort().join(', ')
    return { passed: true, report: `not run: every check waits on ${on}`, seconds: 0, usd: 0 }
  }
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
  const runner = new ScheduleRunner(world, () => browser, {
    owner: user.id,
  })
  const drafts = new Drafts(
    world,
    { send: (connector, message) => connectors.runTool(connector, 'send', { ...message }) },
    user,
    (schedule, module) => {
      const a = schedules(world, module).find((x) => x.name === schedule)
      if (a) void runner.runSchedule(a).catch(() => undefined)
    },
  )
  runner.drafts = drafts
  const engine = new Engine(world, {
    prompt,
    connectors,
    hands: { browser: () => browser, runner, browsers: join(ROOT, '.data', 'browsers'), drafts },
    ...(await tokenRoute(world, home)),
  })
  let site: Site | null = null
  // the journey's own folder, for a made-up connector's account ({tmp})
  const tmp = mkdtempSync(join(tmpdir(), 'alpha-journey-tmp-'))
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
    `Fresh tenant, model ${config.models().desk}, on Claude Code, Alpha's prompt ${prompt === 'alone' ? 'alone' : 'appended to Claude Code’s'}.`,
    '',
  ]
  // the window's own routes, in this process, for a step the person takes on a page
  const served: { app?: ReturnType<typeof buildServer> } = {}
  const page = () => {
    served.app ??= buildServer({ engine, user, token: 'journey', ports: [4700] })
    return served.app
  }
  const asWindow = { host: '127.0.0.1:4700', 'x-alpha-token': 'journey' }
  let passed = true
  const started = Date.now()
  for (const [i, step] of journey.steps.entries()) {
    const t0 = Date.now()
    // a said sentence and an answered question start a desk turn; a schedule's draft answered does
    // not, nor an answer with no card to answer, which is waited on no longer (it waited out the
    // step's ten minutes)
    const first = step.answer ? world.cards.waiting(user.id)[0] : undefined
    // a Save card approved in Permissions is answered as on the card, so its turn goes on too;
    // a maintained kit's card is answered on its own (rules M4), with no turn after it
    const noTurn = [DRAFT, MAINTAINED_SHAPE]
    const turns =
      !!step.say || !!step.approve_rule || (!!first && !noTurn.includes(first.call?.tool ?? ''))
    const done = turns ? idle() : Promise.resolve(true)
    let what: string
    if (step.say) {
      const words = site ? step.say.replaceAll('{site}', site.url) : step.say
      const m = step.in ? world.shape.module(step.in) : undefined
      if (step.in && !m) throw new Error(`Step ${i + 1}: no module ${step.in} to say it in.`)
      what = `Said “${words}”${m ? ` in ${m.name}` : ''}`
      const agent = step.to ? world.agents.byName(step.to) : undefined
      if (step.to && !agent) throw new Error(`Step ${i + 1}: no agent ${step.to} to say it to.`)
      const named = (step.named ?? []).map((n) => world.agents.byName(n)?.id ?? n)
      engine.say(user, words, m ? { id: m.id, name: m.name } : null, agent?.id, named)
    } else if (step.answer) {
      const card = world.cards.waiting(user.id)[0]
      // no card to answer fails the journey, and the journeys after it still run
      if (!card) {
        passed = false
        what = `**No card was waiting to answer with ${step.answer.choice}.**`
      } else {
        what = `Answered “${card.words}” with ${step.answer.choice}${step.answer.always ? ', and always' : ''}`
        if (step.answer.on_page) {
          // the card's page as the window opens it, by its id, and answered through its route
          const shown = await page().inject({ url: `/api/cards/${card.id}`, headers: asWindow })
          what += ', on its own page'
          if (shown.statusCode !== 200) {
            passed = false
            what = `**The card's own page did not open: ${shown.json().problem}**`
          } else
            await page().inject({
              method: 'POST',
              url: `/api/cards/${card.id}`,
              headers: asWindow,
              payload: { answer: step.answer.choice },
            })
        } else if (card.call?.tool === DRAFT)
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
      // no row to drop on fails the journey, and the journeys after it still run
      if (!t || !row) {
        passed = false
        what = `**No row ${d.on.row} in ${d.on.table} to drop files on.**`
      } else {
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
      }
    } else if (step.connect) {
      what = `Connected ${step.connect.connector} for ${step.connect.account}, on recorded answers`
      await engine.connect(user, step.connect.connector, step.connect.account, 'recorded')
      await connectors.sync(
        world.connections.find(step.connect.connector, step.connect.account)?.id ?? '',
      )
    } else if (step.connector) {
      const c = step.connector
      const dir = mkdtempSync(join(tmpdir(), 'alpha-journey-connector-'))
      cpSync(resolve(base, c.from), dir, { recursive: true })
      const url = site?.url ?? 'http://127.0.0.1:9'
      for (const f of readdirSync(dir, { recursive: true, encoding: 'utf8' }))
        if (/\.(js|json)$/.test(f))
          writeFileSync(
            join(dir, f),
            readFileSync(join(dir, f), 'utf8')
              .replaceAll('{site}', url)
              .replaceAll('{other}', url.replace('127.0.0.1', 'localhost'))
              .replaceAll('{host}', new URL(url).host),
          )
      // the SDK and zod, linked to the core's own copies, as an added connector's are
      linkShared(dir)
      const loaded = await loadConnector(
        dir,
        connectors.known().map((k) => k.manifest.name),
      )
      for (const k of loaded) connectors.add(k)
      const name = loaded[0]?.manifest.name ?? ''
      const account = c.account.replaceAll('{tmp}', tmp)
      what = `Added the made-up connector ${name} and connected it for ${account}`
      const made = await engine.connect(user, name, account, null)
      if (made.state === 'connected') await connectors.sync(made.id)
    } else if (step.customer_does) {
      writeFileSync(join(tmp, step.customer_does), 'done\n')
      what = `The customer did their step: ${step.customer_does}`
    } else if (step.try_again) {
      const k = world.connections.list().find((x) => x.connector === step.try_again)
      if (!k) throw new Error(`No connection of ${step.try_again} to try again.`)
      await connectors.sync(k.id)
      what = `Tried ${step.try_again} again`
    } else if (step.rename) {
      const t = world.shape.table(step.rename.table)
      if (!t) throw new Error(`Step ${i + 1}: no table ${step.rename.table} to rename.`)
      what = `Renamed the table ${step.rename.table} to ${step.rename.to}, as the person does`
      // a managed module refuses it (M2): said, and judged by the step's checks
      try {
        world.shape.rename({ table: t.id }, step.rename.to, {
          actor: { kind: 'person', id: user.id },
          user: user.id,
        })
      } catch (err) {
        if (!(err instanceof Refused)) throw err
        what += `: refused: ${err.message}`
      }
    } else if (step.approve_rule) {
      const m = world.shape.module(step.approve_rule)
      if (!m) throw new Error(`Step ${i + 1}: no module ${step.approve_rule}.`)
      const waiting = (
        await page().inject({ url: `/api/rules/waiting?module=${m.id}`, headers: asWindow })
      ).json() as WaitingRuleView[]
      const r = waiting[0]
      if (!r) {
        passed = false
        what = `**No rule was waiting in Permissions for ${m.name}.**`
      } else {
        await page().inject({
          method: 'POST',
          url: `/api/cards/${r.card}`,
          headers: asWindow,
          payload: { answer: r.yes },
        })
        what = `Approved “${r.words}” in Permissions for ${m.name}`
      }
    } else if (step.read_now) {
      const ks = world.connections.list().filter((x) => x.connector === step.read_now)
      if (!ks.length) throw new Error(`No connection of ${step.read_now} to read.`)
      for (const k of ks) await engine.sync(user, k.id)
      what = `Pressed Read now on ${step.read_now}`
    } else if (step.site) {
      const dir = resolve(base, step.site.from)
      const state = step.site.state ?? null
      if (site?.dir === dir) site.state = state
      else site = await serve(dir, state)
      what = `Served the made-up site ${step.site.from}${state ? ` in its ${state} state` : ''} at ${site.url}`
    } else if (step.edit || step.remove || step.reset) {
      const took = await inWindow(page(), world, step)
      passed &&= took.ok
      what = took.what
    } else if (step.run_now) {
      const n = step.run_now
      const agent = world.agents.byName(n.agent)?.id ?? CHIEF
      const s = agentSchedules(world, agent).find((x) => !n.name || x.name === n.name)
      if (!s) throw new Error(`Step ${i + 1}: ${n.agent} has no schedule ${n.name ?? ''}.`)
      const out = await runner.runSchedule(s, { user: user.id, turn: null }, {}, { asked: true })
      what = `Pressed Run now on ${s.name}: ${out.words}`
    } else if (step.due) {
      await runner.runDue(Date.now())
      const ran = runner.runs(5).filter((r) => r.startedAt >= new Date(t0).toISOString())
      what = `The scheduler's tick: ${ran.map((r) => r.words).join('; ') || 'nothing was due'}`
    } else if (step.kit) {
      // a kit the core refuses fails the journey, and the journeys after it still run
      try {
        const person = { actor: { kind: 'person' as const, id: user.id }, user: user.id }
        const from = resolve(base, step.kit.from)
        const m = step.kit.signed
          ? await installSigned(world, from, home, person)
          : await install(world, from, person)
        const on = step.kit.schedules
        for (const a of schedules(world, m.id))
          setScheduleState(
            world,
            a.id,
            Array.isArray(on) ? (on.includes(a.name) ? 'on' : 'paused') : on,
            user.id,
          )
        what = `Installed the kit ${step.kit.from}, ${Array.isArray(on) ? `${on.join(', ')} on` : `its schedules ${on}`}`
      } catch (err) {
        if (!(err instanceof Refused)) throw err
        passed = false
        what = `**Could not install the kit ${step.kit.from}:** ${err.message}`
      }
    } else if (step.revert) {
      // the newest turn that wrote rows or did something outside Alpha that can be taken back
      const rows = world
        .lines({ kinds: ['wrote', 'changed', 'removed', 'landed', 'called'] })
        .filter((l) => l.kind !== 'called' || !!l.data.undo)
      const target =
        step.revert === 'last_run'
          ? { run: runner.runs(20).find((r) => undoable(world.records, { run: r.id }))?.id ?? '' }
          : step.revert === 'last_turn'
            ? { turn: rows.filter((l) => l.turn && !l.run).at(-1)?.turn ?? '' }
            : { line: world.lines({ kinds: ['reverted'] }).at(-1)?.id ?? 0 }
      const person = { actor: { kind: 'person' as const, id: user.id }, user: user.id }
      // a revert refused fails the journey, and the journeys after it still run
      try {
        const undone = await revertAll(
          world,
          connectors,
          target,
          person,
          `the ${step.revert.replace('_', ' ')}`,
        )
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
    // agents asking each other go on after the first turn ends
    for (let w = 0; w < 3000 && engine.working(user); w++)
      await new Promise((ok) => setTimeout(ok, 200))
    // a schedule's run the turn started (on a task, say) ends before the world is judged
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
    // what the world spent so far: Claude Code's own cost
    const tokens = spentIn(world).words
    report.push(`## ${i + 1}. ${what}`, '')
    if (step.say || step.answer) {
      report.push(
        `${finished ? '' : '**The turn did not finish.** '}Reply (${((Date.now() - t0) / 1000).toFixed(1)} s): ${reply?.words ?? '(none)'}`,
        '',
      )
      if (steps.length) report.push(`Steps: ${steps.map((s) => s.words).join('; ')}.`, '')
      report.push(`Spent so far: ${tokens}.`, '')
    } else report.push(`Took ${((Date.now() - t0) / 1000).toFixed(1)} s.`, '')
    for (const check of step.checks) {
      const o = await judge(world, user, check)
      passed &&= check.waits ? !o.ok : o.ok
      const mark = !check.waits
        ? o.ok
          ? 'pass'
          : '**FAIL**'
        : o.ok
          ? '**FAIL** (holds now: take off waits)'
          : `waits on ${check.waits}`
      report.push(`- ${mark}: ${o.check} (saw ${o.saw})`)
    }
    report.push('')
    if (!finished) {
      passed = false
      break
    }
  }
  const spent = spentIn(world)
  report.splice(
    5,
    0,
    `**${passed ? 'Passed' : 'Failed'}** in ${((Date.now() - started) / 1000).toFixed(0)} s, ${spent.usd === null ? 'cost partly unpriced' : `$${spent.usd.toFixed(2)}`}.`,
    '',
  )
  const tables = world.shape.tables()
  // whatever the journey did, the journal and the rows it wrote still agree (rules A4)
  const chain = verify(world.db)
  passed &&= chain.ok
  report.push(
    chain.ok
      ? `The journal verifies, rows included: ${chain.lines} lines.`
      : `**FAIL: the journal does not verify at line ${chain.at}: ${chain.why}.**`,
    '',
  )
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
  await served.app?.close()
  engine.close()
  await browser.close()
  site?.server.close()
  world.close()
  if (!args.includes('--keep')) rmSync(home, { recursive: true, force: true })
  console.log(`${passed ? 'passed' : 'FAILED'}: ${out}`)
  return {
    passed,
    report: out,
    seconds: Math.round((Date.now() - started) / 1000),
    usd: spent.usd,
  }
}
