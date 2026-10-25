// A row opened: every field with its value and mark, each opening to where it came from, the
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
import { KIND_WORDS, MARK, show } from './values.ts'

export function RowPanel({
  tableId,
  kinds,
  row,
  fields,
  names,
  title,
  onField,
  onClose,
}: {
  tableId: string
  kinds: string[] | null // the kinds of document the table's rows take
  row: RowView
  fields: FieldView[]
  names: Record<string, string>
  title: string
  onField: (slug: string) => void
  onClose: () => void
}) {
  const path = `/api/tables/${tableId}/rows/${row.id}/files`
  const [files, setFiles] = useState<RowFileView[]>([])
  const [tasks, setTasks] = useState<TasksView | null>(null)
  const loadTasks = () =>
    api.get<TasksView>(`/api/tasks?row=${row.id}`).then(setTasks, () => setTasks(null))
  const [problem, setProblem] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const picker = useRef<HTMLInputElement>(null)
  // the row comes again whenever the world changes: its files are asked again with it
  useEffect(() => {
    if (row.id) api.get<RowFileView[]>(path).then(setFiles, () => setFiles([]))
    if (row.id) void loadTasks()
  }, [path, row])
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
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => onField(f.slug)}
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
                  {text || 'None given'}
                  {source && MARK[source.kind] && (
                    <span className="ml-1 font-bold text-warn text-xs not-italic">
                      {MARK[source.kind]}
                    </span>
                  )}
                </dd>
              </button>
            )
          })}
        </dl>
        {places.size > 0 && (
          <div className="flex flex-col gap-2 p-4.5">
            <div className="font-semibold text-ink-3 text-xs">Read from</div>
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
          <div className="font-semibold text-ink-3 text-xs">
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
            <div className="font-semibold text-ink-3 text-xs">Documents</div>
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
