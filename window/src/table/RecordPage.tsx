// A record's own page (#/table/<id>/<row>; item 23, 25 Oct): a back link to its table, its fields
// in two columns, the records of the module's other tables that point at it as sections, then its
// sources, tasks and documents. A value clicked opens where it came from beside the page.
import type { ModuleView, RowView, TableView } from '@alpha/core/api'
import { ArrowLeft } from 'lucide-react'
import { useEffect, useState } from 'react'
import { api } from '../api.ts'
import { RowDetail } from './RowDetail.tsx'
import { SourcePanel } from './SourcePanel.tsx'
import { show } from './values.ts'

interface Related {
  table: TableView
  rows: RowView[]
}

// The rows of the module's other tables whose relation fields hold this row.
export function relatedTo(row: string, tables: TableView[]): Related[] {
  return tables
    .map((table) => {
      const links = table.fields.filter((f) => f.kind === 'relation')
      const rows = table.rows.filter((r) =>
        links.some((f) => {
          const v = r.values[f.slug]
          return Array.isArray(v) ? v.includes(row) : v === row
        }),
      )
      return { table, rows }
    })
    .filter((r) => r.rows.length > 0)
}

export function RecordPage({ data, row }: { data: TableView; row: RowView }) {
  const [related, setRelated] = useState<Related[]>([])
  const [picked, setPicked] = useState<string | null>(null)
  // the module's other tables come again whenever this table does (the world changed)
  useEffect(() => {
    let live = true
    api
      .get<ModuleView>(`/api/modules/${data.module.id}`)
      .then((m) =>
        Promise.all(
          m.tables
            .filter((t) => t.id !== data.id)
            .map((t) => api.get<TableView>(`/api/tables/${t.id}`)),
        ),
      )
      .then(
        (tables) => live && setRelated(relatedTo(row.id, tables)),
        () => live && setRelated([]),
      )
    return () => {
      live = false
    }
  }, [data, row.id])
  const first = data.fields[0]
  const title = (first && show(first, row.values[first.slug], data.names)) || 'A record'
  const field = data.fields.find((f) => f.slug === picked)
  return (
    <div className="flex h-full min-h-0">
      <div className="@container min-w-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-page flex-col gap-5 px-8 pt-6 pb-12">
          <a
            href={`#/table/${data.id}`}
            className="flex w-fit items-center gap-1.5 text-ink-3 text-md hover:text-ink"
          >
            <ArrowLeft className="size-3.5" />
            {data.name}
          </a>
          <h1 className="text-2xl text-ink">{title}</h1>
          <RowDetail
            tableId={data.id}
            kinds={data.documents}
            row={row}
            fields={data.fields}
            names={data.names}
            onField={setPicked}
          />
          {related.map(({ table, rows }) => {
            const name = table.fields[0]
            return (
              <section key={table.id} className="flex flex-col gap-2">
                <h2 className="font-medium font-serif text-ink text-xl">
                  {table.name} <span className="text-ink-3 text-md">{rows.length}</span>
                </h2>
                <div className="overflow-hidden rounded-lg border border-line bg-surface">
                  {rows.map((r) => (
                    <a
                      key={r.id}
                      href={`#/table/${table.id}/${r.id}`}
                      className="block border-hair border-t px-4 py-2.5 text-ink first:border-t-0 hover:bg-hover"
                    >
                      {(name && show(name, r.values[name.slug], table.names)) || 'A record'}
                    </a>
                  ))}
                </div>
              </section>
            )
          })}
        </div>
      </div>
      {field && (
        <SourcePanel
          tableId={data.id}
          row={row}
          field={field}
          rowName={title}
          names={data.names}
          onClose={() => setPicked(null)}
        />
      )}
    </div>
  )
}
