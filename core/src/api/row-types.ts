// The window's contract for a row on its own (core step 3b), beside types.ts, which re-exports it.
import type { FieldView, RowView } from './types.ts'

// A row on its own, for its view in the panel and as a page (core step 3b).
export interface RowPageView {
  table: { id: string; name: string; module: { id: string; name: string } }
  documents: string[] | null
  fields: FieldView[]
  row: RowView
  names: Record<string, string>
  title: string
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
