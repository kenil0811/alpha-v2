import { TONES } from '@alpha/kit-sdk'
import type { ColumnSpec } from '../ddl.ts'
import type { Rule } from '../filter-sql.ts'
import type { Actor } from '../journal.ts'
import { type FieldKind, Refused } from '../kinds.ts'
import { MODEL_VIEWS } from '../modelsql.ts'
import type { SummaryInput } from './summary.ts'

export interface Module {
  id: string
  name: string
  slug: string
  dir: string
  parent: string | null // the module it sits inside, or none at the top level
}

// Who put a module where it is: a kit's place gives way to the person's or Alpha's on update.
export type PlacedBy = 'kit' | 'person' | 'alpha'

export type ModuleRow = { id: string; name: string; slug: string; parent_id: string | null }

export interface Field {
  id: string
  name: string
  slug: string
  kind: FieldKind
  choices: string[]
  tones: Record<string, Tone> // a choice's colour where it means a state (Fits, Does not fit)
  relatesTo: string | null
  many: boolean // a relation holding a list of rows: a junction table, not a column
  tags: boolean // a choice holding several (core step 3c): a JSON list in its column
  summary: SummarySpec | null // worked out from the rows that point here, never stored (3c)
  // a person field whose table holds one row per person (core step 3d): a second is refused,
  // and a merge of two people folds their rows into one
  per: 'person' | null
  sensitive: boolean // its values never reach a journal line: "(kept out)" there (step 2, part 3)
  // a relation whose rows are part of the row they point at (core step 3a): shown on it, removed
  // and brought back with it, never empty
  partOf: boolean
  indexed: boolean // an index the kit asked for
  key: string | null // a kit field's stable name, matched on update; none for the person's own
  about: string | null // one sentence on what it means (the semantic layer)
  aboutBy: AboutBy | null // whose sentence: the kit's, Alpha's (assumed), or the person's
}

// A summary field (core step 3c), by ids: the rows of `of` whose relation `through` points at
// this row, counted, or one of their fields summed, the least, the most or the latest, where one
// condition holds, in the words of a view's filter.
export interface SummarySpec {
  of: string
  through: string
  op: 'count' | 'sum' | 'min' | 'max' | 'latest'
  field?: string
  by?: string
  where?: Rule
}

// Whose sentence an about is: the person's stands over the kit's and Alpha's.
export type AboutBy = 'kit' | 'alpha' | 'person'

// The colours a choice may take: the window's state colours, nothing else.
export type Tone = 'good' | 'warn' | 'bad' | 'accent'
export { TONES }

export interface Table {
  id: string
  module: Module
  name: string
  slug: string
  key: string | null // the name the kit or connector that made it gave it (call 6); none for others
  hidden: boolean // out of the sidebar
  setup: boolean // what the module's agents read: under Agents and notes, not a tab (step 3a)
  tab: boolean // kept as a tab of its module wherever it sits, by the person or its kit (28 Oct)
  addedOn: string | null // Alpha adds a row only once the person has answered this on a card
  fields: Field[]
  documents: string[] | null // the kinds of document its rows take, as its kit names them
  people: PeopleMap | null // how its rows name people
  about: string | null // one sentence on what a row of it is
  aboutBy: AboutBy | null
}

// How a table's rows name people (design §4), by its fields' names: each row is a person (a
// contact card, a LinkedIn connection), or an exchange with people (a message, a meeting), whose
// fields hold addresses as a message writes them: Name <address>, another@address.
export type PeopleMap =
  | {
      each: 'person'
      name?: string // none: their name comes from wherever else they are known
      emails?: string
      phones?: string
      profile?: string
      company?: string
      title?: string
      you?: { field: string; is: string } // the person's own card: Is you is yes
    }
  | {
      each: 'exchange'
      channel: string // mail, meeting
      at: string
      from?: string // who wrote it
      to?: string[] // whom it went to
      with?: string[] // everyone at it: a meeting's attendees
      sent?: { field: string; is: string } // the person's own: Direction is sent
      by?: string // who started it: a meeting's organizer
      about?: string // what it was about: a message's subject, a meeting's title
      you?: string // the person's own address in it
    }

export interface FieldInput {
  name: string
  kind: FieldKind
  choices?: string[]
  tones?: Record<string, Tone>
  relatesTo?: string // a table, for a relation
  many?: boolean // a relation holding a list of rows, or a choice holding several (tags)
  partOf?: boolean // its rows are part of the row it points at
  summary?: SummaryInput // a summary's table, relation, what it takes and its condition
  per?: 'person' // on a person field: one row per person in its table
  indexed?: boolean // an index on it, for a field filtered on often
  sensitive?: boolean // its values never reach a journal line (step 2, part 3)
  key?: string // a kit field's stable name
  about?: string // one sentence on what it means
  aboutBy?: AboutBy // whose sentence; alpha when the desk wrote it (shown as assumed)
}

export interface WriteCtx {
  actor: Actor
  user?: string | null
  turn?: string | null
  run?: string | null
  anyway?: boolean // the person's "do it now" on a maintained kit's card (rules M4, asks.ts)
}

// Names the model and SQL can both use: lower case, words joined by underscores.
export function slugify(name: string): string {
  const s = name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
  return s && /^[a-z]/.test(s) ? s : `t_${s || 'unnamed'}`
}

// Names no table may take: the world's own tables and SQL's words.
export const RESERVED = new Set([
  'journal',
  'users',
  'modules',
  'tables',
  'fields',
  'records',
  'record_versions',
  'versions',
  'provenance',
  'rows',
  'cards',
  'files',
  'documents',
  'chunks',
  'row_files',
  'permissions',
  'rules',
  'removed_rows',
  'people',
  'companies',
  'people_keys',
  'people_sources',
  'people_links',
  'people_pairs',
  'exchanges',
  'tasks',
  'task_refs',
  'desk_sessions',
  'desk_messages',
  'meta',
  'select',
  'from',
  'where',
  'table',
  'order',
  'group',
  'id',
  ...MODEL_VIEWS,
])

export function freeSlug(base: string, taken: (slug: string) => boolean): string {
  let slug = RESERVED.has(base) ? `${base}_table` : base
  for (let n = 2; taken(slug); n++) slug = `${base}_${n}`
  return slug
}

// A field as the DDL sees it.
export function spec(f: Pick<Field, 'id' | 'slug' | 'kind' | 'many' | 'indexed'>): ColumnSpec {
  return { id: f.id, slug: f.slug, kind: f.kind, many: f.many, indexed: f.indexed }
}

export function findField(table: Table, nameOrSlug: string): Field {
  const f = table.fields.find(
    (x) =>
      x.id === nameOrSlug ||
      x.slug === slugify(nameOrSlug) ||
      x.name.toLowerCase() === nameOrSlug.toLowerCase(),
  )
  if (!f)
    throw new Refused(
      `${table.name} has no field called ${nameOrSlug}; it has ${table.fields.map((x) => x.name).join(', ') || 'none yet'}.`,
    )
  return f
}

// A row as a person names it: its first text value.
export function rowName(t: Table, values: Record<string, unknown>): string {
  for (const f of t.fields)
    if (f.kind === 'text' && typeof values[f.slug] === 'string' && values[f.slug])
      return String(values[f.slug])
  return 'a row'
}

export function actorName(a: Actor): string {
  return a.id ? `${a.kind}:${a.id}` : a.kind
}
