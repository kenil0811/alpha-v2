// A row's view (core step 3b, Kenil's yes 27 Oct), one view drawn in the side panel and, with Open
// full, as the row's own page: every field with its value and mark, each opening to where it came
// from (a double-click changes it instead, as the person's word); its notes; the rows that are part
// of it (a deal's yearly figures, step 3a) as small tables with New; the rows that link to it and
// the notes that mention it; the pages and files its values were read from; its tasks; and the
// documents on it (a deal's CIM), which a file dropped on the view joins at once.
import type { FieldView, RowAround, RowFileView, RowView, TasksView } from '@alpha/core/api'
import { ExternalLink, FileText, Plus, X } from 'lucide-react'
import { type DragEvent, useEffect, useRef, useState } from 'react'
import { api, Problem } from '../api.ts'
import { fileHref } from '../FileView.tsx'
import { NewTask, TaskList } from '../Tasks.tsx'
import { dayWords } from '../time.ts'
import { Button, IconButton } from '../ui/button.tsx'
import { cn } from '../ui/cn.ts'
import { DropZone, dropped } from '../ui/drop-zone.tsx'
import { Select } from '../ui/field.tsx'
import { SidePanel } from '../ui/side-panel.tsx'
import { AddRow } from './AddRow.tsx'
import { EditCell } from './EditCell.tsx'
import { Notes } from './Notes.tsx'
import { TagChips } from './Tags.tsx'
import { canEdit, EMPTY_WORDS, isTags, KIND_WORDS, MARK, show } from './values.ts'

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
}: {
  tableId: string
  kinds: string[] | null // the kinds of document the table's rows take
  row: RowView
  fields: FieldView[]
  names: Record<string, string>
  onField: (slug: string) => void
  onEdit?: ((field: FieldView, value: unknown) => Promise<boolean>) | undefined // none: kept elsewhere
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
        <FieldList fields={fields} row={row} names={names} onField={onField} onEdit={onEdit} />
        {notes && (
          <div className="flex flex-col gap-2 border-hair border-b p-4.5">
            <div className="font-semibold text-ink-3 text-xs uppercase tracking-label">
              {notes.name}
            </div>
            <Notes
              value={
                typeof row.values[notes.slug] === 'string' ? (row.values[notes.slug] as string) : ''
              }
              onSave={onEdit ? (text) => onEdit(notes, text || null) : undefined}
            />
          </div>
        )}
        {around?.parts.map((p) => (
          <div key={p.table.id} className="flex flex-col gap-2 border-hair border-b p-4.5">
            <div className="flex items-center justify-between">
              <div className="font-semibold text-ink-3 text-xs uppercase tracking-label">
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
        {around && (around.links.length > 0 || around.mentions.length > 0) && (
          <div className="flex flex-col gap-2 border-hair border-b p-4.5">
            <div className="font-semibold text-ink-3 text-xs uppercase tracking-label">
              Linked here
            </div>
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
        {places.size > 0 && (
          <div className="flex flex-col gap-2 p-4.5">
            <div className="font-semibold text-ink-3 text-xs uppercase tracking-label">
              Read from
            </div>
            <div className="flex flex-wrap gap-1.5">
              {[...places.values()].map((p) => (
                <Button
                  key={p.url ?? p.file}
                  size="sm"
                  className="max-w-full"
                  title={p.label}
                  onClick={() =>
                    p.url
                      ? window.open(p.url, '_blank', 'noreferrer')
                      : window.location.assign(fileHref({ file: p.file as string }))
                  }
                >
                  {p.url ? (
                    <ExternalLink className="size-3.25" />
                  ) : (
                    <FileText className="size-3.25" />
                  )}
                  <span className="truncate">{p.label}</span>
                </Button>
              ))}
            </div>
          </div>
        )}
        <div className="flex flex-col gap-2 p-4.5">
          <div className="font-semibold text-ink-3 text-xs uppercase tracking-label">
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
        <div className="flex flex-col gap-2 p-4.5">
          <div className="font-semibold text-ink-3 text-xs uppercase tracking-label">Documents</div>
          {/* one drop zone for files (Batch D, 66.22): drop on it or click to choose */}
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
                    title={f.name}
                    onClick={() => window.location.assign(fileHref({ file: f.hash }))}
                  >
                    {f.name}
                  </button>
                  <IconButton
                    label="Take it off this row"
                    onClick={() => act(api.post<RowFileView[]>(`${path}/${f.hash}`, { off: true }))}
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
                        ? ' · kept, not read'
                        : ''}
                  </span>
                </div>
              </div>
            ))}
          </DropZone>
          {problem && <div className="text-bad text-sm">{problem}</div>}
        </div>
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
                  title={show(f, r.values[f.slug], part.names) || undefined}
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

// A row's fields, each with where it came from; a double-click changes one that can be typed. The
// row's view draws it, and a person's page draws their rows of one-row-per-person tables with it.
export function FieldList({
  fields,
  row,
  names,
  onField,
  onEdit,
}: {
  fields: FieldView[]
  row: RowView
  names: Record<string, string>
  onField: (slug: string) => void
  onEdit?: ((field: FieldView, value: unknown) => Promise<boolean>) | undefined
}) {
  const [editing, setEditing] = useState<string | null>(null)
  // a click waits a moment, so a double-click can change the value instead of opening its source
  const click = useRef<ReturnType<typeof setTimeout> | null>(null)
  return (
    <dl className="flex flex-col">
      {fields
        .filter((f) => f.kind !== 'notes')
        .map((f) => {
          const source = row.sources[f.slug]
          const text = show(f, row.values[f.slug], names)
          const editable = !!onEdit && canEdit(f)
          if (editing === f.slug && onEdit)
            return (
              <div key={f.id} className="flex flex-col gap-0.5 border-hair border-b px-4.5 py-2.5">
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
          return (
            <button
              key={f.id}
              type="button"
              title={
                editable
                  ? 'Click for where it came from; double-click to change it'
                  : 'Where it came from'
              }
              onClick={() => {
                if (!editable) return onField(f.slug)
                if (click.current) clearTimeout(click.current)
                click.current = setTimeout(() => onField(f.slug), 250)
              }}
              onDoubleClick={() => {
                if (!editable) return
                if (click.current) clearTimeout(click.current)
                setEditing(f.slug)
              }}
              className="flex flex-col gap-0.5 border-hair border-b px-4.5 py-2.5 text-left hover:bg-hover"
            >
              <dt
                className="flex items-center gap-2 text-ink-3 text-sm"
                title={f.about ?? f.summary ?? undefined}
              >
                {f.name}
                {source && <span className="text-xs">{KIND_WORDS[source.kind]}</span>}
              </dt>
              <dd
                className={cn(
                  'whitespace-pre-wrap break-words text-md',
                  text ? 'text-ink' : 'text-ink-3',
                  source && MARK[source.kind] && 'italic',
                )}
              >
                {isTags(f) && text ? (
                  <TagChips field={f} value={row.values[f.slug]} />
                ) : (
                  text || EMPTY_WORDS
                )}
                {text && source && MARK[source.kind] && (
                  <span className="ml-1.5 text-ink-3 text-sm not-italic">
                    {MARK[source.kind]} {KIND_WORDS[source.kind]}
                  </span>
                )}
              </dd>
            </button>
          )
        })}
    </dl>
  )
}
