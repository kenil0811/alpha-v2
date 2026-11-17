// What a saved list holds, in words, one line each and only the lines it has: its filters in their
// chips' words, its search, sort, group, the columns it hides and its layout when not a table. The
// tip on a saved list says it, so a list is known before it is opened.
import type { FieldView, ViewConfig } from '@alpha/core/api'
import { ruleWords } from './engine.ts'
import { sortWords } from './SortEditor.tsx'

const LAYOUTS: Partial<Record<ViewConfig['kind'], string>> = {
  board: 'Board',
  calendar: 'Calendar',
  timeline: 'Timeline',
  gallery: 'Gallery',
  list: 'List',
  chart: 'Chart',
  form: 'Form',
}
const NAMED = 4 // hidden columns named before "and n more"

export function listWords(config: ViewConfig, fields: FieldView[]): string[] {
  const field = (id: string | null) => fields.find((f) => f.id === id)
  const lines: string[] = []
  const layout = LAYOUTS[config.kind]
  if (layout) {
    const by = field(config.by)
    lines.push(by ? `${layout} by ${by.name}` : layout)
  }
  const rules = config.filters.rules.flatMap((r) => {
    const f = field(r.field)
    return f ? [ruleWords(r, f)] : []
  })
  if (rules.length) lines.push(rules.join(config.filters.match === 'any' ? ', or ' : ', and '))
  if (config.search.trim()) lines.push(`Search: ${config.search.trim()}`)
  const sorts = config.sorts.flatMap((s) => {
    const f = field(s.field)
    if (!f) return []
    const dir = sortWords(f, s.dir)
    // "newest first", but "A to Z" keeps its capitals
    return [`${f.name}, ${dir.endsWith('first') ? dir.toLowerCase() : dir}`]
  })
  if (sorts.length) lines.push(`Sorted by ${sorts.join(', then ')}`)
  const group = field(config.group)
  if (group) lines.push(`Grouped by ${group.name}`)
  const hidden = config.hidden.flatMap((id) => field(id)?.name ?? [])
  if (hidden.length) {
    const named = hidden.slice(0, NAMED).join(', ')
    const more = hidden.length > NAMED ? `, and ${hidden.length - NAMED} more` : ''
    lines.push(`Hides ${hidden.length} column${hidden.length === 1 ? '' : 's'}: ${named}${more}`)
  }
  return lines
}
