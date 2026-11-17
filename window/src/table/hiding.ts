// "Showing n of m rows": said only when a page or a row sent the person to some of a table's
// rows, with Show all for the rest. A list's own filters and search are said by their chips and
// the count beside them, never by a line of their own.

// The line, or none. came: rows a page counted, or the parts of the row the person came from.
export function showingWords(s: {
  shown: number
  total: number
  came: 'page' | 'row' | null
}): string | null {
  if (!s.came) return null
  return `Showing ${s.shown} of ${s.total} rows, ${
    s.came === 'page' ? 'the ones a page counted' : 'the ones that belong to the row you came from'
  }.`
}
