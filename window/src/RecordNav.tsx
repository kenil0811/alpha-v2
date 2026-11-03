// A record's own page (Vikas, 3 Nov): under the bar, its path at the left, Module / Table / the
// record as a picker of the table's rows, and its tabs in the middle: Overview, then its pages of
// one row (a deal's phases), each shown once the row's field allows it, and the pages of a module
// whose row links to it (a CRM lead's, on its deal). The module's name is the bar's.
import type { ModuleView, RowPageTab, TableView as TableData } from '@alpha/core/api'
import { ChevronRight } from 'lucide-react'
import { useEffect, useState } from 'react'
import { api } from './api.ts'
import { PageView } from './PageView.tsx'
import type { RowPlace } from './RowPage.tsx'
import { InNav } from './Shell.tsx'
import { titleOf } from './table/values.ts'
import { Refusal, useAct } from './ui/act.tsx'
import { Button } from './ui/button.tsx'
import { DropZone } from './ui/drop-zone.tsx'
import { Select } from './ui/field.tsx'
import { PillSwitch, SwitchPill } from './ui/pill-switch.tsx'

export const tabKey = (p: RowPageTab) => `${p.module}:${p.name}`

export function RecordNav({ at, tab }: { at: RowPlace; tab: string | null }) {
  const [rows, setRows] = useState<{ id: string; title: string }[]>([])
  useEffect(() => {
    api.get<TableData>(`/api/tables/${at.table.id}`).then(
      (t) => setRows(t.rows.map((r) => ({ id: r.id, title: titleOf(t.fields, r) }))),
      () => setRows([]),
    )
  }, [at.table.id])
  const tabs = at.pages.filter((p) => p.on && p.place === 'tab')
  const href = (p: RowPageTab | null) =>
    p
      ? `#/row/${at.id}?${new URLSearchParams({ tab: tabKey(p), [p.input]: p.value })}`
      : `#/row/${at.id}`
  return (
    <InNav>
      <div className="grid w-full grid-cols-[1fr_auto_1fr] items-center gap-3">
        <nav aria-label="Path" className="flex min-w-0 items-center gap-1 text-ink-3 text-sm">
          <a href={`#/module/${at.module.id}`} className="shrink-0 hover:text-accent">
            {at.module.name}
          </a>
          <ChevronRight className="size-3.25 shrink-0" />
          <a href={`#/table/${at.table.id}`} className="shrink-0 hover:text-accent">
            {at.table.name}
          </a>
          <ChevronRight className="size-3.25 shrink-0" />
          {/* the record is a picker: another row of the table, on the same tab */}
          <Select
            aria-label={`Another row of ${at.table.name}`}
            value={at.id}
            onChange={(e) => {
              window.location.hash = `#/row/${e.target.value}`
            }}
            className="h-7 w-56 min-w-0 font-medium text-ink"
          >
            {!rows.some((r) => r.id === at.id) && <option value={at.id}>{at.title}</option>}
            {rows.map((r) => (
              <option key={r.id} value={r.id}>
                {r.title}
              </option>
            ))}
          </Select>
        </nav>
        {tabs.length > 0 ? (
          <PillSwitch label={at.title}>
            <SwitchPill tab={{ key: 'overview', href: href(null), label: 'Overview', sel: !tab }} />
            {tabs.map((p) => (
              <SwitchPill
                key={tabKey(p)}
                tab={{ key: tabKey(p), href: href(p), label: p.title, sel: tab === tabKey(p) }}
              />
            ))}
          </PillSwitch>
        ) : (
          <span />
        )}
        <span />
      </div>
    </InNav>
  )
}

// A tab of the record: its page, opened on the row, with the page's next step and upload under it
export function RecordTab({ at, tab, version }: { at: RowPlace; tab: string; version: number }) {
  const p = at.pages.find((x) => tabKey(x) === tab)
  return p ? (
    <div className="h-full overflow-y-auto">
      <RowPagePart at={at} p={p} version={version} />
    </div>
  ) : (
    <p className="p-7 text-ink-3">That tab is not there.</p>
  )
}

// One page of the row, inline: the page, then its next step (a button setting the row's field)
// and the document it takes (dropped on the row as that kind)
export function RowPagePart({ at, p, version }: { at: RowPlace; p: RowPageTab; version: number }) {
  const [m, setM] = useState<ModuleView | null>(null)
  const { busy, problem, act } = useAct(() => undefined)
  useEffect(() => {
    api.get<ModuleView>(`/api/modules/${p.module}`).then(setM, () => setM(null))
  }, [p.module])
  const page = m?.pages.find((x) => x.name === p.name)
  const given = new URLSearchParams({ [p.input]: p.value }).toString()
  return (
    <div className="flex flex-col gap-3">
      {m && page && <PageView m={m} page={page} version={version} given={given} />}
      <Refusal words={problem} />
      {(p.next || p.upload) && (
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-3 px-8 pb-8">
          {p.upload && (
            <DropZone
              busy={busy}
              onFiles={(files) =>
                act(() =>
                  Promise.all(
                    [...files].map((f) =>
                      api.uploadTo(
                        `/api/tables/${at.table.id}/rows/${at.id}/files`,
                        f,
                        p.upload ?? undefined,
                      ),
                    ),
                  ),
                )
              }
            />
          )}
          {p.next && (
            <div>
              <Button
                variant="primary"
                disabled={busy}
                onClick={() =>
                  act(() =>
                    api.post(`/api/tables/${at.table.id}/rows/${at.id}`, {
                      field: p.next?.field,
                      value: p.next?.value,
                    }),
                  )
                }
              >
                {p.next.label}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
