// The desk's other hands: ask (a card), remember (instructions), rule (a rule on its Save card),
// connect, look (a page, a module, a row), keep (a file in a module) and run (a schedule or a
// script, for a try).

import { appendFileSync, existsSync, readFileSync } from 'node:fs'
import { z } from 'zod'
import { config } from '../../config.ts'
import { FILING, type Filing } from '../../files/intake.ts'
import { keepAgent, keepAgentFile } from '../../modules/agents.ts'
import { DRAFT } from '../../modules/drafts.ts'
import { keep } from '../../modules/keep.ts'
import type { ScheduleRunner } from '../../modules/runs/index.ts'
import { schedules } from '../../modules/schedules.ts'
import { pagesOf, printPage } from '../../pages/pages.ts'
import { Refused } from '../../world/kinds.ts'
import { DOES, type RuleSpec, SAVE_ANSWERS, SAVE_RULE } from '../../world/rules.ts'
import type { ToolEntry } from '../registry.ts'
import type { Tooling } from './common.ts'
import {
  guard,
  guardAsync,
  instructionsFile,
  ok,
  PAGE,
  SCRIPT,
  TASKS,
  tableOf,
  tool,
  VIEWS,
} from './common.ts'

export function deskTools(t: Tooling): ToolEntry[] {
  const { world, here, hands, connectors, ctx } = t
  return [
    tool(
      'ask',
      'Put a question to the person as a card in their window: question is one short line, and what it rests on (a preview, the rows it would add, their figures) goes in detail, in Markdown with lists, shown under it; options when there are a few clear ones. Or, when the person has just answered a waiting card in their own words, answer that card for them: answer_card, choice (one of its options) and words (theirs, quoted from their message).',
      {
        question: z.string().optional(),
        detail: z.string().optional(),
        options: z.array(z.string()).optional(),
        answer_card: z.string().optional(),
        choice: z.string().optional(),
        words: z.string().optional(),
      },
      async (a) =>
        guardAsync(async () => {
          const here_ = here.current
          if (a.answer_card) {
            // A wall: only the desk, in its turn on the person's message, with their words in it.
            if (here.fromSubagent || !here_.said || !here_.message)
              throw new Refused(
                'A card is answered only on the person’s own message, in the turn on it.',
              )
            const words = (a.words ?? '').trim()
            const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ')
            if (words.length < 2 || !norm(here_.message).includes(norm(words)))
              throw new Refused('Those words are not in the person’s message.')
            const card = world.cards.get(a.answer_card)
            if (card?.state !== 'waiting') throw new Refused('That card is not waiting.')
            const choice = a.choice ?? ''
            if (card.options.length && !card.options.includes(choice))
              throw new Refused(`The choices on that card are ${card.options.join(', ')}.`)
            // a schedule's draft is sent or held, a file from the mail filed or declined, as drafted
            const no = choice === card.options[1]
            if (card.call?.tool === DRAFT && hands?.drafts) {
              const done = no
                ? hands.drafts.hold(card.id, 'Something else', words, here_.user)
                : await hands.drafts.send(card.id, null, here_.user)
              return ok(`The card is answered: ${done.state}.`)
            }
            if (card.call?.tool === FILING && hands?.intake) {
              const f = card.call.input as Filing
              const done = no
                ? hands.intake.decline(card.id, words, here_.user)
                : hands.intake.file(card.id, { row: f.row, kind: f.kind }, here_.user)
              return ok(`The card is answered: ${done.state}.`)
            }
            if (card.call?.tool === SAVE_RULE && choice === SAVE_ANSWERS.yes)
              world.rules.save(card.call.input as RuleSpec, {
                actor: { kind: 'person', id: here_.user.id },
                user: here_.user.id,
                card: card.id,
              })
            const done = world.cards.answer(card.id, choice, { kind: 'person', id: here_.user.id })
            return ok(`The card is answered: ${done.state}.`)
          }
          if (!a.question?.trim()) throw new Refused('A question is needed.')
          // a wall: the question is read at a glance; the rest is the card's detail (30 Oct)
          const most = config.limits().question_characters
          if (a.question.trim().length > most)
            throw new Refused(
              `The question is too long for a card (${a.question.trim().length} characters; ${most} at most): ask in one short line, and put what it rests on (the preview, the rows, their figures) in detail, as Markdown with a list.`,
            )
          const card = world.cards.open({
            kind: 'question',
            words: a.question.trim(),
            detail: a.detail?.trim() || null,
            options: a.options ?? [],
            actor: t.ctx().actor,
            user: here_.user.id,
            turn: here_.turn,
          })
          return ok(`Asked on a card (${card.id}); the answer comes as a message.`)
        }),
      { alwaysLoad: true },
    ),
    tool(
      'remember',
      'Keep a standing instruction: how the person wants things done from now on (a tone, a format, a habit). for: me (this person) or everyone (the whole firm). Not what Alpha may or may not do (send, email, remove, delete, read, open a site, sign in): that is a rule, which code holds, made with the rule tool; never keep it here as well.',
      { instruction: z.string(), for: z.enum(['me', 'everyone']) },
      async (a) =>
        guard(() => {
          const file = instructionsFile(world, a.for === 'me' ? here.current.user.id : null)
          appendFileSync(
            file,
            `${existsSync(file) && readFileSync(file, 'utf8').length ? '' : '# Standing instructions\n\n'}- ${a.instruction.trim()}\n`,
          )
          world.line({
            actor: t.ctx().actor,
            kind: 'remembered',
            words: `Will remember: ${a.instruction.trim()}`,
            data: { for: a.for },
            user: here.current.user.id,
            turn: here.current.turn,
          })
          return ok('Kept.')
        }),
      { alwaysLoad: true },
    ),
    tool(
      'rule',
      [
        'What Alpha may or may not do from now on, when the person says so (“never email anyone outside the firm”, “never delete deals”, “Watson may send follow-ups”), as code will hold it; or one you noticed they keep to without saying it. Use this, never remember, for anything about sending, removing, reading, opening a site or signing in.',
        'side: deny or allow. does: what Alpha does that it covers (read, change, remove, send, reach a site, sign_in). Then only what narrows it: through (tools or connectors: gmail, gmail.send, change); for a send, to_inside (domains: the addresses at them, as in “anyone at example.com”), to_outside (domains: every address not at them, as in “anyone outside the firm”) or to (whole addresses); sites (hosts) for reach; tables (by name). module: it holds in that module only; schedule: that schedule only; neither: all of Alpha. words: the person’s own words asking for it.',
        'It opens a card showing the rule in code’s own words, for the person to Save: only their Save makes it a rule. With noticed (the journal line ids it comes from) it is kept as noticed instead, never approved, for them to approve or dismiss in Governance.',
        'Words that say none of these (be polite to brokers) are not a rule: say so, and offer to keep them in the module’s notes.',
      ].join('\n'),
      {
        side: z.enum(['allow', 'deny']),
        does: z.array(z.enum(DOES)).min(1),
        through: z.array(z.string()).optional(),
        to_outside: z.array(z.string()).optional(),
        to_inside: z.array(z.string()).optional(),
        to: z.array(z.string()).optional(),
        sites: z.array(z.string()).optional(),
        tables: z.array(z.string()).optional(),
        module: z.string().optional(),
        schedule: z.string().optional(),
        words: z.string().optional(),
        noticed: z.array(z.number().int()).optional(),
      },
      async (a) =>
        guard(() => {
          const module = a.module ? world.shape.module(a.module) : undefined
          if (a.module && !module) throw new Refused(`There is no module called ${a.module}.`)
          const spec = world.rules.check({
            side: a.side,
            module: module?.id ?? null,
            schedule: a.schedule?.trim() || null,
            covers: {
              does: a.does,
              ...(a.through ? { through: a.through } : {}),
              ...(a.to_outside || a.to_inside || a.to
                ? {
                    to: {
                      ...(a.to_outside ? { outside: a.to_outside } : {}),
                      ...(a.to_inside ? { inside: a.to_inside } : {}),
                      ...(a.to ? { addresses: a.to } : {}),
                    },
                  }
                : {}),
              ...(a.sites ? { sites: a.sites } : {}),
              ...(a.tables ? { tables: a.tables.map((t) => tableOf(world, t).id) } : {}),
            },
            said: a.words?.trim() || null,
          } satisfies RuleSpec)
          if (a.noticed?.length) {
            const r = world.rules.infer(spec, a.noticed, ctx())
            return ok(
              `Kept as noticed: ${r.words} It shows in Governance for the person to approve or dismiss; it never acts alone on a send, a removal of theirs or a sign-in.`,
            )
          }
          const words = world.rules.describe(spec)
          // one rule waits on its Save at a time in a turn: a newer one replaces the one before
          for (const c of world.cards.waiting())
            if (c.call?.tool === SAVE_RULE && c.turn && c.turn === here.current.turn)
              world.cards.withdraw(c.id, t.ctx().actor, 'A newer wording replaces it.')
          const card = world.cards.open({
            kind: 'question',
            words: `Save this rule? ${words}`,
            options: [SAVE_ANSWERS.yes, SAVE_ANSWERS.no],
            call: { tool: SAVE_RULE, input: spec },
            actor: t.ctx().actor,
            user: here.current.user.id,
            turn: here.current.turn,
            module: spec.module,
          })
          return ok(
            `Asked on a card (${card.id}) to save: ${words} Only their Save makes it a rule; the answer comes as a message.`,
          )
        }),
      { alwaysLoad: true },
    ),
    tool(
      'connect',
      `Open the sign-in for one of the person's accounts or folders, when they want it connected: ${(connectors?.known() ?? []).map((k) => `${k.manifest.name} (${k.manifest.title})`).join(', ') || 'none is loaded in this core'}. They sign in themselves in their window; Alpha never sees or types a password.`,
      { connector: z.string() },
      async ({ connector }) =>
        guard(() => {
          if (!connectors) throw new Refused('Connectors are not set up in this core.')
          const c = connectors.connector(connector)
          return ok(
            `The sign-in for ${c.manifest.title} is open in the person's window, under Settings › Connections. They type their own details there.`,
          )
        }),
    ),
    tool(
      'look',
      'Open a web page the way a person sees it: drawn by a browser, at a person’s pace, keeping to the site’s robots rules; it stops at a sign-in or a bot check and says so. Without css: its title, text and links. With css: how many elements match and the first few as HTML, to write or check a reader’s extraction. With module and page instead of url: a picture of that module’s page as the person will see it, drawn with its data, to look at before saying it is done.',
      {
        url: z.string().optional(),
        css: z.string().optional(),
        module: z.string().optional(),
        page: z.string().optional(),
      },
      async ({ url, css, module: moduleName, page: pageName }) =>
        guardAsync(async () => {
          if (!hands) throw new Refused('Pages are not set up in this core.')
          if (moduleName && pageName) {
            const m = world.shape.module(moduleName)
            if (!m) throw new Refused(`There is no module called ${moduleName}.`)
            const name = pageName.replace(/^pages\//, '').replace(/\.html$/, '')
            if (!pagesOf(m).some((p) => p.name === name))
              throw new Refused(`${m.name} has no page called ${name}: keep it first.`)
            if (!hands.browsers) throw new Refused('Alpha has no browser here to draw pages with.')
            const png = await printPage(world, m, name, { browsers: hands.browsers, as: 'png' })
            return {
              content: [
                { type: 'text', text: `${m.name}'s page ${name}, as the person will see it:` },
                { type: 'image', data: png.toString('base64'), mimeType: 'image/png' },
              ],
            }
          }
          if (!url) throw new Refused('Give a url, or a module and its page.')
          const engine = hands.browser()
          if (css) return ok(await engine.inspect(url, css))
          const page = await engine.open(url)
          return ok({
            url: page.url,
            status: page.status,
            title: page.title,
            text: page.text.slice(0, 20_000),
            links: page.links.slice(0, 150),
          })
        }),
    ),
    tool(
      'keep',
      [
        'Keep a file in a module: a skill (skills/<name>/SKILL.md with front matter name and description, and its script, say skills/<name>/run.js), a schedule (schedules/<name>.md), a page (pages/…) or NOTES.md. Give content, or leave it out to keep what you wrote there with Write. Each keep is a commit in the module’s folder.',
        'A schedule file: front matter `name`, `trigger` ({ every: hour | day | week, at: "07:00" }, { cron: "…" }, { changes: <table> } or { filed: true }, a document filed), and `runs: { script: <path in the module> }`, then its brief: what it does. Keep its script first. A schedule kept here is on.',
        'An agent: agent: its name, with define: { title (its job in a few words), description (when to use it; teammates decide from this), instructions (how it works and what a good answer looks like), model } makes it or changes it, and the Chief of staff alone makes one or changes another. agent with path skills/<name>/SKILL.md or files/… keeps a skill or file in that agent’s folder, and improve a skill you have before making another.',
        'Before you write a page or a script, read its grammar with guide (about: pages, or scripts).',
      ].join('\n'),
      {
        module: z.string().optional(),
        path: z.string().optional(),
        content: z.string().optional(),
        agent: z.string().optional(),
        define: z
          .object({
            name: z.string(),
            title: z.string(),
            description: z.string(),
            instructions: z.string(),
            model: z.string().nullable(),
          })
          .partial()
          .optional(),
      },
      async (a) =>
        guardAsync(async () => {
          if (a.agent) {
            const by = here.current.agent ?? null
            if (a.define) return ok(await keepAgent(world, a.agent, a.define, ctx(), by))
            if (!a.path || a.content === undefined)
              throw new Refused('Give the agent’s file and its words, or define the agent.')
            return ok(await keepAgentFile(world, a.agent, a.path, a.content, ctx(), by))
          }
          if (!a.module || !a.path) throw new Refused('Name the module and the path, or the agent.')
          const module = world.shape.module(a.module) ?? world.shape.makeModule(a.module, ctx())
          return ok(await keep(world, module, a.path, a.content, ctx()))
        }),
    ),
    tool(
      'guide',
      'The grammar of what a turn is about to write, fetched when needed: scripts (what a module’s script may call on alpha), pages (what a page is and its blocks), views (a saved view’s filters, sorts, group, colours), tasks (a task’s place, due, repeat, owner, and the task actions).',
      { about: z.enum(['scripts', 'pages', 'views', 'tasks']) },
      async ({ about }) =>
        ok(
          about === 'scripts'
            ? SCRIPT
            : about === 'pages'
              ? PAGE
              : about === 'views'
                ? VIEWS
                : TASKS,
        ),
      { alwaysLoad: true },
    ),
    tool(
      'run',
      'Run a module’s schedule, or one of its scripts with an input, now: to try a reader before it runs on its own. Its steps go to Activity and its outcome comes back here. A site not on the module’s list waits on the person’s yes on a card.',
      {
        module: z.string(),
        schedule: z.string().optional(),
        script: z.string().optional(),
        input: z.record(z.string(), z.unknown()).optional(),
      },
      async (a) =>
        guardAsync(async () => {
          if (!hands) throw new Refused('Runs are not set up in this core.')
          const module = world.shape.module(a.module)
          if (!module) throw new Refused(`There is no module called ${a.module}.`)
          const who = { user: here.current.user.id, turn: here.current.turn }
          let out: Awaited<ReturnType<ScheduleRunner['runScript']>>
          if (a.schedule) {
            const schedule = schedules(world, module.id).find(
              (x) => x.name.toLowerCase() === a.schedule?.toLowerCase(),
            )
            if (!schedule) throw new Refused(`${module.name} has no schedule called ${a.schedule}.`)
            out = await hands.runner.runSchedule(schedule, who, {}, { asked: true })
          } else if (a.script) {
            out = await hands.runner.runScript(
              module,
              a.script,
              a.input ?? {},
              `A try of ${a.script}`,
              null,
              who,
            )
          } else throw new Refused('Give the schedule or the script to run.')
          const result = JSON.stringify(out.result ?? null)
          return ok({
            state: out.state,
            words: out.words,
            result: result.length > 8000 ? `${result.slice(0, 8000)}…` : JSON.parse(result),
          })
        }),
    ),
  ]
}
