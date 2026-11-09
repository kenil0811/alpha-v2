// Lists kept outside a module's tables (people, organizations, tasks, schedules, standing
// permissions) served as tables, so the window draws and edits them like any other (UI batch 2,
// Kenil's yes 26 Oct). Each list's own route file builds its rows and says which fields change in
// a cell and what each change does in its store; nothing here writes.
import { Refused } from '../world/kinds.ts'
import type { FieldView, KeptTable } from './types.ts'

export function keptField(name: string, kind: string, tones: FieldView['tones'] = {}): FieldView {
  return {
    id: name.toLowerCase(),
    name,
    slug: name.toLowerCase(),
    kind,
    choices: Object.keys(tones),
    tones,
    many: false,
    relatesTo: null,
    summary: null,
    about: null,
    aboutBy: null,
  }
}

export function keptTable(
  name: string,
  title: string,
  fields: FieldView[],
  rows: { id: string; values: Record<string, unknown> }[],
  kept: { editable: string[]; why: string; counts?: Record<string, number> },
): KeptTable {
  return {
    id: `kept-${name}`,
    name: title,
    about: null,
    aboutBy: null,
    module: { id: '', name: '' },
    mirror: null,
    managed: null,
    fields,
    documents: null,
    rows: rows.map((r) => ({ ...r, sources: {} })),
    names: {},
    views: [],
    readBy: [],
    kept: { name, ...kept },
  }
}

// One cell's change, as the window sends it: the field by its name and the value typed or picked.
export function keptEdit(
  body: unknown,
  editable: string[],
  why: string,
): { field: string; value: unknown } {
  const b = (body ?? {}) as { field?: unknown; value?: unknown }
  const field = String(b.field ?? '')
  if (!editable.includes(field)) throw new Refused(why)
  return { field, value: b.value }
}
