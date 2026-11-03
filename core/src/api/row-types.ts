// The window's contract for a row on its own (core step 3b) and a table's fields, beside
// types.ts, which re-exports it.
import type { RowView } from './types.ts'

export interface FieldView {
  id: string
  name: string
  slug: string
  kind: string // a summary's is the kind it shows as: a count is a number
  choices: string[]
  tones: Record<string, 'good' | 'warn' | 'bad' | 'accent'> // a choice's colour, where it is a state
  many: boolean // a relation holding a list of rows, or a choice holding several (tags)
  relatesTo?: string | null // a relation's table, whose rows its picker lists
  // a summary (core step 3c): what it is in words; worked out from other rows, never written
  summary: string | null
  about: string | null // one sentence on what it means
  aboutBy: 'kit' | 'alpha' | 'person' | null // whose sentence: the kit's, assumed by Alpha, or yours
}

// A row on its own, for its view in the panel and as a page (core step 3b).
export interface RowPageView {
  table: { id: string; name: string; module: { id: string; name: string } }
  documents: string[] | null
  fields: FieldView[]
  row: RowView
  names: Record<string, string>
  title: string
  // the pages of one row of it, its module's and those of a module whose row links to it (a CRM
  // lead's pages on its DealPilot deal), in order; `on` once its field allows it (pages.ts)
  pages: RowPageTab[]
}
export interface RowPageTab {
  module: string // the page's module, by id
  name: string
  title: string
  input: string
  value: string // the input's value: this row's name, or the linking row's
  place: 'tab' | 'overview'
  on: boolean
  next: { label: string; field: string; value: string } | null // shown while not done
  upload: string | null
}

// What is around a row: its parts, the rows that link to it, the notes that mention it.
export interface RowAround {
  parts: {
    table: { id: string; name: string }
    relation: string // the part's field naming this row
    fields: FieldView[]
    rows: { id: string; values: Record<string, unknown> }[]
  }[]
  links: {
    table: { id: string; name: string }
    field: string
    rows: { id: string; name: string }[]
  }[]
  mentions: { table: { id: string; name: string }; rows: { id: string; name: string }[] }[]
}
