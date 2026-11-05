import type { Provenance, ProvenanceInput, ProvenanceKind, Said } from '../kinds.ts'
import type { Table, WriteCtx } from '../shape/index.ts'

export interface RowInput {
  values: Record<string, unknown> // by field name
  provenance: ProvenanceInput // for every value in the row...
  per_field?: Record<string, ProvenanceInput> // ...unless a field has its own
}

export interface ChangeInput {
  id: string
  values: Record<string, unknown>
  provenance: ProvenanceInput
  per_field?: Record<string, ProvenanceInput>
}

export interface RecordOut {
  id: string
  version: number
  values: Record<string, unknown> // by the field's current slug
  provenance: Record<string, Provenance> // by the field's current slug
  createdAt: string
  updatedAt: string
  readAt?: string // when a read last met it (rules D12)
  goneAt?: string // when its source said it was gone; kept, out of the default lists (D8)
}

export interface LandInput {
  key: string // the item's own id at its source: a message id, an event id
  row?: string // or a row already in the table, by its id: what a document says about it
  values: Record<string, unknown> // by field name
  url?: string // the page it was read from, when there is one
  // by field name, the place in a document a value was read from (its file, sheet and cell, or
  // page and line), so the value opens there
  places?: Record<
    string,
    {
      file: string
      sheet?: string
      cell?: string
      page?: number
      line?: number
      box?: [number, number, number, number]
    }
  >
}

export interface LandSource {
  connector: string
  account?: string
  url?: string
}

export interface Landed {
  added: number
  changed: number
  same: number
}

// The values that are there: a null is no value.
export function present(o: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== null && v !== undefined))
}

// Each valued field's provenance: its own row, else the row's.
export function resolve(
  stored: Stored | undefined,
  vals: Record<string, unknown>,
): Record<string, Provenance> {
  const out: Record<string, Provenance> = {}
  if (!stored) return out
  for (const field of Object.keys(vals)) {
    const p = stored.own[field] ?? stored.all
    if (p) out[field] = p
  }
  return out
}

export function sortKeys(o: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(o).sort(([a], [b]) => a.localeCompare(b)))
}

export interface RecordCtx extends WriteCtx {
  said?: Said | null
  // the person's own change in the window (rules A1): the change's one line is the source of what
  // they state in it, in these words when given, and names the card they decided it on
  byHand?: { words?: string; card?: string }
}

// A row of a real table: the columns every table has, then the fields' columns by name.
export interface Row extends Record<string, unknown> {
  id: string
  version: number
  made_by: string
  created_at: string
  updated_at: string
  item_key: string | null
}

export interface ProvRow {
  record_id: string
  field_id: string
  kind: ProvenanceKind
  source: string
  basis: string | null
  at: string
  beside: string | null
}

// Values and provenance of one row, keyed by field id: the shape a version keeps.
export interface Snapshot {
  vals: Record<string, unknown>
  prov: Record<string, Provenance>
}

// How a row's provenance is kept (Kenil, 22 Oct: most rows carry one provenance on every
// field): one row for every field not listed (field id '') and a row per field that differs.
// A field's provenance is its own row, else the row's; only fields holding a value have one.
export interface Stored {
  all: Provenance | null
  own: Record<string, Provenance>
}

export const same = (a: Provenance, b: Provenance) => JSON.stringify(a) === JSON.stringify(b)

// SQLite takes so many bound values in one statement.
export const CHUNK = 500

// Who hears about rows written and removed, in the same transaction: the people they name.
export interface RowWatch {
  rows(table: Table, ids: string[], ctx: WriteCtx): void
  gone(ids: string[]): void
}
