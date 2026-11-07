import { join } from 'node:path'
import { type BrowserEngine, type Effect, Problem } from '@alpha/connector-sdk'
import { guide, Summary, TONES } from '@alpha/kit-sdk'
import { z } from 'zod'
import type { ConnectorService } from '../../connectors/service.ts'
import type { Intake } from '../../files/intake.ts'
import type { Drafts } from '../../modules/drafts.ts'
import type { AgentRunner } from '../../modules/runs/index.ts'
import { FIELD_KINDS, PROVENANCE_KINDS, Refused, type Said } from '../../world/kinds.ts'
import type { Table } from '../../world/shape/index.ts'
import type { User, World } from '../../world/world.ts'
import { entry, type ToolEntry, type ToolResult } from '../registry.ts'

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
  // the tables whose fields and meanings the model has been given this session (context by
  // mode, 24 Oct): a table is described on its first touch, again after compaction
  touched: Set<string>
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

export const Provenance = z.object({
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

export const Field = z.object({
  name: z.string(),
  kind: z.enum(FIELD_KINDS),
  // one sentence on what the field means: a wall, so no field is made without one (Kenil, 24 Oct)
  about: z.string().min(1),
  choices: z.array(z.string()).optional(),
  tones: z.record(z.string(), z.enum(TONES)).optional(),
  relates_to: z.string().optional(),
  many: z.boolean().optional(), // a relation holding a list of rows, a choice holding several
  part_of: z.boolean().optional(), // a relation to one row whose rows are part of it (step 3a)
  summary: Summary.optional(), // a summary's rows, what it does and its condition (step 3c)
  per: z.enum(['person']).optional(), // a person field: its table holds one row per person (3d)
})

export type Result = ToolResult

// One of Alpha's own tools, an entry under its server.
export const tool = <S extends z.ZodRawShape>(
  name: string,
  description: string,
  input: S,
  handler: (input: z.infer<z.ZodObject<S>>) => Promise<Result>,
  extras: { alwaysLoad?: boolean } = {},
): ToolEntry => entry(SERVER, name, description, input, handler, extras)

export function ok(value: unknown): Result {
  return {
    content: [
      { type: 'text', text: typeof value === 'string' ? value : JSON.stringify(value, null, 1) },
    ],
  }
}

export function guard(fn: () => Result): Result {
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

export async function guardAsync(fn: () => Promise<Result>): Promise<Result> {
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
export const PAGE = [
  'A page (pages/<name>.html): a <title>, <meta name="alpha-front"> when the module should open on it, <meta name="alpha-print" content="landscape"> when it is wide, then a <script> that calls alpha.page(async () => [ ...blocks ]).',
  'Inside it: await alpha.rows(table) gives the module’s rows as { id, values by field name, kinds }; await alpha.history(table, field) gives each row’s values of that field, oldest first, as { row, changes: [{ value, at }] }; alpha.input(name, { options }) offers a chooser and returns its value; alpha.open({ table, rows: [ids] }) or alpha.open({ table, row }) opens rows in the window; alpha.fmt(value, unit) writes a number, date or money as the window does.',
  'Blocks: { heading, note? }, a string or { text }, { stats: [{ label, value, unit?, of?, change?: { value, unit?, label?, better? }, tone?, open? }] }, { chart: { title?, kind: line | bar, rows, x, series: [{ field, label?, unit? }], target?: { value, label? } } }, { table: { title?, note?, columns: [{ field, label?, unit? }], rows } } where a cell may be { value, of?, tone?, open? }, { list: { title?, items: [{ text, tone?, open? }] } }, { card: { title?, text } }, { grid: { columns?, blocks } }, { button: { label, says } } (asks Alpha in the person’s words). tone is good, warn or bad. A chart series may carry kind (bar or line) and axis: right, to set a line on its own axis over bars.',
  'A page reads its own module’s tables only and writes nothing; it reaches nothing outside its frame. Alpha’s look is the kit’s: no colours, fonts or line weights of your own. Look at it (look with module and page) before you say it is done.',
].join('\n')

// What a script may call: the kit API's own guide (kit-sdk), the same source as the host and
// the reference page.
export const SCRIPT = guide()

// The grammar of a saved view, fetched with guide (about: views) when a turn saves one.
export const VIEWS =
  'A saved view, given to shape save_view as view (a change names only what changes; fields by name). view.kind: table, board, list, gallery, calendar, timeline, chart, form; filters { match: all or any, rules: [{ field, op, value, value2, values }] }: ops for text is, is_not, contains, not_contains, starts, ends; for numbers and money eq, ne, gt, lt, between (value, value2); for dates before, after, between, today, this_week, next_days (value: days); for a choice in (values; is any of them); for a choice holding several (tags) in (has any of), all_of, none_of (values); for any empty, not_empty. sorts [{ field, dir: asc or desc }] in order; group (a choice, text or date field); by (the date a calendar or timeline is laid on; a chart’s bars are by group, else by the months of by); measure (a number a chart adds up; none counts rows); hidden and order (fields); widths { field: px }; frozen (how many columns stay at the left as it scrolls across, 1 or more); wrap (fields whose words run onto more lines); totals { field: sum, avg, min, max, count, empty, filled, unique, earliest, latest }; colours { tint: a choice whose colours tint rows, when: [{ field, op: gt, lt, eq, before or after, value, tone: good, warn, bad or accent }] }.'

// The grammar of a task, fetched with guide (about: tasks) when a turn adds or changes one.
export const TASKS = [
  'task add: a task with its title, on the place it concerns: on { module, table, row, field, page } (find the row first with query or search). Without on it sits on the module the person asked from, or nowhere yet. Then say in a line where you put it, so they can change it. touches: other rows ({ kind: row, ref: <row id> }), people ({ kind: person, ref: <id in view people> }) or files ({ kind: file, ref: <hash> }) it is about. An open task on the same place with most of the same words comes back as similar: offer to keep one.',
  "due: a day (2026-10-24) or a moment (2026-10-24T10:00:00, the person's time unless it says its zone); remind_at: when to remind them (a Mac notification and a line on Home); repeat: every day, every weekday, every Monday, every 2 weeks, monthly, on the 1st of each month (each occurrence its own task, the next made when one is done); priority: high, normal or low; owner: me (the person), alpha, or the name of an agent that takes tasks (its file says tasks: true); parent: the task it sits under.",
  'change (and on, to move it), start, wait, done, drop, reopen: one task by its id.',
].join('\n')

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
  guide: () => 'read',
  rule: () => 'write',
}

// A stated value that cites a card rests on the person's answer to it: a wall, so a card that is
// waiting, or one the person said no to, is never cited as their word.
export function cardsCited(
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

export function tableOf(world: World, name: string): Table {
  const t = world.shape.table(name)
  if (!t) {
    const names = world.shape.tables().map((x) => x.name)
    throw new Refused(
      `There is no table called ${name}${names.length ? `; there are ${names.join(', ')}` : ''}.`,
    )
  }
  return t
}

// What a group of tools closes over: the world, where the desk is, the hands, the connectors,
// and the write context of the turn.
export interface Tooling {
  world: World
  here: Here
  hands?: Hands | undefined
  connectors?: ConnectorService | undefined
  ctx: () => { actor: { kind: 'alpha' }; user: string; turn: string | null; said: Said | null }
}

// Where the person's standing instructions are kept: theirs, or everyone's.
export function instructionsFile(world: World, user: string | null): string {
  return join(world.paths.instructions, user ? `${user}.md` : 'everyone.md')
}
