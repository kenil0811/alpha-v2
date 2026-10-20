// The world tools, served in process (design §5). Each declares its effect, which the before-call
// hook maps to the gates; each writes through the world, which journals and checks provenance.

import { appendFileSync, existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { type BrowserEngine, type Effect, Problem } from '@alpha/connector-sdk'
import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk'
import { z } from 'zod'
import { KNOWN } from '../connectors/service.ts'
import { importRows, readDocument } from '../files/documents.ts'
import { agents } from '../modules/agents.ts'
import { keep } from '../modules/keep.ts'
import type { AgentRunner } from '../modules/runs.ts'
import { FIELD_KINDS, PROVENANCE_KINDS, Refused, type Said } from '../world/kinds.ts'
import { findField, type Table } from '../world/shape.ts'
import type { User, World } from '../world/world.ts'

// Where the desk is: whose turn, on which of their messages. Set by the desk before each turn.
export interface TurnContext {
  user: User
  turn: string | null
  said: Said | null
  message: string | null
  from?: { id: string; name: string } | null // the module the person asked from (Ask, ⌘J)
}

export interface Here {
  current: TurnContext
  fromSubagent: boolean
}

// What reaches past the world's tables: the browser engine and the runner of module scripts.
export interface Hands {
  browser: () => BrowserEngine
  runner: AgentRunner
}

export const SERVER = 'alpha'

const Provenance = z.object({
  kind: z.enum(PROVENANCE_KINDS),
  source: z
    .object({
      url: z.string(),
      document: z.string(),
      page: z.number(),
      file: z.string(),
      sheet: z.string(),
      cell: z.string(),
      line: z.number(),
      record: z.string(),
      inputs: z.array(z.string()),
      formula: z.string(),
      card: z.string(), // for a stated value: the card the person answered
    })
    .partial()
    .optional(),
  basis: z.string().optional(),
})

const Field = z.object({
  name: z.string(),
  kind: z.enum(FIELD_KINDS),
  choices: z.array(z.string()).optional(),
  relates_to: z.string().optional(),
})

type Result = { content: { type: 'text'; text: string }[]; isError?: boolean }

function ok(value: unknown): Result {
  return {
    content: [
      { type: 'text', text: typeof value === 'string' ? value : JSON.stringify(value, null, 1) },
    ],
  }
}

function guard(fn: () => Result): Result {
  try {
    return fn()
  } catch (err) {
    const msg =
      err instanceof Refused
        ? err.message
        : `Something went wrong: ${err instanceof Error ? err.message : String(err)}`
    return { content: [{ type: 'text', text: msg }], isError: true }
  }
}

async function guardAsync(fn: () => Promise<Result>): Promise<Result> {
  try {
    return await fn()
  } catch (err) {
    const msg =
      err instanceof Refused || err instanceof Problem
        ? err.message
        : `Something went wrong: ${err instanceof Error ? err.message : String(err)}`
    return { content: [{ type: 'text', text: msg }], isError: true }
  }
}

const SCRIPT = [
  'A script is JavaScript: `export default async (alpha) => { … return { words } }`. It has no network and writes only in its module folder; it reaches the world through alpha:',
  'alpha.input; alpha.rows.list(table) (each row: id, key, values by field name); alpha.rows.land(table, [{ key, values, url }]) (a row per key, added or changed; values by field name; url only for the web page a row was read from);',
  'alpha.rows.compute(table, id, values, formula) (values with the formula each came from); alpha.browser.open(url) (title, text, links, html);',
  'alpha.browser.extract(url, { list, fields: { name: { css, attr } }, next, id: { field, pattern }, pages }) (every page of a list by its next link, or at most `pages`; returns { pages, items }, each item its fields with _id and _url; a failure carries kind sign_in or blocked);',
  'alpha.tell(words, { table, rows, choice: { field, value, label } }) (a line on the person’s Home, for what is worth their attention; with rows, each can be opened, and the choice sets that field in one click); alpha.log(words) (a step in Activity).',
].join('\n')

// The effect of a call, by tool and input: the gates read it.
export const EFFECTS: Record<string, (input: Record<string, unknown>) => Effect> = {
  query: () => 'read',
  search: () => 'read',
  shape: (i) => (i.action === 'remove_table' ? 'remove' : 'write'),
  write: () => 'write',
  change: (i) => (Array.isArray(i.remove) && i.remove.length ? 'remove' : 'write'),
  file: (i) => (i.action === 'import' ? 'write' : 'read'),
  ask: () => 'write',
  remember: () => 'write',
  connect: () => 'sign_in',
  look: () => 'read',
  keep: () => 'write',
  run: () => 'write',
}

// A stated value that cites a card rests on the person's answer to it: a wall, so a card that is
// waiting, or one the person said no to, is never cited as their word.
function cardsCited(
  world: World,
  rows: {
    provenance: z.infer<typeof Provenance>
    per_field?: Record<string, z.infer<typeof Provenance>> | undefined
  }[],
): void {
  for (const r of rows)
    for (const p of [r.provenance, ...Object.values(r.per_field ?? {})]) {
      const id = p.kind === 'stated' ? p.source?.card : undefined
      if (!id) continue
      const card = world.cards.get(id)
      if (!card || (card.state !== 'yes' && card.state !== 'answered'))
        throw new Refused(`Card ${id} has no answer from the person to rest a value on.`)
    }
}

function tableOf(world: World, name: string): Table {
  const t = world.shape.table(name)
  if (!t) {
    const names = world.shape.tables().map((x) => x.name)
    throw new Refused(
      `There is no table called ${name}${names.length ? `; there are ${names.join(', ')}` : ''}.`,
    )
  }
  return t
}

export function worldTools(world: World, here: Here, hands?: Hands) {
  const ctx = () => ({
    actor: { kind: 'alpha' as const },
    user: here.current.user.id,
    turn: here.current.turn,
    said: here.fromSubagent ? null : here.current.said,
  })

  const tools = [
    tool(
      'query',
      'Read the world in SQL (SQLite). Each table is a view named as the table, with columns id, added and one per field; the journal is the view `journal` (id, at, actor, kind, words, module). Returns rows, their total and the offset; pass offset for the next page.',
      { sql: z.string(), offset: z.number().int().optional() },
      async ({ sql, offset }) => guard(() => ok(world.sql.query(sql, offset ?? 0))),
      { alwaysLoad: true },
    ),
    tool(
      'search',
      'Search the journal, the tables and the documents by words. Returns the best hits with where each was found.',
      { words: z.string() },
      async ({ words }) => guard(() => ok(world.search(words))),
      { alwaysLoad: true },
    ),
    tool(
      'shape',
      [
        'Make or change tables. Actions:',
        'make_table: a table with its fields, in a module (made if it is not there yet); give module, table, fields.',
        'add_fields: give table and fields.',
        'rename: give table, and field if it is a field, and to.',
        'set_choices: give table, field and choices.',
        'remove_table: give table; if it holds the person’s own entries and they asked for it, asked_in quotes their words asking.',
        `Field kinds: ${FIELD_KINDS.join(', ')}. A relation names the table it relates_to.`,
      ].join('\n'),
      {
        action: z.enum(['make_table', 'add_fields', 'rename', 'set_choices', 'remove_table']),
        module: z.string().optional(),
        table: z.string(),
        fields: z.array(Field).optional(),
        field: z.string().optional(),
        to: z.string().optional(),
        choices: z.array(z.string()).optional(),
        asked_in: z.string().optional(),
      },
      async (a) =>
        guard(() => {
          const c = ctx()
          const fields = (a.fields ?? []).map((f) => ({
            name: f.name,
            kind: f.kind,
            ...(f.choices ? { choices: f.choices } : {}),
            ...(f.relates_to ? { relatesTo: f.relates_to } : {}),
          }))
          switch (a.action) {
            case 'make_table': {
              const moduleName = a.module?.trim() || a.table
              const existing = world.shape.module(moduleName)
              const module = existing ?? world.shape.makeModule(moduleName, c)
              const t = world.shape.makeTable(module.id, a.table, fields, c)
              return ok(
                `${existing ? '' : `Made the module ${module.name}. `}Made the table ${t.name} (view ${t.slug}) with ${
                  t.fields.map((f) => `${f.name} (${f.kind})`).join(', ') || 'no fields yet'
                }.`,
              )
            }
            case 'add_fields': {
              const t = world.shape.addFields(tableOf(world, a.table).id, fields, c)
              return ok(
                `${t.name} now has ${t.fields.map((f) => `${f.name} (${f.kind})`).join(', ')}.`,
              )
            }
            case 'rename': {
              if (!a.to) throw new Refused('rename needs to.')
              const t = world.shape.rename(
                { table: tableOf(world, a.table).id, ...(a.field ? { field: a.field } : {}) },
                a.to,
                c,
              )
              return ok(`Renamed. ${t.name} has ${t.fields.map((f) => f.name).join(', ')}.`)
            }
            case 'set_choices': {
              if (!a.field || !a.choices) throw new Refused('set_choices needs field and choices.')
              world.shape.setChoices(tableOf(world, a.table).id, a.field, a.choices, c)
              return ok(`${a.field} now offers ${a.choices.join(', ')}.`)
            }
            case 'remove_table': {
              const t = tableOf(world, a.table)
              world.shape.removeTable(t.id, c)
              return ok(`Removed the table ${t.name}.`)
            }
          }
        }),
      { alwaysLoad: true },
    ),
    tool(
      'write',
      'Add rows to a table. Values are keyed by field name. Every row carries the provenance of its values: kind is stated (the person said it, or answered it on a card: source.card), looked_up (with source: url, document and page, file with sheet and cell, or record), computed (source.inputs or source.formula), estimated or assumed (with basis, a few words on what it rests on). per_field gives a field its own provenance. Money is {"amount": 12.5, "currency": "USD"}; a date is like 2026-10-19.',
      {
        table: z.string(),
        rows: z.array(
          z.object({
            values: z.record(z.string(), z.unknown()),
            provenance: Provenance,
            per_field: z.record(z.string(), Provenance).optional(),
          }),
        ),
      },
      async ({ table, rows }) =>
        guard(() => {
          const t = tableOf(world, table)
          cardsCited(world, rows)
          const ids = world.records.add(
            t.id,
            rows.map((r) => ({
              values: r.values,
              provenance: r.provenance,
              ...(r.per_field ? { per_field: r.per_field } : {}),
            })) as never,
            ctx(),
          )
          return ok(
            `Added ${ids.length} row${ids.length === 1 ? '' : 's'} to ${t.name}: ${ids.join(', ')}.`,
          )
        }),
      { alwaysLoad: true },
    ),
    tool(
      'change',
      'Change rows of a table (rows: id, values by field name, provenance as for write), or remove rows (remove: their ids). When removing the person’s own entries because they asked, asked_in quotes their words asking for it.',
      {
        table: z.string(),
        rows: z
          .array(
            z.object({
              id: z.string(),
              values: z.record(z.string(), z.unknown()),
              provenance: Provenance,
              per_field: z.record(z.string(), Provenance).optional(),
            }),
          )
          .optional(),
        remove: z.array(z.string()).optional(),
        asked_in: z.string().optional(),
      },
      async ({ table, rows, remove }) =>
        guard(() => {
          const t = tableOf(world, table)
          const said: string[] = []
          if (rows?.length) {
            cardsCited(world, rows)
            world.records.change(t.id, rows as never, ctx())
            said.push(`Changed ${rows.length} row${rows.length === 1 ? '' : 's'} in ${t.name}.`)
          }
          if (remove?.length) {
            const n = world.records.remove(t.id, remove, ctx())
            said.push(`Removed ${n} row${n === 1 ? '' : 's'} from ${t.name}.`)
          }
          if (!said.length) throw new Refused('Nothing to change: give rows or remove.')
          return ok(said.join(' '))
        }),
      { alwaysLoad: true },
    ),
    tool(
      'file',
      'Files the person dropped in. read: a file’s contents with each piece’s place (sheet and cell, or line), from offset. import: a sheet’s rows into a table, with columns mapping each header to a field; every value keeps its cell as its source.',
      {
        action: z.enum(['read', 'import']),
        file: z.string(),
        offset: z.number().int().optional(),
        table: z.string().optional(),
        columns: z.record(z.string(), z.string()).optional(),
        sheet: z.string().optional(),
      },
      async (a) =>
        guard(() => {
          const f = world.files.findFile(a.file)
          if (!f) throw new Refused(`There is no file called ${a.file}.`)
          if (a.action === 'read') return ok(readDocument(world, f.hash, a.offset ?? 0))
          if (!a.table || !a.columns) throw new Refused('import needs table and columns.')
          const t = tableOf(world, a.table)
          for (const field of Object.values(a.columns)) findField(t, field)
          return ok(importRows(world, f.hash, t, a.columns, a.sheet ?? null, ctx()))
        }),
      { alwaysLoad: true },
    ),
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
        guard(() => {
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
      `Open the sign-in for one of the person's accounts or folders, when they want it connected: ${KNOWN.map((k) => `${k.manifest.name} (${k.manifest.title})`).join(', ')}. They sign in themselves in their window; Alpha never sees or types a password.`,
      { connector: z.enum(KNOWN.map((k) => k.manifest.name) as [string, ...string[]]) },
      async ({ connector }) =>
        guard(() => {
          const c = KNOWN.find((k) => k.manifest.name === connector)
          return ok(
            `The sign-in for ${c?.manifest.title ?? connector} is open in the person's window, under Settings › Connections. They type their own details there.`,
          )
        }),
      { alwaysLoad: true },
    ),
    tool(
      'look',
      'Open a web page the way a person sees it: drawn by a browser, at a person’s pace, keeping to the site’s robots rules; it stops at a sign-in or a bot check and says so. Without css: its title, text and links. With css: how many elements match and the first few as HTML, to write or check a reader’s extraction.',
      { url: z.string(), css: z.string().optional() },
      async ({ url, css }) =>
        guardAsync(async () => {
          if (!hands) throw new Refused('Pages are not set up in this core.')
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
        'An agent file: front matter `name`, `trigger` ({ every: hour | day | week, at: "07:00" }, { cron: "…" } or { changes: <table> }) and `runs: { script: <path in the module> }`, then its brief. Keep its script first. An agent kept here is on.',
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
  return createSdkMcpServer({ name: SERVER, version: '0.1.0', alwaysLoad: true, tools })
}

export function instructionsFile(world: World, user: string | null): string {
  return join(world.paths.instructions, user ? `${user}.md` : 'everyone.md')
}

export const TOOL_NAMES = Object.keys(EFFECTS).sort()
