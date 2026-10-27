// A row's own page (core step 3b): the row's view, the same as in the side panel, in the record
// layout, at #/row/<id>. The bar holds the way back to its module and table; the page names its
// table, then the row, then the view. It comes again whenever the world changes.
import type { FieldView, RowPageView } from '@alpha/core/api'
import { useEffect, useState } from 'react'
import { api, wordsOf } from './api.ts'
import { Record } from './Record.tsx'
import { RowBody } from './table/RowPanel.tsx'
import { Refusal } from './ui/act.tsx'

export interface RowPlace {
  module: { id: string; name: string }
  table: { id: string; name: string }
  title: string
}

export function RowPage({
  id,
  version,
  onPlace,
}: {
  id: string
  version: number
  onPlace: (p: RowPlace | null) => void
}) {
  const [view, setView] = useState<RowPageView | null | undefined>(undefined)
  const [problem, setProblem] = useState<string | null>(null)
  useEffect(() => {
    if (version < 0) return
    api.get<RowPageView>(`/api/rows/${id}`).then(setView, () => setView(null))
  }, [id, version])
  useEffect(() => {
    onPlace(view ? { module: view.table.module, table: view.table, title: view.title } : null)
  }, [view, onPlace])
  if (view === undefined) return <p className="p-6 text-ink-3">Loading…</p>
  if (view === null) return <p className="p-6 text-ink-2">This row is not there any more.</p>
  const edit = (f: FieldView, value: unknown) =>
    api.post(`/api/tables/${view.table.id}/rows/${id}`, { field: f.name, value }).then(
      async () => {
        setProblem(null)
        setView(await api.get<RowPageView>(`/api/rows/${id}`))
        return true
      },
      (err: unknown) => {
        setProblem(wordsOf(err))
        return false
      },
    )
  return (
    <Record kind={view.table.name}>
      <h1 className="font-serif text-2xl text-ink">{view.title}</h1>
      <div className="overflow-hidden rounded-lg border border-line bg-surface">
        <RowBody
          tableId={view.table.id}
          kinds={view.documents}
          row={view.row}
          fields={view.fields}
          names={view.names}
          onField={(slug) => {
            const f = view.fields.find((x) => x.slug === slug)
            window.location.hash = `#/table/${view.table.id}/${id}${f ? `?field=${encodeURIComponent(f.name)}` : ''}`
          }}
          onEdit={edit}
        />
      </div>
      <Refusal words={problem} />
    </Record>
  )
}
