// in a row's side panel, its module's pages drawn for that row (a
// client's report on the client), as the row's own page shows them as blocks.
import type { ModuleView, RowPageView } from '@alpha/core/api'
import { useEffect, useState } from 'react'
import { api } from './api.ts'
import { PageView } from './PageView.tsx'

export function RecordPages({ row }: { row: string }) {
  const [found, setFound] = useState<{ m: ModuleView; table: string } | null>(null)
  useEffect(() => {
    setFound(null)
    api
      .get<RowPageView>(`/api/rows/${row}`)
      .then(async (v) => ({
        m: await api.get<ModuleView>(`/api/modules/${v.table.module.id}`),
        table: v.table.id,
      }))
      .then(setFound, () => undefined)
  }, [row])
  if (!found) return null
  const { m, table } = found
  return m.pages
    .filter((p) => p.record === table)
    .map((p) => (
      <section key={p.name} className="flex flex-col border-hair border-t pt-3">
        <h3 className="px-4.5 font-semibold text-ink-3 text-sm">{p.title}</h3>
        {/* ponytail: version 0, so the frame does not ask again on a change; pass the world's
            version when the panel has it */}
        <PageView m={m} page={p} version={0} record={row} />
      </section>
    ))
}
