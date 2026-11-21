// A row's view, drawn in the side panel and, with Open page, as the row's own page: every field
// with its value and mark (a double-click changes it, as the person's word; a right-click says
// where it came from, its history and the rest); its notes; the rows that are part of it (a deal's
// yearly figures) as small tables with New; its tasks; and the documents on it (a deal's CIM),
// which a file dropped on the view joins at once. Its own page also has the rows that link to it,
// the notes that mention it, and the pages and files its values were read from.
import type { FieldView, RowAround, RowFileView, RowView, TasksView } from '@alpha/core/api'
import { FileText, Plus, X } from 'lucide-react'
import { type DragEvent, type KeyboardEvent, type MouseEvent, useEffect, useState } from 'react'
import { api, Problem } from '../api.ts'
import { fileHref } from '../FileView.tsx'
import { useLayout } from '../layout.ts'
import { AddCell, HiddenToggle } from '../RecordFields.tsx'
import { NewTask, TaskList } from '../Tasks.tsx'
import { dayWords } from '../time.ts'
import { Button, IconButton } from '../ui/button.tsx'
import { cn } from '../ui/cn.ts'
import { cutTip } from '../ui/cut-tip.ts'
import { DropZone, dropped } from '../ui/drop-zone.tsx'
import { Select } from '../ui/field.tsx'
import { Popover } from '../ui/popover.tsx'
import { SidePanel } from '../ui/side-panel.tsx'
import { AddRow } from './AddRow.tsx'
import { CellHistory } from './CellHistory.tsx'
import { EditCell } from './EditCell.tsx'
import { ReadLine } from './Mirror.tsx'
import { Notes } from './Notes.tsx'
import { RowMenu } from './RowMenu.tsx'
import { TagChips } from './Tags.tsx'
import { canEdit, EMPTY_WORDS, isTags, MARK, show, sourceTip } from './values.ts'

// The side panel's way in: the row's view, with Open full to its own page.
export function RowPanel({
  title,
  onClose,
  ...rest
}: Parameters<typeof RowBody>[0] & { title: string; onClose: () => void }) {
  return (
    <SidePanel title={title || 'A row'} onClose={onClose} full={`#/row/${rest.row.id}`}>
      <RowBody {...rest} />
    </SidePanel>
  )
}

export function RowBody({
  tableId,
  kinds,
  row,
  fields,
  names,
  onField,
  onEdit,
  page = false,
  only,
  columns = false,
}: {
  // one part of the view, for a block of the record page:
  // its fields, its notes, one part (part:<table id>), what links to it, where it was read from,
  // its tasks or its files
  only?: string | undefined
  columns?: boolean // its fields across the width in columns
  tableId: string
  kinds: string[] | null // the kinds of document the table's rows take
  row: RowView
  fields: FieldView[]
  names: Record<string, string>
  onField: (slug: string) => void
  onEdit?: ((field: FieldView, value: unknown) => Promise<boolean>) | undefined // none: kept elsewhere
  page?: boolean // the row's own page: what links to it and where it was read from too
}) {
  const path = `/api/tables/${tableId}/rows/${row.id}/files`
  const [files, setFiles] = useState<RowFileView[]>([])
  const [tasks, setTasks] = useState<TasksView | null>(null)
  const [around, setAround] = useState<RowAround | null>(null)
  const [adding, setAdding] = useState<RowAround['parts'][number] | null>(null)
  const notes = fields.find((f) => f.kind === 'notes')
  const loadAround = () =>
    api.get<RowAround>(`/api/rows/${row.id}/around`).then(setAround, () => setAround(null))
  const loadTasks = () =>
    api.get<TasksView>(`/api/tasks?row=${row.id}`).then(setTasks, () => setTasks(null))
  const [problem, setProblem] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const shows = (what: string) => !only || only === what
  // the row comes again whenever the world changes: its files are asked again with it
  useEffect(() => {
    if (row.id) api.get<RowFileView[]>(path).then(setFiles, () => setFiles([]))
    if (row.id) void loadAround()
    if (row.id) void loadTasks()
  }, [path, row, tableId])
  const act = (p: Promise<RowFileView[]>) =>
    p.then(
      (f) => {
        setFiles(f)
        setProblem(null)
      },
      (err: unknown) =>
        setProblem(err instanceof Problem ? err.message : 'That did not go through.'),
    )
  const add = (list: File[]) => {
    for (const f of list) act(api.uploadTo(path, f))
  }
  const drop = (e: DragEvent) => {
    e.preventDefault()
    setDragging(false)
    add(dropped(e))
  }
  // the places its values came from, once each
  const places = new Map<string, { url?: string; file?: string; label: string }>()
  for (const s of Object.values(row.sources)) {
    const o = s?.open
    if (!o) continue
    if ('url' in o && URL.canParse(o.url))
      places.set(o.url, { url: o.url, label: new URL(o.url).host })
    if ('file' in o)
      places.set(o.file, {
        file: o.file,
        label: files.find((f) => f.hash === o.file)?.name ?? 'The file it was read from',
      })
  }
  return (
    <>
      {/* biome-ignore lint/a11y/noStaticElementInteractions: a drop target for files; Add a file is the keyboard way */}
      <div
        className="relative"
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={drop}
      >
        {shows('fields') && (
          <>
            <ReadLine row={row} />
            <FieldList
              tableId={tableId}
              fields={fields}
              row={row}
              names={names}
              onField={onField}
              onEdit={onEdit}
              columns={columns}
              hideable={only === 'fields'}
            />
          </>
        )}
        {notes && shows('notes') && (
          <div className="flex flex-col gap-2 border-hair border-b p-4.5">
            {!only && <div className="font-semibold text-ink-3 text-sm">{notes.name}</div>}
            <Notes
              value={
                typeof row.values[notes.slug] === 'string' ? (row.values[notes.slug] as string) : ''
              }
              onSave={onEdit ? (text) => onEdit(notes, text || null) : undefined}
            />
          </div>
        )}
        {around?.parts
          .filter((p) => shows(`part:${p.table.id}`))
          .map((p) => (
            <div key={p.table.id} className="flex flex-col gap-2 border-hair border-b p-4.5">
              <div className="flex items-center justify-between">
                <div className="font-semibold text-ink-3 text-sm">
                  {p.table.name} · {p.count}
                </div>
                {p.count > 0 && (
                  <a
                    href={`#/table/${p.table.id}?of=${row.id}`}
                    className="text-accent text-sm hover:underline"
                  >
                    Open as a table
                  </a>
                )}
              </div>
              {p.rows.length > 0 && <PartTable part={p} />}
              {p.count > p.rows.length && (
                <span className="text-ink-3 text-sm">and {p.count - p.rows.length} more</span>
              )}
              {onEdit && (
                <Button size="sm" variant="ghost" className="w-fit" onClick={() => setAdding(p)}>
                  <Plus className="size-3.25" />
                  New
                </Button>
              )}
            </div>
          ))}
        {page &&
          shows('linked') &&
          around &&
          (around.links.length > 0 || around.mentions.length > 0) && (
            <div className="flex flex-col gap-2 border-hair border-b p-4.5">
              {!only && <div className="font-semibold text-ink-3 text-sm">Linked here</div>}
              {[
                ...around.links.map((l) => ({
                  key: `l${l.table.id}${l.field}`,
                  what: `${l.table.name} · ${l.field}`,
                  rows: l.rows,
                })),
                ...around.mentions.map((m) => ({
                  key: `m${m.table.id}`,
                  what: `Mentioned in ${m.table.name}`,
                  rows: m.rows,
                })),
              ].map((g) => (
                <div key={g.key} className="flex flex-col">
                  <span className="text-ink-3 text-sm">{g.what}</span>
                  {g.rows.slice(0, 12).map((r) => (
                    <a
                      key={r.id}
                      href={`#/row/${r.id}`}
                      className="truncate py-0.5 text-ink text-md hover:underline"
                    >
                      {r.name}
                    </a>
                  ))}
                  {g.rows.length > 12 && (
                    <span className="text-ink-3 text-sm">and {g.rows.length - 12} more</span>
                  )}
                </div>
              ))}
            </div>
          )}
        {page && shows('read') && places.size > 0 && (
          <p className="p-4.5 text-md text-ink-2">
            Alpha read it from{' '}
            {[...places.values()].map((p, i, all) => (
              <span key={p.url ?? p.file}>
                {i > 0 && (i === all.length - 1 ? ' and ' : ', ')}
                <a
                  href={p.url ?? fileHref({ file: p.file as string })}
                  {...(p.url ? { target: '_blank', rel: 'noreferrer' } : {})}
                  className="text-accent hover:underline"
                >
                  {p.label}
                </a>
              </span>
            ))}
            .
          </p>
        )}
        {shows('tasks') && (
          <div className="flex flex-col gap-2 p-4.5">
            <div className="font-semibold text-ink-3 text-sm">
              Tasks
              {tasks?.lines.length
                ? ` · ${tasks.lines.filter((t) => t.state !== 'done' && t.state !== 'dropped').length} open`
                : ''}
            </div>
            {tasks && tasks.lines.length > 0 && (
              <TaskList lines={tasks.lines} onChange={() => void loadTasks()} />
            )}
            <NewTask
              on={{ row: row.id }}
              placeholder="Add a task on this row"
              onAdded={() => void loadTasks()}
            />
          </div>
        )}
        {shows('files') && (
          <div className="flex flex-col gap-2 p-4.5">
            {!only && <div className="font-semibold text-ink-3 text-sm">Documents</div>}
            {/* one drop zone for files: drop on it or click to choose */}
            <DropZone onFiles={add}>
              {files.map((f) => (
                <div
                  key={f.hash}
                  className="flex flex-col gap-1 rounded-md border border-hair px-2.5 py-2"
                >
                  <div className="flex items-center gap-2">
                    <FileText className="size-3.5 shrink-0 text-ink-3" />
                    <button
                      type="button"
                      className="min-w-0 flex-1 truncate text-left text-md text-ink hover:underline"
                      {...cutTip(f.name)}
                      onClick={() => window.location.assign(fileHref({ file: f.hash }))}
                    >
                      {f.name}
                    </button>
                    <IconButton
                      label="Take it off this row"
                      onClick={() =>
                        act(api.post<RowFileView[]>(`${path}/${f.hash}`, { off: true }))
                      }
                    >
                      <X className="size-3.5" />
                    </IconButton>
                  </div>
                  <div className="flex items-center gap-2 text-ink-3 text-sm">
                    {kinds?.length ? (
                      <Select
                        aria-label="What kind of document it is"
                        className="h-6.5 text-sm"
                        value={f.kind ?? ''}
                        onChange={(e) =>
                          act(
                            api.post<RowFileView[]>(`${path}/${f.hash}`, {
                              kind: e.target.value || null,
                            }),
                          )
                        }
                      >
                        <option value="">No kind given</option>
                        {kinds.map((k) => (
                          <option key={k} value={k}>
                            {k}
                          </option>
                        ))}
                      </Select>
                    ) : (
                      f.kind && <span>{f.kind}</span>
                    )}
                    <span className="truncate">
                      {f.by}, {dayWords(f.at)}
                      {f.read === 'reading'
                        ? ' · being read'
                        : f.read === 'kept'
                          ? ' · saved, not read'
                          : ''}
                    </span>
                  </div>
                </div>
              ))}
            </DropZone>
            {problem && <div className="text-bad text-sm">{problem}</div>}
          </div>
        )}
        {dragging && (
          <div className="pointer-events-none absolute inset-2 flex items-center justify-center rounded-xl border border-accent-line border-dashed bg-surface/80 text-ink-2">
            Drop to keep it on this row
          </div>
        )}
      </div>
      {adding && (
        <AddRow
          tableId={adding.table.id}
          name={adding.table.name}
          fields={adding.fields}
          fixed={{ [adding.relation]: row.id }}
          dialog
          onClose={() => {
            setAdding(null)
            void loadAround()
          }}
        />
      )}
    </>
  )
}

// A row's parts as a small table: a column a field, at most four, each row opening its own view.
// A row's parts as a small table: its first three fields, one line a row, long words cut with the
// whole on the tip; Open as a table shows them all.
function PartTable({ part }: { part: RowAround['parts'][number] }) {
  const cols = part.fields.slice(0, 3)
  return (
    <div>
      <table className="w-full table-fixed border-collapse text-md">
        <thead>
          <tr>
            {cols.map((f) => (
              <th
                key={f.id}
                className="border-line border-b py-1 pr-3 text-left font-normal text-ink-3 text-sm"
              >
                {f.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {part.rows.map((r) => (
            <tr key={r.id} className="hover:bg-hover">
              {cols.map((f, i) => (
                <td
                  key={f.id}
                  className="truncate border-hair border-b py-1.5 pr-3"
                  {...cutTip(show(f, r.values[f.slug], part.names))}
                >
                  {i === 0 ? (
                    <a href={`#/row/${r.id}`} className="text-ink hover:underline">
                      {show(f, r.values[f.slug], part.names) || EMPTY_WORDS}
                    </a>
                  ) : (
                    <span className="text-ink-2">{show(f, r.values[f.slug], part.names)}</span>
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// A row's fields, every one: a double-click (or Enter or F2) changes one that can be typed, a
// right-click (or Shift+F10) opens the cell's menu with where it came from. The row's view draws it,
// and a person's page draws their rows of one-row-per-person tables with it.
export function FieldList({
  tableId,
  fields,
  row,
  names,
  onField,
  onEdit,
  columns = false,
  hideable = false,
}: {
  hideable?: boolean // a record page's: right-click hides one, and a + in the next cell adds one
  tableId: string
  fields: FieldView[]
  row: RowView
  names: Record<string, string>
  onField: (slug: string) => void
  onEdit?: ((field: FieldView, value: unknown) => Promise<boolean>) | undefined
  columns?: boolean // across the width in columns (a record page's Summary)
}) {
  const [editing, setEditing] = useState<string | null>(null)
  const [menu, setMenu] = useState<{ field: FieldView; x: number; y: number } | null>(null)
  const [past, setPast] = useState<FieldView | null>(null)
  const { layout, change } = useLayout()
  const [unhidden, setUnhidden] = useState(false)
  const hidden = hideable ? fields.filter((f) => layout.recordHidden.includes(f.id)) : []
  const first = fields[0]
  return (
    <>
      <dl
        className={cn(columns ? 'grid gap-x-6 @3xl:grid-cols-2 @6xl:grid-cols-3' : 'flex flex-col')}
      >
        {fields
          .filter((f) => f.kind !== 'notes' && (unhidden || !hidden.includes(f)))
          .map((f) => {
            const source = row.sources[f.slug]
            const text = show(f, row.values[f.slug], names)
            const editable = !!onEdit && canEdit(f)
            if (editing === f.slug && onEdit)
              return (
                <div
                  key={f.id}
                  className="flex flex-col gap-0.5 border-hair border-b px-4.5 py-2.5"
                >
                  <dt className="text-ink-3 text-sm">{f.name}</dt>
                  <EditCell
                    field={f}
                    value={row.values[f.slug]}
                    onDone={async (v) => {
                      const ok = v === undefined || (await onEdit(f, v))
                      if (ok) setEditing(null)
                      return ok
                    }}
                  />
                </div>
              )
            // a related row's name is a link that opens it beside the page (T4)
            const related =
              f.kind === 'relation'
                ? (Array.isArray(row.values[f.slug])
                    ? (row.values[f.slug] as unknown[])
                    : [row.values[f.slug]]
                  )
                    .filter((id) => id != null && id !== '')
                    .map(String)
                : []
            const props = {
              onDoubleClick: () => editable && setEditing(f.slug),
              onContextMenu: (e: MouseEvent<HTMLElement>) => {
                e.preventDefault()
                setMenu({ field: f, x: e.clientX, y: e.clientY })
              },
              onKeyDown: (e: KeyboardEvent<HTMLElement>) => {
                if (e.target !== e.currentTarget) return
                if ((e.shiftKey && e.key === 'F10') || e.key === 'ContextMenu') {
                  e.preventDefault()
                  const r = e.currentTarget.getBoundingClientRect()
                  setMenu({ field: f, x: r.left + 8, y: r.bottom })
                } else if (editable && (e.key === 'Enter' || e.key === 'F2')) {
                  e.preventDefault()
                  setEditing(f.slug)
                }
              },
              className:
                'flex cursor-default flex-col gap-0.5 border-hair border-b px-4.5 py-2.5 text-left hover:bg-hover',
            }
            const inner = (
              <>
                <dt
                  className="flex items-center gap-2 text-ink-3 text-sm"
                  data-tip={f.about ?? f.summary ?? undefined}
                >
                  {f.name}
                </dt>
                {/* where it came from, in plain words on its hover (Vikas, 20 Nov) */}
                <dd
                  data-tip={source ? sourceTip(source) : undefined}
                  className={cn(
                    'whitespace-pre-wrap break-words text-md',
                    text ? 'text-ink' : 'text-ink-3',
                    source && MARK[source.kind] && 'italic',
                  )}
                >
                  {related.length > 0 ? (
                    related.map((id, i) => (
                      <span key={id}>
                        {i > 0 && ', '}
                        <a href={`#/row/${id}`} className="text-ink hover:underline">
                          {names[id] ?? '…'}
                        </a>
                      </span>
                    ))
                  ) : isTags(f) && text ? (
                    <TagChips field={f} value={row.values[f.slug]} />
                  ) : (
                    text || EMPTY_WORDS
                  )}
                  {text && source && MARK[source.kind] && (
                    <span className="ml-1.5 text-ink-3 text-sm not-italic">
                      {MARK[source.kind]}
                    </span>
                  )}
                </dd>
              </>
            )
            // a field holding links cannot be a button: a link inside a button is never clicked
            return related.length > 0 ? (
              // biome-ignore lint/a11y/noNoninteractiveTabindex: reached by Tab like every field, for F2 and the menu key
              <div key={f.id} tabIndex={0} {...props}>
                {inner}
              </div>
            ) : (
              <button key={f.id} type="button" {...props}>
                {inner}
              </button>
            )
          })}
        {hideable && <AddCell tableId={tableId} />}
      </dl>
      <Popover point={menu && { x: menu.x, y: menu.y }} open={!!menu} onClose={() => setMenu(null)}>
        {menu && (
          <RowMenu
            tableId={tableId}
            row={row}
            field={menu.field}
            names={names}
            readOnly={!onEdit}
            elsewhere={false}
            onDone={() => setMenu(null)}
            onEdit={() => setEditing(menu.field.slug)}
            onClear={() => void onEdit?.(menu.field, null)}
            onSource={() => onField(menu.field.slug)}
            onHistory={() => setPast(menu.field)}
            onHide={
              hideable
                ? () => {
                    const id = menu.field.id
                    const on = layout.recordHidden.includes(id)
                    change({
                      recordHidden: on
                        ? layout.recordHidden.filter((x) => x !== id)
                        : [...layout.recordHidden, id],
                    })
                  }
                : undefined
            }
            hidden={layout.recordHidden.includes(menu.field.id)}
          />
        )}
      </Popover>
      {hidden.length > 0 && (
        <HiddenToggle
          hidden={hidden.length}
          shown={unhidden}
          onShow={() => setUnhidden(!unhidden)}
        />
      )}
      {past && (
        <CellHistory
          tableId={tableId}
          row={row.id}
          field={past}
          rowName={first ? show(first, row.values[first.slug], names) : ''}
          names={names}
          onClose={() => setPast(null)}
        />
      )}
    </>
  )
}
