// The journeys runner (design §16): a journey is a YAML file of steps and checks on the world,
// run on a fresh tenant of its own with the real model. Checks read the world, not the model's
// prose. The report goes in docs/journeys/.
//   node src/journeys/run.ts <name> [--alone] [--keep]
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { parse } from 'yaml'
import { z } from 'zod'
import { config } from '../config.ts'
import { Engine } from '../engine/engine.ts'
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
  const n = world.lines({ kinds: ['error'] }).length
  return { check: `errors: ${check.errors}`, ok: n === check.errors, saw: String(n) }
}

async function main() {
  const args = process.argv.slice(2)
  const name = args.find((a) => !a.startsWith('--'))
  if (!name) throw new Error('Name a journey: node src/journeys/run.ts track-what-i-eat')
  const prompt = args.includes('--alone') ? 'alone' : 'appended'
  const journey = Journey.parse(parse(readFileSync(join(ROOT, 'journeys', `${name}.yaml`), 'utf8')))
  const stamp = new Date().toISOString().slice(0, 16).replace('T', '-').replace(':', '')
  // Outside $TMPDIR, so the sandbox is as it is for the person.
  const home = join(homedir(), '.alpha-journeys', `${stamp}-${name}-${prompt}`)
  rmSync(home, { recursive: true, force: true })
  const world = await World.open(join(home, 'tenants', 't_journey'))
  const user = world.owner('Kenil')
  const engine = new Engine(world, { prompt })
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
    const done = idle()
    let what: string
    if (step.say) {
      what = `Said “${step.say}”`
      engine.say(user, step.say)
    } else if (step.answer) {
      const card = world.cards.waiting(user.id)[0]
      if (!card) throw new Error(`Step ${i + 1}: no card is waiting to answer.`)
      what = `Answered “${card.words}” with ${step.answer.choice}`
      engine.answer(user, card.id, step.answer.choice)
    } else throw new Error(`Step ${i + 1} neither says nor answers.`)
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
    report.push(
      `${finished ? '' : '**The turn did not finish.** '}Reply (${((Date.now() - t0) / 1000).toFixed(1)} s): ${reply?.words ?? '(none)'}`,
      '',
    )
    if (steps.length) report.push(`Steps: ${steps.map((s) => s.words).join('; ')}.`, '')
    if (tokens) report.push(`Tokens so far in the session: ${tokens}.`, '')
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
  const out = join(ROOT, 'docs', 'journeys', `${stamp}-${name}-${prompt}.md`)
  mkdirSync(join(ROOT, 'docs', 'journeys'), { recursive: true })
  writeFileSync(out, `${report.join('\n').trim()}\n`)
  engine.close()
  world.close()
  if (!args.includes('--keep')) rmSync(home, { recursive: true, force: true })
  console.log(`${passed ? 'passed' : 'FAILED'}: ${out}`)
  process.exitCode = passed ? 0 : 1
}

await main()
