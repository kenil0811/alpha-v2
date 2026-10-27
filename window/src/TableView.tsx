// A table (design §14; step 10 brings v1's views): its saved views as tabs, a toolbar saying what
// the open view does (find, filters, sorts, group, columns), and the rows as a table or a board.
// Every value opens to where it came from in the source panel on the right, which stays open
// while the person clicks along a row. What the person changes and has not saved stays while they
// open a row and come back, in this browser; a saved view is shared by everyone.
import type {
  FieldView,
  FilterRule,
  KeptTable,
  RowView,
  SavedView,
  TableView as TableData,
  ViewConfig,
} from '@alpha/core/api'
import {
  ArrowDownUp,
  Columns3,
  Copy,
  Download,
  EllipsisVertical,
  Group,
  Plus,
  Search,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { api, Problem } from './api.ts'
import { useLayout } from './layout.ts'
import { AddRow } from './table/AddRow.tsx'
import { Board } from './table/Board.tsx'
import { setGroup, setRule } from './table/edits.ts'
import {
  applyFilters,
  applySearch,
  BLANK,
  columns,
  complete,
  differs,
  GROUPABLE,
  sortRows,
} from './table/engine.ts'
import { AddFieldForm, Grid, type PastePlan } from './table/Grid.tsx'
import { KindPicker } from './table/KindPicker.tsx'
import { type LayoutNow, layoutOf } from './table/layout.ts'
import { PasteBar, TickedBar } from './table/Many.tsx'
import { RowPanel } from './table/RowPanel.tsx'
import { SortEditor } from './table/SortEditor.tsx'
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
import { Select } from './ui/field.tsx'
import { MenuItem, MenuLine, Popover, SubMenu } from './ui/popover.tsx'

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
  kept = null,
}: {
  data: TableData
  row?: string | null
  only?: string[] | null // the rows a page opened: only these, until Show all
  field?: string | null // with row: that value's panel, by the field's name
  quiet?: boolean // the Ask panel is open: the source panel gives way to it
  // a list kept outside the module's tables (people, tasks, agents…), served by the core as a
  // table (UI batch 2, 26 Oct): changed in a cell where the core says it may be, opened on
  // their own page, changed there; why is said when something would be typed or saved. New adds
  // one in the page's own way, when it has one.
  kept?: { open: (row: string) => void; onNew?: () => void } | null
}) {
  const own = (data as Partial<KeptTable>).kept ?? null // what of a kept list changes, and why not
  const why = own?.why ?? ''
  // where a row's change goes: the module table's own rows, or the kept list's
  const rowsAt = own ? `/api/kept/${own.name}/rows` : `/api/tables/${data.id}/rows`
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
    openRow
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
  const [page, setPage] = useState(0)
  const [searching, setSearching] = useState(false)
  const layout = layoutOf(config, setConfig) // frozen and wrapped columns, kept with the list
  // rows to a page, the person's choice, kept by Alpha per person
  const { layout: left, change } = useLayout()
  const size = left.pageSize ?? PAGE
  const resize = (n: number) => {
    change({ pageSize: n })
    setPage(0)
  }
  useEffect(() => setPage(0), [config]) // back to the first page when the view changes
  const [ticked, setTicked] = useState<Set<string>>(new Set())
  const [pasting, setPasting] = useState<PastePlan | null>(null)
  const [opened, setOpened] = useState<string | null>(null)
  // the open tasks on each row, drawn beside its name
  const [taskCounts, setTaskCounts] = useState<Record<string, number>>({})
  useEffect(() => {
    if (kept) return
    api
      .get<Record<string, number>>(`/api/tables/${data.id}/tasks`)
      .then(setTaskCounts, () => setTaskCounts({}))
  }, [data, kept])

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
    if (kept) return setProblem(why)
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
    if (kept && !own?.editable.length) {
      setProblem(why)
      return false
    }
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
    write(() => api.post(`${rowsAt}/${row.id}`, { field: field.name, value }))
  const tickedRows = data.rows.filter((r) => ticked.has(r.id))
  const dateBy = fields.find((f) => f.id === config.by && f.kind === 'date')
  const openRowPanel = (id: string) => {
    if (kept) return kept.open(id)
    setOpened(id)
    setPicked(null)
    setAdding(false)
  }
  // New adds a row, or says why one can't be added here
  const onNew = kept
    ? (kept.onNew ?? why)
    : data.fields.some((f) => CORRECTABLE.has(f.kind))
      ? () => {
          setAdding(true)
          setOpened(null)
          setPicked(null)
        }
      : 'This table has no columns to fill in.'
  const first = data.fields[0]
  const openedRow = opened ? data.rows.find((r) => r.id === opened) : undefined
  const pickedRow = picked ? data.rows.find((r) => r.id === picked.row) : undefined
  const pickedField = picked ? data.fields.find((f) => f.slug === picked.field) : undefined

  // the rows a page at a time, PAGE to a page; a changed view starts again at the first
  const pages = Math.max(1, Math.ceil(rows.length / size))
  const at = Math.min(page, pages - 1)
  const paged = rows.slice(at * size, (at + 1) * size)

  return (
    <div className="flex h-full min-h-0">
      <div className="flex min-w-0 flex-1 flex-col">
        <ViewTabs
          tools={
            <>
              <KindPicker fields={fields} rows={data.rows} config={config} onConfig={setConfig} />
              {searching || config.search ? (
                <label className="flex h-7.5 w-44 min-w-24 shrink items-center gap-1.75 rounded-md border border-line bg-surface px-2.5 text-ink-3 focus-within:border-accent-line">
                  <Search className="size-3.25 shrink-0" />
                  <input
                    // biome-ignore lint/a11y/noAutofocus: opened by a click on Search, to type in
                    autoFocus={searching}
                    value={config.search}
                    onChange={(e) => setConfig({ ...config, search: e.target.value })}
                    onBlur={() => setSearching(false)}
                    onKeyDown={(e) => {
                      if (e.key !== 'Escape') return
                      e.preventDefault()
                      setConfig({ ...config, search: '' })
                      setSearching(false)
                    }}
                    placeholder={`Search ${data.name}`}
                    aria-label={`Search ${data.name}`}
                    title="Escape clears it"
                    className="min-w-0 flex-1 bg-transparent text-ink text-md outline-none placeholder:text-ink-3"
                  />
                </label>
              ) : (
                <button
                  type="button"
                  onClick={() => setSearching(true)}
                  data-tip={`Search ${data.name}`}
                  className="flex h-7.5 items-center gap-1.5 rounded-md border border-line bg-surface px-2.5 text-ink-3 text-md hover:border-accent-line hover:text-ink"
                >
                  <Search className="size-3.25 shrink-0" />
                  Search
                </button>
              )}
              <AddFilter
                fields={fields}
                config={config}
                rows={data.rows}
                names={data.names}
                onConfig={setConfig}
              />
            </>
          }
          right={
            <>
              {config.kind !== 'board' && (
                <ColumnsButton fields={fields} config={config} onConfig={setConfig} />
              )}
              <More
                tableId={data.id}
                fields={fields}
                shown={shown}
                config={config}
                layout={layout}
                adding={!kept}
                onConfig={setConfig}
                onCopy={() =>
                  navigator.clipboard?.writeText(
                    [
                      shown.map((f) => f.name),
                      ...rows.map((r) => shown.map((f) => show(f, r.values[f.slug], data.names))),
                    ]
                      .map((line) => line.map((t) => t.replace(/[\t\n]/g, ' ')).join('\t'))
                      .join('\n'),
                  )
                }
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
          onDefault={(id, on) =>
            act(async () => {
              replace(await api.put<SavedView>(`/api/views/${id}`, { isDefault: on }))
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
        <div className="flex flex-wrap items-center gap-2 px-7 py-2">
          {tickedRows.length > 0 ? (
            <TickedBar
              tableId={data.id}
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
            <Chips
              fields={fields}
              config={config}
              rows={data.rows}
              names={data.names}
              onConfig={setConfig}
            />
          )}
          <span className="text-ink-3 text-sm">
            {rows.length === data.rows.length
              ? `${data.rows.length} row${data.rows.length === 1 ? '' : 's'}`
              : `${rows.length} of ${data.rows.length}`}
          </span>
        </div>
        {config.kind === 'board' && boardBy ? (
          <div className="min-h-0 flex-1 overflow-auto px-7 pb-6">
            <Board data={{ ...data, rows }} by={boardBy} rowsAt={rowsAt} />
          </div>
        ) : config.kind === 'form' ? (
          <FormView
            table={data.name}
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
        ) : config.kind === 'list' ? (
          <ListView
            rows={rows}
            fields={shown}
            group={fields.find((f) => f.id === config.group)}
            names={data.names}
            onOpen={openRowPanel}
          />
        ) : config.kind === 'gallery' ? (
          <GalleryView rows={rows} fields={shown} names={data.names} onOpen={openRowPanel} />
        ) : config.kind === 'calendar' && dateBy ? (
          <CalendarView rows={rows} fields={fields} by={dateBy} onOpen={openRowPanel} />
        ) : config.kind === 'timeline' && dateBy ? (
          <TimelineView rows={rows} fields={fields} by={dateBy} onOpen={openRowPanel} />
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
              rows={paged}
              counted={rows}
              allRows={data.rows}
              fields={fields}
              shown={shown}
              config={config}
              names={data.names}
              tasks={taskCounts}
              picked={picked}
              openRow={openRow ?? null}
              ticked={ticked}
              readOnly={!!kept && !own?.editable.length}
              onPick={(p) => {
                if (kept) return
                setPicked(p)
                setOpened(null)
              }}
              onConfig={setConfig}
              onTick={setTicked}
              onEdit={edit}
              onOpen={openRowPanel}
              onDuplicate={
                kept
                  ? undefined
                  : (r) =>
                      write(() =>
                        api.post(`/api/tables/${data.id}/rows/many`, {
                          add: [
                            {
                              values: Object.fromEntries(
                                data.fields
                                  .filter(
                                    (f) => CORRECTABLE.has(f.kind) && r.values[f.slug] != null,
                                  )
                                  .map((f) => [f.name, r.values[f.slug]]),
                              ),
                            },
                          ],
                        }),
                      )
              }
              onRemove={
                kept
                  ? undefined
                  : (rs) =>
                      write(() =>
                        api.post(`/api/tables/${data.id}/rows/remove`, {
                          rows: rs.map((r) => r.id),
                        }),
                      )
              }
              layout={layout}
              onPaste={setPasting}
            />
            <div className="-mt-4 flex items-center gap-1 px-7 pb-3 text-ink-3 text-sm">
              <span data-tip={typeof onNew === 'string' ? onNew : undefined} className="mr-auto">
                <Button
                  size="sm"
                  disabled={typeof onNew === 'string'}
                  onClick={typeof onNew === 'string' ? undefined : onNew}
                >
                  <Plus className="size-3.5" />
                  New
                </Button>
              </span>
              {rows.length > Math.min(size, ...SIZES) && (
                <>
                  <span className="mr-2 tabular-nums">
                    Showing {at * size + 1} to {at * size + paged.length} of {rows.length}
                  </span>
                  <Select
                    aria-label="Rows to a page"
                    value={String(size)}
                    onChange={(e) => resize(Number(e.target.value))}
                    className="mr-2 h-6 shrink-0 border-transparent bg-transparent px-2 pr-1.5 text-ink-3 text-sm hover:bg-hover hover:text-ink"
                  >
                    {SIZES.map((n) => (
                      <option key={n} value={n}>
                        {n} a page
                      </option>
                    ))}
                  </Select>
                  {(
                    [
                      ['First', 0, at === 0],
                      ['Previous', at - 1, at === 0],
                      ['Next', at + 1, at >= pages - 1],
                      ['Last', pages - 1, at >= pages - 1],
                    ] as const
                  ).map(([label, to, off]) => (
                    <button
                      key={label}
                      type="button"
                      disabled={off}
                      onClick={() => setPage(to)}
                      className="rounded-md px-2 py-1 hover:bg-hover hover:text-ink disabled:opacity-50"
                    >
                      {label}
                    </button>
                  ))}
                </>
              )}
            </div>
          </>
        )}
      </div>
      {adding && (
        <AddRow
          tableId={data.id}
          name={data.name}
          fields={data.fields.filter((f) => CORRECTABLE.has(f.kind))}
          dialog={quiet}
          onClose={() => setAdding(false)}
        />
      )}
      {!adding && !quiet && openedRow && (
        <RowPanel
          tableId={data.id}
          kinds={data.documents}
          row={openedRow}
          fields={shown}
          names={data.names}
          onEdit={kept ? undefined : (f, v) => edit(openedRow, f, v)}
          title={first ? show(first, openedRow.values[first.slug], data.names) : ''}
          onField={(slug) => {
            setPicked({ row: openedRow.id, field: slug })
            setOpened(null)
          }}
          onClose={() => setOpened(null)}
        />
      )}
      {!adding && !quiet && !openedRow && pickedRow && pickedField && (
        <SourcePanel
          tableId={data.id}
          table={data.name}
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

const PAGE = 50
const SIZES = [25, 50, 100, 250]

// The ⋮ menu: export exactly the rows and columns shown, as an Excel or a CSV file.
// The ⋮ menu: the view's sort and group, then downloads of exactly the rows and columns shown.
function More({
  tableId,
  fields,
  shown,
  config,
  layout,
  adding,
  onConfig,
  onExport,
  onCopy,
}: {
  tableId: string
  fields: FieldView[]
  shown: FieldView[]
  config: ViewConfig
  layout: LayoutNow
  adding: boolean // whether a column can be added here
  onConfig: (c: ViewConfig) => void
  onExport: (as: 'csv' | 'xlsx') => void
  onCopy: () => void
}) {
  const [open, setOpen] = useState(false)
  const [add, setAdd] = useState(false)
  const grid = config.kind === 'table' ? undefined : 'Columns are laid out in the table view.'
  const wrapped = shown.length > 0 && shown.every((f) => layout.wrap.includes(f.id))
  const anchor = useRef<HTMLButtonElement>(null)
  const sortedBy = config.sorts
    .map((s) => fields.find((f) => f.id === s.field)?.name)
    .filter(Boolean)
  const grouped = fields.find((f) => f.id === config.group)
  const groupable = fields.filter((f) => GROUPABLE.has(f.kind))
  return (
    <>
      <button
        ref={anchor}
        type="button"
        aria-label="More"
        data-tip="Sort, group, layout, download and more"
        onClick={() => setOpen((o) => !o)}
        className="grid size-7.5 shrink-0 place-items-center rounded-md text-ink-2 hover:bg-hover hover:text-ink"
      >
        <EllipsisVertical className="size-4" />
      </button>
      <Popover anchor={anchor} open={open} onClose={() => setOpen(false)} align="end">
        <SubMenu
          label={
            <>
              <ArrowDownUp className="size-3.5 text-ink-3" />
              Sort
            </>
          }
          hint={sortedBy.length ? sortedBy.join(', ') : 'None'}
        >
          <SortEditor fields={fields} config={config} onConfig={onConfig} />
        </SubMenu>
        <SubMenu
          label={
            <>
              <Group className="size-3.5 text-ink-3" />
              Group
            </>
          }
          hint={grouped?.name ?? 'None'}
          reason={
            config.kind === 'table' || config.kind === 'list'
              ? groupable.length
                ? undefined
                : 'No column here can be grouped by.'
              : 'Groups show in the table and list views.'
          }
        >
          <MenuItem checked={!grouped} onClick={() => onConfig(setGroup(config, null))}>
            No grouping
          </MenuItem>
          <MenuLine />
          {groupable.map((f) => (
            <MenuItem
              key={f.id}
              checked={f.id === config.group}
              onClick={() => onConfig(setGroup(config, f.id))}
            >
              {f.name}
            </MenuItem>
          ))}
        </SubMenu>
        <SubMenu
          label={
            <>
              <Columns3 className="size-3.5 text-ink-3" />
              Layout
            </>
          }
          reason={grid}
        >
          {[1, 2, 3].map((n) => (
            <MenuItem
              key={n}
              checked={layout.frozen === n}
              reason={n > shown.length ? `There are only ${shown.length} columns.` : undefined}
              onClick={() => layout.setFrozen(n)}
            >
              {n === 1 ? 'Freeze the first column' : `Freeze the first ${n} columns`}
            </MenuItem>
          ))}
          <MenuLine />
          <MenuItem
            checked={wrapped}
            onClick={() => layout.setWrap(wrapped ? [] : shown.map((f) => f.id))}
          >
            Wrap text in every column
          </MenuItem>
          <MenuItem
            reason={
              Object.keys(config.widths).length ? undefined : 'The columns are at their own widths.'
            }
            onClick={() => onConfig({ ...config, widths: {} })}
          >
            Reset the column widths
          </MenuItem>
        </SubMenu>
        <MenuItem
          reason={adding ? undefined : 'This table is kept on its own page; add columns there.'}
          onClick={() => {
            setOpen(false)
            setAdd(true)
          }}
        >
          <Plus className="size-3.5 text-ink-3" />
          Add column
        </MenuItem>
        <MenuLine />
        <SubMenu
          label={
            <>
              <Download className="size-3.5 text-ink-3" />
              Download
            </>
          }
        >
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
          <MenuLine />
          <MenuItem
            onClick={() => {
              setOpen(false)
              onCopy()
            }}
          >
            <Copy className="size-3.5 text-ink-3" />
            Copy as a table
          </MenuItem>
        </SubMenu>
      </Popover>
      <Popover anchor={anchor} open={add} onClose={() => setAdd(false)} align="end">
        <AddFieldForm tableId={tableId} title="Add a column" onAdded={() => setAdd(false)} />
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
