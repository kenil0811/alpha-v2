// A row's values' sources: a table's read carries only what a cell draws (a guess's mark, the dot
// of a value kept beside it; the core's `cellSources`), so a row's panel and a value's source panel
// fetch the row's own, once each time the row comes again.
import type { RowPageView, RowView } from '@alpha/core/api'
import { useEffect, useState } from 'react'
import { api } from '../api.ts'

export function useSources(row: RowView): RowView {
  const [got, setGot] = useState<{ row: RowView; sources: RowView['sources'] } | null>(null)
  useEffect(() => {
    let here = true
    api.get<RowPageView>(`/api/rows/${row.id}`).then(
      (p) => here && setGot({ row, sources: p.row.sources }),
      () => undefined,
    )
    return () => {
      here = false
    }
  }, [row])
  return got?.row.id === row.id ? { ...row, sources: { ...row.sources, ...got.sources } } : row
}
