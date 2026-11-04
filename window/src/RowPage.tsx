// A row's own page (core step 3b): the row's view, the same as in the side panel, in the record
// layout, at #/row/<id>. The bar holds its whole path, its module and table each opening its place;
// under the bar, its module's pill switch, its table chosen, so the way back to any of the module's
// pages is in sight (Vikas, 2–3 Nov). It comes again whenever the world changes.
import type { FieldView, ModuleSummary, RowPageView } from '@alpha/core/api'
import { useEffect, useState } from 'react'
import { api, wordsOf } from './api.ts'
import { screenTabs } from './Module.tsx'
import { Record } from './Record.tsx'
import { TableName } from './table/context.ts'
import { RowBody } from './table/RowPanel.tsx'
import { Refusal } from './ui/act.tsx'
import { useBarSlot } from './ui/bar-slot.tsx'
import { Path } from './ui/path.tsx'
import { PillSwitch } from './ui/pill-switch.tsx'
import { PageTitle } from './ui/rename.tsx'

export interface RowPlace {
  module: { id: string; name: string }
  table: { id: string; name: string }
  title: string
}

export function RowPage({
  id,
  version,
  modules,
  onPlace,
}: {
  id: string
  version: number
  modules?: ModuleSummary[] // for its module's switch under the bar
  onPlace: (p: RowPlace | null) => void
}) {
  const [view, setView] = useState<RowPageView | null | undefined>(undefined)
  const [problem, setProblem] = useState<string | null>(null)
  const bar = useBarSlot()
  useEffect(() => {
    if (version < 0) return
    api.get<RowPageView>(`/api/rows/${id}`).then(setView, () => setView(null))
  }, [id, version])
  useEffect(() => {
    onPlace(view ? { module: view.table.module, table: view.table, title: view.title } : null)
  }, [view, onPlace])
  if (view === undefined) return <p className="p-6 text-ink-3">Loading…</p>
  if (view === null) return <p className="p-6 text-ink-2">This row is not there any more.</p>
  // its name is its first text field that holds one (as the core names a row), else the first
  const texts = view.fields.filter((f) => f.kind === 'text' && !f.summary)
  const named = texts.find((f) => view.row.values[f.slug]) ?? texts[0]
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
  const { module, ...table } = view.table
  // beside the page there is no bar: the line naming its table stays, and no switch
  const m = bar ? modules?.find((x) => x.id === module.id) : undefined
  return (
    <TableName.Provider value={view.table.name}>
      <div className="flex h-full flex-col">
        {m && (
          <div className="flex shrink-0 justify-center border-hair border-b bg-canvas px-6 py-1.5">
            <PillSwitch
              label={m.name}
              tabs={screenTabs(m, modules?.some((x) => x.parent === m.id) ?? false, {
                kind: 'table',
                id: table.id,
              })}
            />
          </div>
        )}
        <div className="min-h-0 flex-1">
          <Record
            kind={bar ? undefined : table.name}
            bar={
              <Path
                parts={[
                  // a module named as its one table is one step
                  ...(module.name === table.name
                    ? []
                    : [{ label: module.name, href: `#/module/${module.id}` }]),
                  { label: table.name, href: `#/table/${table.id}` },
                  { label: view.title },
                ]}
              />
            }
          >
            <PageTitle
              name={view.title}
              className="text-2xl"
              rename={
                named
                  ? (to) =>
                      api
                        .post(`/api/tables/${view.table.id}/rows/${id}`, {
                          field: named.name,
                          value: to,
                        })
                        .then(async () => setView(await api.get<RowPageView>(`/api/rows/${id}`)))
                  : null
              }
            />
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
        </div>
      </div>
    </TableName.Provider>
  )
}
