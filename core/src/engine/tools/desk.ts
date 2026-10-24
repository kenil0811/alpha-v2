// The desk's other hands: ask (a card), remember (instructions), connect, look (a page, a
// module, a row), keep (a file in a module) and run (an agent or a script, for a try).

import { appendFileSync, existsSync, readFileSync } from 'node:fs'
import { z } from 'zod'
import { FILING, type Filing } from '../../files/intake.ts'
import { agents } from '../../modules/agents.ts'
import { DRAFT } from '../../modules/drafts.ts'
import { keep } from '../../modules/keep.ts'
import { type AgentRunner, PROPOSE_TASKS } from '../../modules/runs/index.ts'
import { pagesOf, printPage } from '../../pages/pages.ts'
import { Refused } from '../../world/kinds.ts'
import type { ToolEntry } from '../registry.ts'
import type { Tooling } from './common.ts'
import { guard, guardAsync, instructionsFile, ok, PAGE, SCRIPT, tool } from './common.ts'

export function deskTools({ world, here, hands, connectors, ctx }: Tooling): ToolEntry[] {
  return [
    tool(
      'ask',
      'Put a question to the person as a card in their window, with options if there are a few clear ones. Or, when the person has just answered a waiting card in their own words, answer that card for them: answer_card, choice (one of its options) and words (theirs, quoted from their message).',
      {
        question: z.string().optional(),
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
            // an agent's draft is sent or held, a file from the mail filed or declined, as drafted
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
            if (card.call?.tool === PROPOSE_TASKS && hands?.runner && !no) {
              const done = hands.runner.adopt(card.id, 'all', here_.user.id)
              return ok(`The card is answered: ${done.state}; its tasks are added.`)
            }
            const done = world.cards.answer(card.id, choice, { kind: 'person', id: here_.user.id })
            return ok(`The card is answered: ${done.state}.`)
          }
          if (!a.question?.trim()) throw new Refused('A question is needed.')
          const card = world.cards.open({
            kind: 'question',
            words: a.question.trim(),
            options: a.options ?? [],
            actor: { kind: 'alpha' },
            user: here_.user.id,
            turn: here_.turn,
          })
          return ok(`Asked on a card (${card.id}); the answer comes as a message.`)
        }),
      { alwaysLoad: true },
    ),
    tool(
      'remember',
      'Keep a standing instruction: how the person wants things done from now on. for: me (this person) or everyone (the whole firm).',
      { instruction: z.string(), for: z.enum(['me', 'everyone']) },
      async (a) =>
        guard(() => {
          const file = instructionsFile(world, a.for === 'me' ? here.current.user.id : null)
          appendFileSync(
            file,
            `${existsSync(file) && readFileSync(file, 'utf8').length ? '' : '# Standing instructions\n\n'}- ${a.instruction.trim()}\n`,
          )
          world.line({
            actor: { kind: 'alpha' },
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
      { alwaysLoad: true },
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
        'Keep a file in a module: a skill (skills/<name>/SKILL.md with front matter name and description, and its script, say skills/<name>/run.js), an agent (agents/<name>.md), a page (pages/…) or NOTES.md. Give content, or leave it out to keep what you wrote there with Write. Each keep is a commit in the module’s folder.',
        'An agent file: front matter `name`, `trigger` ({ every: hour | day | week, at: "07:00" }, { cron: "…" }, { changes: <table> } or { filed: true }, a document filed), `tasks: true` when it takes the tasks given to it (then the trigger may be left out: it runs only for them; its script reads the task from alpha.input.task, whose place.row is the row’s id and values that row’s values by field name, and ends with alpha.task.done(words) or alpha.task.wait(words)), and `runs: { script: <path in the module> }`, then its brief: what it does, and for an agent that takes tasks, which tasks. Keep its script first. An agent kept here is on.',
        PAGE,
        SCRIPT,
      ].join('\n'),
      { module: z.string(), path: z.string(), content: z.string().optional() },
      async (a) =>
        guardAsync(async () => {
          const module = world.shape.module(a.module) ?? world.shape.makeModule(a.module, ctx())
          return ok(await keep(world, module, a.path, a.content, ctx()))
        }),
    ),
    tool(
      'run',
      'Run a module’s agent, or one of its scripts with an input, now: to try a reader before it runs on its own. Its steps go to Activity and its outcome comes back here. A site not on the module’s list waits on the person’s yes on a card.',
      {
        module: z.string(),
        agent: z.string().optional(),
        script: z.string().optional(),
        input: z.record(z.string(), z.unknown()).optional(),
      },
      async (a) =>
        guardAsync(async () => {
          if (!hands) throw new Refused('Runs are not set up in this core.')
          const module = world.shape.module(a.module)
          if (!module) throw new Refused(`There is no module called ${a.module}.`)
          const who = { user: here.current.user.id, turn: here.current.turn }
          let out: Awaited<ReturnType<AgentRunner['runScript']>>
          if (a.agent) {
            const agent = agents(world, module.id).find(
              (x) => x.name.toLowerCase() === a.agent?.toLowerCase(),
            )
            if (!agent) throw new Refused(`${module.name} has no agent called ${a.agent}.`)
            out = await hands.runner.runAgent(agent, who)
          } else if (a.script) {
            out = await hands.runner.runScript(
              module,
              a.script,
              a.input ?? {},
              `A try of ${a.script}`,
              null,
              who,
            )
          } else throw new Refused('Give the agent or the script to run.')
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
