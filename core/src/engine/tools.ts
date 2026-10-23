// The world tools (design §5), as entries of the tool registry (decision 11): the Agent SDK
// serves them in process, and Alpha's own loop calls them directly. Each declares its effect,
// which the gate adapter maps to the gates; each writes through the world, which journals and
// checks provenance.

import { appendFileSync, existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { type BrowserEngine, type Effect, Problem } from '@alpha/connector-sdk'
import { guide } from '@alpha/kit-sdk'
import { z } from 'zod'
import type { ConnectorService } from '../connectors/service.ts'
import { importRows, readDocument } from '../files/documents.ts'
import { FILING, type Filing, type Intake } from '../files/intake.ts'
import { agents } from '../modules/agents.ts'
import { DRAFT, type Drafts } from '../modules/drafts.ts'
import { keep } from '../modules/keep.ts'
import { installedKits } from '../modules/kits.ts'
import { type AgentRunner, PROPOSE_TASKS } from '../modules/runs/index.ts'
import { pagesOf, printPage } from '../pages/pages.ts'
import { FIELD_KINDS, PROVENANCE_KINDS, Refused, type Said } from '../world/kinds.ts'
import { findField, type Table, type WriteCtx } from '../world/shape.ts'
import { PRIORITIES, type Task } from '../world/tasks.ts'
import { namedConfig, ViewConfig } from '../world/views.ts'
import type { User, World } from '../world/world.ts'
import { entry, type ToolEntry, type ToolResult } from './registry.ts'

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
  browsers?: string // where the core's own browser is kept, to look at a module's page
  intake?: Intake // files that come by mail, proposed for filing
  drafts?: Drafts // agents' drafts, sent from the person's mail on their yes
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
      note: z.string(), // for a computed value: the sum with its numbers
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

type Result = ToolResult

// One of Alpha's own tools, an entry under its server.
const tool = <S extends z.ZodRawShape>(
  name: string,
  description: string,
  input: S,
  handler: (input: z.infer<z.ZodObject<S>>) => Promise<Result>,
  extras: { alwaysLoad?: boolean } = {},
): ToolEntry => entry(SERVER, name, description, input, handler, extras)

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

// What a page is (design §13), for the model that draws one.
const PAGE = [
  'A page (pages/<name>.html): a <title>, <meta name="alpha-front"> when the module should open on it, <meta name="alpha-print" content="landscape"> when it is wide, then a <script> that calls alpha.page(async () => [ ...blocks ]).',
  'Inside it: await alpha.rows(table) gives the module’s rows as { id, values by field name, kinds }; await alpha.history(table, field) gives each row’s values of that field, oldest first, as { row, changes: [{ value, at }] }; alpha.input(name, { options }) offers a chooser and returns its value; alpha.open({ table, rows: [ids] }) or alpha.open({ table, row }) opens rows in the window; alpha.fmt(value, unit) writes a number, date or money as the window does.',
  'Blocks: { heading, note? }, a string or { text }, { stats: [{ label, value, unit?, of?, change?: { value, unit?, label?, better? }, tone?, open? }] }, { chart: { title?, kind: line | bar, rows, x, series: [{ field, label?, unit? }], target?: { value, label? } } }, { table: { title?, note?, columns: [{ field, label?, unit? }], rows } } where a cell may be { value, of?, tone?, open? }, { list: { title?, items: [{ text, tone?, open? }] } }, { card: { title?, text } }, { grid: { columns?, blocks } }, { button: { label, says } } (asks Alpha in the person’s words). tone is good, warn or bad. A chart series may carry kind (bar or line) and axis: right, to set a line on its own axis over bars.',
  'A page reads its own module’s tables only and writes nothing; it reaches nothing outside its frame. Alpha’s look is the kit’s: no colours, fonts or line weights of your own. Look at it (look with module and page) before you say it is done.',
].join('\n')

// What a script may call: the kit API's own guide (kit-sdk), the same source as the host and
// the reference page.
const SCRIPT = guide()

// The effect of a call, by tool and input: the gates read it.
export const EFFECTS: Record<string, (input: Record<string, unknown>) => Effect> = {
  query: () => 'read',
  search: () => 'read',
  shape: (i) => (i.action === 'remove_table' ? 'remove' : 'write'),
  write: () => 'write',
  change: (i) => (Array.isArray(i.remove) && i.remove.length ? 'remove' : 'write'),
  file: (i) => (i.action === 'read' ? 'read' : 'write'),
  ask: () => 'write',
  remember: () => 'write',
  task: (i) => (i.action === 'remove' ? 'remove' : i.action === 'find' ? 'read' : 'write'),
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

// A shape change as the desk's tool takes it.
const SHAPE_INPUT = {
  action: z.enum([
    'make_table',
    'add_fields',
    'rename',
    'set_choices',
    'remove_table',
    'save_view',
    'remove_view',
    'place_module',
  ]),
  module: z.string().optional(),
  within: z.string().optional(),
  table: z.string().optional(),
  fields: z.array(Field).optional(),
  field: z.string().optional(),
  to: z.string().optional(),
  choices: z.array(z.string()).optional(),
  asked_in: z.string().optional(),
  view: ViewConfig.partial().optional(),
  default: z.boolean().optional(),
}
export type ShapeAction = z.infer<z.ZodObject<typeof SHAPE_INPUT>>

export const MAINTAINED_SHAPE = 'maintained_shape'

// The module a shape change is to, and its kit, when someone else maintains it. Arrangement
// (views, placement) is the person's under any mark; shape is what goes to the maintainer.
function maintainedKit(world: World, a: ShapeAction) {
  if (['save_view', 'remove_view', 'place_module'].includes(a.action)) return null
  const module =
    a.action === 'make_table'
      ? world.shape.module(a.module?.trim() || a.table || '')
      : a.table
        ? world.shape.table(a.table)?.module
        : undefined
  if (!module) return null
  const kit = installedKits(world).find((k) => k.module === module.id)
  return kit?.maintainer ? { ...kit, maintainer: kit.maintainer, module } : null
}

export function describeShape(a: ShapeAction): string {
  const fields = (a.fields ?? []).map((f) => `${f.name} (${f.kind})`).join(', ')
  switch (a.action) {
    case 'make_table':
      return `make the table ${a.table}${fields ? ` with ${fields}` : ''}`
    case 'add_fields':
      return `add ${fields || 'fields'} to ${a.table}`
    case 'rename':
      return `rename ${a.field ? `${a.field} in ${a.table}` : `the table ${a.table}`} to ${a.to}`
    case 'set_choices':
      return `give ${a.field} in ${a.table} the choices ${(a.choices ?? []).join(', ')}`
    case 'remove_table':
      return `remove the table ${a.table}`
    default:
      return a.action.replace('_', ' ')
  }
}

// The shape change itself, as the tool and a card's "Do it now anyway" both apply it.
export function applyShape(world: World, a: ShapeAction, c: WriteCtx): string {
  const say = (words: string) => words
  const fields = (a.fields ?? []).map((f) => ({
    name: f.name,
    kind: f.kind,
    ...(f.choices ? { choices: f.choices } : {}),
    ...(f.relates_to ? { relatesTo: f.relates_to } : {}),
  }))
  if (a.action === 'place_module') {
    if (!a.module) throw new Refused('place_module needs module.')
    const m = world.shape.place(a.module, a.within?.trim() || null, c)
    const parent = m.parent ? world.shape.module(m.parent) : undefined
    return say(`${m.name} is ${parent ? `inside ${parent.name}` : 'at the top level'}.`)
  }
  const table = a.table
  if (!table) throw new Refused(`${a.action} needs table.`)
  switch (a.action) {
    case 'make_table': {
      const moduleName = a.module?.trim() || table
      const existing = world.shape.module(moduleName)
      const module = existing ?? world.shape.makeModule(moduleName, c)
      const t = world.shape.makeTable(module.id, table, fields, c)
      return say(
        `${existing ? '' : `Made the module ${module.name}. `}Made the table ${t.name} (view ${t.slug}) with ${
          t.fields.map((f) => `${f.name} (${f.kind})`).join(', ') || 'no fields yet'
        }.`,
      )
    }
    case 'add_fields': {
      const t = world.shape.addFields(tableOf(world, table).id, fields, c)
      return say(`${t.name} now has ${t.fields.map((f) => `${f.name} (${f.kind})`).join(', ')}.`)
    }
    case 'rename': {
      if (!a.to) throw new Refused('rename needs to.')
      const t = world.shape.rename(
        { table: tableOf(world, table).id, ...(a.field ? { field: a.field } : {}) },
        a.to,
        c,
      )
      return say(`Renamed. ${t.name} has ${t.fields.map((f) => f.name).join(', ')}.`)
    }
    case 'set_choices': {
      if (!a.field || !a.choices) throw new Refused('set_choices needs field and choices.')
      world.shape.setChoices(tableOf(world, table).id, a.field, a.choices, c)
      return say(`${a.field} now offers ${a.choices.join(', ')}.`)
    }
    case 'remove_table': {
      const t = tableOf(world, table)
      world.shape.removeTable(t.id, c)
      return say(`Removed the table ${t.name}.`)
    }
    case 'save_view': {
      if (!a.field) throw new Refused('save_view needs field: the view’s name.')
      const t = tableOf(world, table)
      const was = world.views
        .list(t.id)
        .find((v) => v.name.toLowerCase() === a.field?.toLowerCase())
      const v = world.views.save(
        {
          table: t.id,
          ...(was ? { id: was.id } : {}),
          name: a.to ?? a.field,
          // a change names only what changes; the rest stays as it was
          config: { ...(was ? namedConfig(t, was.config) : {}), ...(a.view ?? {}) },
          ...(a.default !== undefined ? { isDefault: a.default } : {}),
        },
        c,
      )
      return say(
        `${was ? 'Saved' : 'Made'} the view ${v.name} on ${t.name}${v.isDefault ? ', which the table opens on' : ''}.`,
      )
    }
    case 'remove_view': {
      const t = tableOf(world, table)
      const views = world.views.list(t.id)
      const v = views.find((x) => x.name.toLowerCase() === a.field?.toLowerCase())
      if (!v)
        throw new Refused(
          `${t.name} has no view called ${a.field}; it has ${views.map((x) => x.name).join(', ') || 'none'}.`,
        )
      world.views.remove(v.id, c)
      return say(`Removed the view ${v.name} from ${t.name}.`)
    }
  }
}

export function worldTools(
  world: World,
  here: Here,
  hands?: Hands,
  connectors?: ConnectorService,
): ToolEntry[] {
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
        'Make or change tables, and place modules. Actions:',
        'make_table: a table with its fields, in a module (made if it is not there yet); give module, table, fields.',
        'add_fields: give table and fields.',
        'rename: give table, and field if it is a field, and to.',
        'set_choices: give table, field and choices.',
        'remove_table: give table; if it holds the person’s own entries and they asked for it, asked_in quotes their words asking.',
        'save_view: a saved view of a table, shared by everyone, shown as a tab over it; give table, field (the view’s name; to renames it), view and default (true to open the table on it). A change names only what changes. Fields by name. view.kind: table, board, list, gallery, calendar, timeline, chart, form; filters { match: all or any, rules: [{ field, op, value, value2, values }] }: ops for text is, is_not, contains, not_contains, starts, ends; for numbers and money eq, ne, gt, lt, between (value, value2); for dates before, after, between, today, this_week, next_days (value: days); for a choice in (values); for any empty, not_empty. sorts [{ field, dir: asc or desc }] in order; group (a choice, text or date field); by (the date a calendar or timeline is laid on; a chart’s bars are by group, else by the months of by); measure (a number a chart adds up; none counts rows); hidden and order (fields); widths { field: px }; totals { field: sum, avg, min, max, count, empty, filled, unique, earliest, latest }; colours { tint: a choice whose colours tint rows, when: [{ field, op: gt, lt, eq, before or after, value, tone: good, warn, bad or accent }] }.',
        'remove_view: give table and field (the view’s name).',
        'place_module: put a module inside another; give module and within (the module it goes inside; leave within out for the top level). A module never goes inside itself or one of its own.',
        `Field kinds: ${FIELD_KINDS.join(', ')}. A relation names the table it relates_to.`,
      ].join('\n'),
      SHAPE_INPUT,
      async (a) =>
        guard(() => {
          const c = ctx()
          // a kit someone else maintains (decision 3b): a change to its shape goes to them as a
          // request, or in now with them told later; the person decides on a card
          const kit = a.action === 'place_module' ? null : maintainedKit(world, a)
          if (kit) {
            const card = world.cards.open({
              kind: 'suggestion',
              words: `${kit.maintainer.name} maintains ${kit.module.name}: ${describeShape(a)}. Ask them to put it in the kit's next version, or do it now and they are told later.`,
              restsOn: [`${kit.kit} ${kit.version} is maintained by ${kit.maintainer.name}`],
              options: [`Ask ${kit.maintainer.name}`, 'Do it now anyway'],
              call: { tool: MAINTAINED_SHAPE, input: a as Record<string, unknown> },
              actor: c.actor,
              user: c.user ?? null,
              turn: c.turn ?? null,
              module: kit.module.id,
            })
            return ok(
              `${kit.maintainer.name} maintains ${kit.module.name}, so this change is on a card for the person: ask ${kit.maintainer.name}, or do it now (card ${card.id}). Nothing changed yet.`,
            )
          }
          return ok(applyShape(world, a, c))
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
      'Files the person dropped in. read: a file’s contents with each piece’s place (sheet and cell, or line), from offset. import: a sheet’s rows into a table, with columns mapping each header to a field; every value keeps its cell as its source. place: put the file on the row it belongs to (a deal’s CIM on that deal), by table and row id, with kind one of the kinds that table’s rows take when it names them; the module’s readers then read it there. off: take it off that row; the file stays.',
      {
        action: z.enum(['read', 'import', 'place', 'off']),
        file: z.string(),
        offset: z.number().int().optional(),
        table: z.string().optional(),
        columns: z.record(z.string(), z.string()).optional(),
        sheet: z.string().optional(),
        row: z.string().optional(),
        kind: z.string().optional(),
      },
      async (a) =>
        guard(() => {
          const f = world.files.findFile(a.file)
          if (!f) throw new Refused(`There is no file called ${a.file}.`)
          if (a.action === 'read') return ok(readDocument(world, f.hash, a.offset ?? 0))
          if (a.action === 'place' || a.action === 'off') {
            if (!a.table || !a.row) throw new Refused(`${a.action} needs table and row.`)
            const t = tableOf(world, a.table)
            const rec = world.records.get(a.row)
            if (rec?.table.id !== t.id) throw new Refused(`${t.name} has no row ${a.row}.`)
            if (a.action === 'off') {
              world.unplaceFile(f.hash, a.row, ctx())
              return ok(`Took ${f.name} off that row.`)
            }
            const on = world.placeFile(f.hash, a.row, a.kind ?? null, ctx())
            return ok(
              `Filed ${f.name} on that row of ${t.name}${on.kind ? `, as a ${on.kind}` : ''}.`,
            )
          }
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
      'task',
      [
        "Keep the person's tasks: one list of all work, each on the place it concerns. Read them in the view tasks.",
        'add: a task with its title, on the place it concerns: on { module, table, row, field, page } (find the row first with query or search). Without on it sits on the module the person asked from, or nowhere yet. Then say in a line where you put it, so they can change it. touches: other rows ({ kind: row, ref: <row id> }), people ({ kind: person, ref: <id in view people> }) or files ({ kind: file, ref: <hash> }) it is about. An open task on the same place with most of the same words comes back as similar: offer to keep one.',
        "due: a day (2026-10-24) or a moment (2026-10-24T10:00:00, the person's time unless it says its zone); remind_at: when to remind them (a Mac notification and a line on Home); repeat: every day, every weekday, every Monday, every 2 weeks, monthly, on the 1st of each month (each occurrence its own task, the next made when one is done); priority: high, normal or low; owner: me (the person), alpha, or the name of an agent that takes tasks (its file says tasks: true); parent: the task it sits under.",
        'change (and on, to move it), start, wait, done, drop, reopen: one task by its id. Giving a task to an agent never starts it: start does, when the person says so, and runs the agent on it; its run says when it is done. remove: tasks by their ids (with the ones beneath), with asked_in: the person’s words asking for it, when they did. find: open tasks, by words and place.',
      ].join('\n'),
      {
        action: z.enum([
          'add',
          'change',
          'start',
          'wait',
          'done',
          'drop',
          'reopen',
          'remove',
          'find',
        ]),
        id: z.string().optional(),
        ids: z.array(z.string()).optional(),
        title: z.string().optional(),
        notes: z.string().nullable().optional(),
        due: z.string().nullable().optional(),
        remind_at: z.string().nullable().optional(),
        repeat: z.string().nullable().optional(),
        priority: z.enum(PRIORITIES).optional(),
        owner: z.string().optional(),
        parent: z.string().nullable().optional(),
        on: z
          .object({
            module: z.string().optional(),
            table: z.string().optional(),
            row: z.string().optional(),
            field: z.string().optional(),
            page: z.string().optional(),
          })
          .nullable()
          .optional(),
        touches: z
          .array(z.object({ kind: z.enum(['row', 'person', 'file']), ref: z.string() }))
          .optional(),
        words: z.string().optional(),
        asked_in: z.string().optional(),
      },
      async (a) =>
        guard(() => {
          const c = ctx()
          const owner = (o: string) => {
            if (/^(me|you|the person|person)$/i.test(o.trim()))
              return { kind: 'person' as const, id: here.current.user.id }
            if (/^alpha$/i.test(o.trim())) return { kind: 'alpha' as const, id: null }
            const agent = agents(world).find((x) => x.name.toLowerCase() === o.trim().toLowerCase())
            if (!agent)
              throw new Refused(
                `There is no agent called ${o}; the owner is me, alpha or an agent's name.`,
              )
            return { kind: 'agent' as const, id: agent.id }
          }
          const shown = (t: Task) => ({
            id: t.id,
            title: t.title,
            state: t.state,
            due: t.due,
            on: world.tasks.placeWords(t.place, (table, row) =>
              world.rowName(
                world.shape.table(table) as Table,
                world.records.get(row)?.record.values ?? {},
              ),
            ),
          })
          const one = () => {
            if (!a.id) throw new Refused('Give the task by its id.')
            return a.id
          }
          switch (a.action) {
            case 'add': {
              const from = here.current.from
              const on = a.on ?? (from ? { module: from.id } : null)
              const placeOf = on ? world.tasks.resolvePlace(on) : null
              const similar = placeOf && a.title ? world.tasks.similar(a.title, placeOf) : []
              const t = world.tasks.add(
                {
                  title: a.title ?? '',
                  notes: a.notes ?? null,
                  due: a.due ?? null,
                  remindAt: a.remind_at ?? null,
                  repeat: a.repeat ?? null,
                  ...(a.priority ? { priority: a.priority } : {}),
                  ...(a.owner !== undefined ? { owner: owner(a.owner) } : {}),
                  parent: a.parent ?? null,
                  on,
                  refs: a.touches ?? [],
                  placedBy: a.on ? 'alpha' : from ? 'asked from' : null,
                },
                c,
              )
              return ok({
                task: shown(t),
                ...(similar.length ? { similar: similar.map(shown) } : {}),
              })
            }
            case 'change': {
              const t = world.tasks.change(
                one(),
                {
                  ...(a.title !== undefined ? { title: a.title } : {}),
                  ...(a.notes !== undefined ? { notes: a.notes } : {}),
                  ...(a.due !== undefined ? { due: a.due } : {}),
                  ...(a.remind_at !== undefined ? { remindAt: a.remind_at } : {}),
                  ...(a.repeat !== undefined ? { repeat: a.repeat } : {}),
                  ...(a.priority ? { priority: a.priority } : {}),
                  ...(a.owner !== undefined ? { owner: owner(a.owner) } : {}),
                  ...(a.parent !== undefined ? { parent: a.parent } : {}),
                  ...(a.on !== undefined ? { on: a.on, placedBy: 'alpha' } : {}),
                  ...(a.touches !== undefined ? { refs: a.touches } : {}),
                },
                c,
              )
              return ok({ task: shown(t) })
            }
            case 'start': {
              const t = world.tasks.get(one())
              if (t?.owner.kind === 'agent') {
                if (!hands?.runner) throw new Refused('Agents are not set up in this core.')
                hands.runner
                  .startTask(t.id, { user: here.current.user.id, turn: here.current.turn })
                  .run.catch(() => undefined)
                return ok(
                  `Started ${world.tasks.ownerWords(t)} on it; its steps go to the task's page and Activity, and its run says when it is done.`,
                )
              }
              return ok({ task: shown(world.tasks.setState(one(), 'doing', c)) })
            }
            case 'wait':
            case 'done':
            case 'drop':
            case 'reopen': {
              const state = {
                wait: 'waiting',
                done: 'done',
                drop: 'dropped',
                reopen: 'todo',
              } as const
              const t = world.tasks.setState(one(), state[a.action], c)
              return ok({ task: shown(t) })
            }
            case 'remove': {
              const ids = a.ids ?? (a.id ? [a.id] : [])
              if (!ids.length) throw new Refused('Give the tasks to remove by their ids.')
              return ok(`Removed ${world.tasks.remove(ids, c)} task(s).`)
            }
            case 'find': {
              const on = a.on ? world.tasks.resolvePlace(a.on) : undefined
              return ok(
                world.tasks
                  .list({
                    open: true,
                    ...(on ? { on } : {}),
                    ...(a.words ? { words: a.words } : {}),
                  })
                  .slice(0, 100)
                  .map(shown),
              )
            }
          }
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
  return tools
}

export function instructionsFile(world: World, user: string | null): string {
  return join(world.paths.instructions, user ? `${user}.md` : 'everyone.md')
}

export const TOOL_NAMES = Object.keys(EFFECTS).sort()
