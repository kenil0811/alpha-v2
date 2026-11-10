// "Showing n of m rows": said whenever rows are hidden, a saved list's own filters included,
// naming what hides them, with Clear filters. Clearing changes the list, so the toolbar's Save and
// Cancel appear (T1) and Cancel brings the saved list back: no state of its own.
import type { FieldView, ViewConfig } from '@alpha/core/api'

// What hides rows in a list: its filters' fields, by name, once each, then a search.
export function hiding(config: ViewConfig, fields: FieldView[]): string[] {
  const names = config.filters.rules.map(
    (r) => fields.find((f) => f.id === r.field)?.name ?? 'a field no longer here',
  )
  return [...new Set(names), ...(config.search.trim() ? ['a search'] : [])]
}

const and = (words: string[]) =>
  words.length < 2 ? (words[0] ?? '') : `${words.slice(0, -1).join(', ')} and ${words.at(-1)}`

// The line, or none when every row shows. came: rows a page counted, or the parts of the row the
// person came from.
export function showingWords(s: {
  shown: number
  total: number
  hiding: string[]
  came: 'page' | 'row' | null
}): string | null {
  if (s.shown >= s.total && !s.came) return null
  const parts = [
    `Showing ${s.shown} of ${s.total} rows`,
    s.came === 'page' ? 'the ones a page counted' : '',
    s.came === 'row' ? 'the ones part of the row you came from' : '',
    s.hiding.length ? `filtered by ${and(s.hiding)}` : '',
  ].filter(Boolean)
  return `${parts.join(', ')}.`
}

// The list with no filter and no search: what Clear filters makes.
export function cleared(config: ViewConfig): ViewConfig {
  return { ...config, search: '', filters: { ...config.filters, rules: [] } }
}
