// A row opened: every field with its value and mark, each opening to where it came from (a
// double-click changes it instead, as the person's word), the rows that are part of it (a deal's
// yearly figures; core step 3a), the
// pages and files its values were read from, and the documents on it (a deal's CIM), which a file
// dropped on the panel joins at once.
import type { FieldView, RowFileView, RowView, TasksView } from '@alpha/core/api'
import { ExternalLink, FileText, Paperclip, X } from 'lucide-react'
import { type DragEvent, useEffect, useRef, useState } from 'react'
import { api, Problem } from '../api.ts'
import { fileHref } from '../FileView.tsx'
import { NewTask, TaskList } from '../Tasks.tsx'
import { dayWords } from '../time.ts'
import { Button, IconButton } from '../ui/button.tsx'
import { cn } from '../ui/cn.ts'
import { Select } from '../ui/field.tsx'
import { SidePanel } from '../ui/side-panel.tsx'
import { EditCell } from './Grid.tsx'
import { CORRECTABLE, EMPTY_WORDS, KIND_WORDS, MARK, show } from './values.ts'

// The rows of a table that are part of this row, as the core serves them.
type Part = {
  table: { id: string; name: string }
  fields: FieldView[]
  rows: { id: string; values: Record<string, unknown> }[]
}

export function RowPanel({
  tableId,
  kinds,
  row,
  fields,
  names,
  title,
  onField,
  onEdit,
  onClose,
}: {
  tableId: string
  kinds: string[] | null // the kinds of document the table's rows take
  row: RowView
  fields: FieldView[]
  names: Record<string, string>
  title: string
  onField: (slug: string) => void
  onEdit?: ((field: FieldView, value: unknown) => Promise<boolean>) | undefined // none: kept elsewhere
  onClose: () => void
}) {
  const [editing, setEditing] = useState<string | null>(null)
  // a click waits a moment, so a double-click can change the value instead of opening its source
  const click = useRef<ReturnType<typeof setTimeout> | null>(null)
  const path = `/api/tables/${tableId}/rows/${row.id}/files`
  const [files, setFiles] = useState<RowFileView[]>([])
  const [tasks, setTasks] = useState<TasksView | null>(null)
  const [parts, setParts] = useState<Part[]>([])
  const loadTasks = () =>
    api.get<TasksView>(`/api/tasks?row=${row.id}`).then(setTasks, () => setTasks(null))
  const [problem, setProblem] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const picker = useRef<HTMLInputElement>(null)
  // the row comes again whenever the world changes: its files are asked again with it
  useEffect(() => {
    if (row.id) api.get<RowFileView[]>(path).then(setFiles, () => setFiles([]))
    if (row.id)
      api
        .get<Part[]>(`/api/tables/${tableId}/rows/${row.id}/parts`)
        .then(setParts, () => setParts([]))
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
  const add = (list: FileList | null) => {
    for (const f of Array.from(list ?? [])) act(api.uploadTo(path, f))
  }
  const drop = (e: DragEvent) => {
    e.preventDefault()
    setDragging(false)
    add(e.dataTransfer.files)
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
    <SidePanel title={title || 'A row'} onClose={onClose}>
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
        <dl className="flex flex-col">
          {fields.map((f) => {
            const source = row.sources[f.slug]
            const text = show(f, row.values[f.slug], names)
            const editable = !!onEdit && CORRECTABLE.has(f.kind)
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
                  title={f.about ?? undefined}
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
                  {text || EMPTY_WORDS}
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
        {parts.map((p) => (
          <div key={p.table.id} className="flex flex-col gap-2 border-hair border-b p-4.5">
            <div className="flex items-center justify-between">
              <div className="font-semibold text-ink-3 text-xs uppercase tracking-label">
                {p.table.name} · {p.rows.length}
              </div>
              {p.rows.length > 0 && (
                <a
                  href={`#/table/${p.table.id}?only=${p.rows.map((r) => r.id).join(',')}`}
                  className="text-accent text-sm hover:underline"
                >
                  Open all
                </a>
              )}
            </div>
            {p.rows.length === 0 ? (
              <div className="text-ink-3 text-sm">None yet.</div>
            ) : (
              <ul className="flex flex-col">
                {p.rows.map((r) => (
                  <li key={r.id} className="border-hair border-t first:border-t-0">
                    <a
                      href={`#/table/${p.table.id}/${r.id}`}
                      className="block truncate py-1.5 text-ink text-md hover:underline"
                    >
                      {p.fields
                        .map((f) => show(f, r.values[f.slug], {}))
                        .filter((w) => w && w !== '–')
                        .join(' · ') || 'A row'}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
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
          <div className="flex items-center justify-between">
            <div className="font-semibold text-ink-3 text-xs uppercase tracking-label">
              Documents
            </div>
            <Button size="sm" variant="ghost" onClick={() => picker.current?.click()}>
              <Paperclip className="size-3.25" />
              Add a file
            </Button>
            <input
              ref={picker}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => {
                add(e.target.files)
                e.target.value = ''
              }}
            />
          </div>
          {files.length === 0 && (
            <div className="text-ink-3 text-sm">
              None yet. Drop a file here to keep it on this row.
            </div>
          )}
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
          {problem && <div className="text-bad text-sm">{problem}</div>}
        </div>
        {dragging && (
          <div className="pointer-events-none absolute inset-2 flex items-center justify-center rounded-xl border border-accent-line border-dashed bg-surface/80 text-ink-2">
            Drop to keep it on this row
          </div>
        )}
      </div>
    </SidePanel>
  )
}
