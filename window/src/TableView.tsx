// A table (design §14; step 10 brings v1's views): its saved views as tabs, a toolbar saying what
// the open view does (find, filters, sorts, group, columns), and the rows as a table or a board.
// Every value opens to where it came from in the source panel on the right, which stays open
// while the person clicks along a row. What the person changes and has not saved stays while they
// open a row and come back, in this browser; a saved view is shared by everyone.
import type {
  FieldView,
  FilterRule,
  RowView,
  SavedView,
  TableView as TableData,
  ViewConfig,
} from '@alpha/core/api'
import { Download, Plus, Search } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { api, Problem } from './api.ts'
import { AddRow } from './table/AddRow.tsx'
import { Board } from './table/Board.tsx'
import { setRule } from './table/edits.ts'
import {
  applyFilters,
  applySearch,
  BLANK,
  columns,
  complete,
  differs,
  sortRows,
} from './table/engine.ts'
import { Grid, type PastePlan } from './table/Grid.tsx'
import { KindPicker } from './table/KindPicker.tsx'
import { PasteBar, TickedBar } from './table/Many.tsx'
import { RecordPage } from './table/RecordPage.tsx'
import { SourcePanel } from './table/SourcePanel.tsx'
import { AddFilter, Chips, ColumnsButton } from './table/Toolbar.tsx'
import { ViewTabs } from './table/ViewTabs.tsx'
import { CORRECTABLE, show } from './table/values.ts'
import { CalendarView } from './table/views/CalendarView.tsx'
import { GalleryView, ListView } from './table/views/Cards.tsx'
import { ChartView } from './table/views/ChartView.tsx'
import { FormView } from './table/views/FormView.tsx'
import { TimelineView } from './table/views/TimelineView.tsx'
import { Button } from './ui/button.tsx'
import { MenuItem, Popover } from './ui/popover.tsx'

interface Working {
  view: string | null
  config: ViewConfig
}

function stored(key: string): Working | null {
  try {
    const s = sessionStorage.getItem(key)
    return s ? (JSON.parse(s) as Working) : null
  } catch {
    return null
  }
}

export function TableView({
  data,
  row: openRow,
  only = null,
  field: openField = null,
  quiet = false,
}: {
  data: TableData
  row?: string | null
  only?: string[] | null // the rows a page opened: only these, until Show all
  field?: string | null // with row: that value's panel, by the field's name
  quiet?: boolean // the Ask panel is open: the source panel gives way to it
}) {
  const key = `alpha.table.${data.id}`
  const [views, setViews] = useState<SavedView[]>(data.views)
  useEffect(() => setViews(data.views), [data.views])
  const [viewId, setViewId] = useState<string | null>(() => {
    const was = stored(key)
    if (was && (was.view === null || data.views.some((v) => v.id === was.view))) return was.view
    return data.views.find((v) => v.isDefault)?.id ?? null
  })
  const saved = complete(views.find((v) => v.id === viewId)?.config ?? BLANK)
  const [config, setConfig] = useState<ViewConfig>(() => {
    const was = stored(key)
    return was && was.view === viewId ? complete(was.config) : saved
  })
  useEffect(() => {
    try {
      sessionStorage.setItem(key, JSON.stringify({ view: viewId, config }))
    } catch {
      // a private window keeps nothing; the view still works
    }
  }, [key, viewId, config])
  const dirty = differs(config, saved)
  const [problem, setProblem] = useState<string | null>(null)
  const [picked, setPicked] = useState<{ row: string; field: string } | null>(
    openRow && openField
      ? {
          row: openRow,
          field:
            data.fields.find((f) => f.name === openField || f.slug === openField)?.slug ??
            data.fields[0]?.slug ??
            '',
        }
      : null,
  )
  const [adding, setAdding] = useState(false)
  const [ticked, setTicked] = useState<Set<string>>(new Set())
  const [pasting, setPasting] = useState<PastePlan | null>(null)
  // the open tasks on each row, drawn beside its name
  const [taskCounts, setTaskCounts] = useState<Record<string, number>>({})
  useEffect(() => {
    api
      .get<Record<string, number>>(`/api/tables/${data.id}/tasks`)
      .then(setTaskCounts, () => setTaskCounts({}))
  }, [data])

  const fields = data.fields
  const shown = columns(fields, config)
  const base = useMemo(
    () => (only ? data.rows.filter((r) => only.includes(r.id)) : data.rows),
    [data.rows, only],
  )
  const rows = useMemo(
    () =>
      sortRows(
        applyFilters(
          applySearch(base, fields, config.search, data.names),
          fields,
          config.filters,
          data.names,
        ),
        fields,
        config.sorts,
        data.names,
      ),
    [base, data.names, fields, config.search, config.filters, config.sorts],
  )
  const choices = fields.filter((f) => f.kind === 'choice' && f.choices.length)
  // a board's columns: the view's group when it is a choice, else Stage, else the first choice
  const boardBy =
    choices.find((f) => f.id === config.group) ??
    choices.find((f) => f.name === 'Stage') ??
    choices[0]

  const act = async (fn: () => Promise<void>) => {
    setProblem(null)
    try {
      await fn()
    } catch (err) {
      setProblem(err instanceof Problem ? err.message : 'That was not saved.')
    }
  }
  const pick = (id: string | null) => {
    setViewId(id)
    setConfig(complete(views.find((v) => v.id === id)?.config ?? BLANK))
    setProblem(null)
  }
  const replace = (v: SavedView) =>
    setViews((vs) =>
      vs.map((x) =>
        x.id === v.id ? v : v.isDefault && x.isDefault ? { ...x, isDefault: false } : x,
      ),
    )
  // what the person changes in the table is their word; a refusal shows in the views' line
  const write = async (fn: () => Promise<unknown>) => {
    setProblem(null)
    try {
      await fn()
      return true
    } catch (err) {
      setProblem(err instanceof Problem ? err.message : 'That was not saved.')
      return false
    }
  }
  const edit = (row: RowView, field: FieldView, value: unknown) =>
    write(() => api.post(`/api/tables/${data.id}/rows/${row.id}`, { field: field.name, value }))
  const tickedRows = data.rows.filter((r) => ticked.has(r.id))
  const dateBy = fields.find((f) => f.id === config.by && f.kind === 'date')
  // a row opens as its own page
  const openRecord = (id: string) => {
    window.location.hash = `#/table/${data.id}/${id}`
  }
  const first = data.fields[0]
  const record = openRow && !openField ? data.rows.find((r) => r.id === openRow) : undefined
  const pickedRow = picked ? data.rows.find((r) => r.id === picked.row) : undefined
  const pickedField = picked ? data.fields.find((f) => f.slug === picked.field) : undefined

  if (record) return <RecordPage data={data} row={record} />
  return (
    <div className="flex h-full min-h-0">
      <div className="flex min-w-0 flex-1 flex-col">
        <ViewTabs
          right={
            <>
              {config.kind !== 'board' && (
                <ColumnsButton fields={fields} config={config} onConfig={setConfig} />
              )}
              <Export
                onExport={(as) =>
                  write(() =>
                    api.download(
                      `/api/tables/${data.id}/export`,
                      { rows: rows.map((r) => r.id), fields: shown.map((f) => f.id), as },
                      `${data.name}.${as}`,
                    ),
                  )
                }
              />
              <KindPicker fields={fields} rows={data.rows} config={config} onConfig={setConfig} />
              <Button size="sm" variant="primary" onClick={() => setAdding(true)}>
                <Plus className="size-3.25" />
                Add a row
              </Button>
            </>
          }
          views={views}
          current={viewId}
          dirty={dirty}
          problem={problem}
          onPick={pick}
          onReset={() => setConfig(saved)}
          onSave={() =>
            act(async () => {
              if (viewId) replace(await api.put<SavedView>(`/api/views/${viewId}`, { config }))
            })
          }
          onSaveAs={(name) =>
            act(async () => {
              const v = await api.post<SavedView>(`/api/tables/${data.id}/views`, {
                name,
                config,
              })
              setViews((vs) => [...vs, v])
              setViewId(v.id)
              setConfig(complete(v.config))
            })
          }
          onRename={(name) =>
            act(async () => {
              if (viewId) replace(await api.put<SavedView>(`/api/views/${viewId}`, { name }))
            })
          }
          onDefault={(on) =>
            act(async () => {
              if (viewId)
                replace(await api.put<SavedView>(`/api/views/${viewId}`, { isDefault: on }))
            })
          }
          onRemove={() =>
            act(async () => {
              if (!viewId) return
              await api.delete(`/api/views/${viewId}`)
              setViews((vs) => vs.filter((v) => v.id !== viewId))
              setViewId(null)
              setConfig(BLANK)
            })
          }
        />
        {only && (
          <div className="flex items-center gap-2 border-line border-b bg-accent-soft px-7 py-2 text-md text-ink-2">
            <span className="flex-1">
              Showing {base.length} of {data.rows.length} rows, the ones a page counted.
            </span>
            <a href={`#/table/${data.id}`} className="font-medium text-accent hover:underline">
              Show all
            </a>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2 px-7 pt-3 pb-3">
          {tickedRows.length > 0 ? (
            <TickedBar
              rows={tickedRows}
              fields={fields}
              onClear={() => setTicked(new Set())}
              onSet={(field, value) =>
                write(() =>
                  api.post(`/api/tables/${data.id}/rows/many`, {
                    set: tickedRows.map((r) => ({ row: r.id, values: { [field.name]: value } })),
                  }),
                )
              }
              onRemove={async () => {
                const ok = await write(() =>
                  api.post(`/api/tables/${data.id}/rows/remove`, {
                    rows: tickedRows.map((r) => r.id),
                  }),
                )
                if (ok) setTicked(new Set())
                return ok
              }}
            />
          ) : (
            <>
              <label className="flex h-7.5 w-46 items-center gap-1.75 rounded-md border border-line bg-surface px-2.5 text-ink-3 focus-within:border-accent-line">
                <Search className="size-3.25 shrink-0" />
                <input
                  value={config.search}
                  onChange={(e) => setConfig({ ...config, search: e.target.value })}
                  placeholder={`Find in ${data.name}`}
                  aria-label={`Find in ${data.name}`}
                  className="min-w-0 flex-1 bg-transparent text-ink text-md outline-none placeholder:text-ink-3"
                />
              </label>
              <Chips
                fields={fields}
                config={config}
                rows={data.rows}
                names={data.names}
                onConfig={setConfig}
              />
              <AddFilter
                fields={fields}
                config={config}
                rows={data.rows}
                names={data.names}
                onConfig={setConfig}
              />
            </>
          )}
          <span className="text-ink-3 text-sm">
            {rows.length === data.rows.length
              ? `${data.rows.length} row${data.rows.length === 1 ? '' : 's'}`
              : `${rows.length} of ${data.rows.length}`}
          </span>
        </div>
        {data.rows.length === 0 ? (
          <p className="px-7 text-ink-3">No rows yet.</p>
        ) : config.kind === 'board' && boardBy ? (
          <div className="min-h-0 flex-1 overflow-auto px-7 pb-6">
            <Board data={{ ...data, rows }} by={boardBy} />
          </div>
        ) : config.kind === 'form' ? (
          <FormView
            rows={rows}
            fields={shown}
            names={data.names}
            onSave={(row, values) =>
              write(() =>
                api.post(
                  `/api/tables/${data.id}/rows/many`,
                  row ? { set: [{ row: row.id, values }] } : { add: [{ values }] },
                ),
              )
            }
          />
        ) : rows.length === 0 ? (
          <p className="px-7 text-ink-3">No rows meet this view’s filters.</p>
        ) : config.kind === 'list' ? (
          <ListView
            rows={rows}
            fields={shown}
            group={fields.find((f) => f.id === config.group)}
            names={data.names}
            onOpen={openRecord}
          />
        ) : config.kind === 'gallery' ? (
          <GalleryView rows={rows} fields={shown} names={data.names} onOpen={openRecord} />
        ) : config.kind === 'calendar' && dateBy ? (
          <CalendarView rows={rows} fields={fields} by={dateBy} onOpen={openRecord} />
        ) : config.kind === 'timeline' && dateBy ? (
          <TimelineView rows={rows} fields={fields} by={dateBy} onOpen={openRecord} />
        ) : config.kind === 'chart' ? (
          <ChartView
            rows={rows}
            group={fields.find((f) => f.id === config.group) ?? (dateBy ? undefined : boardBy)}
            by={dateBy}
            measure={fields.find((f) => f.id === config.measure)}
            names={data.names}
            onBar={(field, key) =>
              setConfig(setRule({ ...config, kind: 'table' }, barRule(field, key)))
            }
          />
        ) : (
          <>
            {pasting && (
              <PasteBar
                plan={pasting}
                onNo={() => setPasting(null)}
                onYes={async () => {
                  const plan = pasting
                  setPasting(null)
                  await write(() =>
                    api.post(`/api/tables/${data.id}/rows/many`, { set: plan.set, add: plan.add }),
                  )
                }}
              />
            )}
            <Grid
              tableId={data.id}
              rows={rows}
              allRows={data.rows}
              fields={fields}
              shown={shown}
              config={config}
              names={data.names}
              tasks={taskCounts}
              picked={picked}
              openRow={openRow ?? null}
              ticked={ticked}
              onPick={setPicked}
              onConfig={setConfig}
              onTick={setTicked}
              onEdit={edit}
              onOpen={openRecord}
              onPaste={setPasting}
            />
          </>
        )}
      </div>
      {adding && !quiet && (
        <AddRow
          tableId={data.id}
          name={data.name}
          fields={data.fields.filter((f) => CORRECTABLE.has(f.kind))}
          onClose={() => setAdding(false)}
        />
      )}
      {!adding && !quiet && pickedRow && pickedField && (
        <SourcePanel
          tableId={data.id}
          row={pickedRow}
          field={pickedField}
          rowName={first ? show(first, pickedRow.values[first.slug], data.names) : ''}
          names={data.names}
          onClose={() => setPicked(null)}
        />
      )}
    </div>
  )
}

// Export: exactly the rows and columns shown, as an Excel or a CSV file.
function Export({ onExport }: { onExport: (as: 'csv' | 'xlsx') => void }) {
  const [open, setOpen] = useState(false)
  const anchor = useRef<HTMLButtonElement>(null)
  return (
    <>
      <button
        ref={anchor}
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex h-7.5 items-center gap-1.5 rounded-md px-2.5 text-ink-2 text-md hover:bg-hover hover:text-ink"
      >
        <Download className="size-3.5" />
        Export
      </button>
      <Popover anchor={anchor} open={open} onClose={() => setOpen(false)} align="end">
        <MenuItem
          onClick={() => {
            setOpen(false)
            onExport('xlsx')
          }}
        >
          Excel, as shown
        </MenuItem>
        <MenuItem
          onClick={() => {
            setOpen(false)
            onExport('csv')
          }}
        >
          CSV, as shown
        </MenuItem>
      </Popover>
    </>
  )
}

// A chart bar's rows as a filter: its choice, its words, its month, or no value.
function barRule(field: FieldView, key: string): FilterRule {
  if (key === '') return { field: field.id, op: 'empty' }
  if (field.kind === 'choice') return { field: field.id, op: 'in', values: [key] }
  if (field.kind === 'date') {
    const [y, m] = key.split('-').map(Number)
    const last = new Date(y ?? 1970, m ?? 1, 0).getDate()
    return { field: field.id, op: 'between', value: `${key}-01`, value2: `${key}-${last}` }
  }
  return { field: field.id, op: 'is', value: key }
}
