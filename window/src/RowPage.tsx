// A row's own page (Vikas, 27 Oct), at #/row/<id>: the whole width, made for the row. On top the
// module's mark, the table it belongs to and the row's title; under it its properties, a line
// each, the empty ones folded away; then at its centre the row's document, open blocks written
// where they stand (table/Blocks.tsx), kept in its notes. Beside it, on a wide window, what is
// around the row: its parts, what links to it, its files and tasks. A property's click opens where
// it came from; a double-click changes it, as everywhere (T4). It comes again whenever the world
// changes.
import type { FieldView, RowPageView } from '@alpha/core/api'
import {
  ArrowUpRight,
  AtSign,
  Calendar,
  CircleDot,
  DollarSign,
  FilePlus,
  Hash,
  Link,
  type LucideIcon,
  Sigma,
  Tags,
  Type,
  User,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { api, wordsOf } from './api.ts'
import { ModuleIcon } from './moduleIcon.tsx'
import { InBar } from './Shell.tsx'
import { Blocks } from './table/Blocks.tsx'
import { EditCell } from './table/Grid.tsx'
import { opens } from './table/Notes.tsx'
import { RowBody } from './table/RowPanel.tsx'
import { TagChips } from './table/Tags.tsx'
import { canType, isTags, KIND_WORDS, MARK, show } from './table/values.ts'
import { Refusal } from './ui/act.tsx'
import { Button } from './ui/button.tsx'
import { cn } from './ui/cn.ts'

export interface RowPlace {
  module: { id: string; name: string }
  table: { id: string; name: string }
  title: string
}

const ICONS: Record<string, LucideIcon> = {
  text: Type,
  number: Hash,
  money: DollarSign,
  date: Calendar,
  choice: CircleDot,
  link: Link,
  email: AtSign,
  relation: ArrowUpRight,
  person: User,
}
const SHOWN = 12 // properties shown before Show more

export function RowPage({
  id,
  version,
  onPlace,
}: {
  id: string
  version: number
  onPlace: (p: RowPlace | null) => void
}) {
  const [view, setView] = useState<RowPageView | null | undefined>(undefined)
  const [problem, setProblem] = useState<string | null>(null)
  useEffect(() => {
    if (version < 0) return
    api.get<RowPageView>(`/api/rows/${id}`).then(setView, () => setView(null))
  }, [id, version])
  useEffect(() => {
    onPlace(view ? { module: view.table.module, table: view.table, title: view.title } : null)
  }, [view, onPlace])
  if (view === undefined) return <p className="p-6 text-ink-3">Loading…</p>
  if (view === null) return <p className="p-6 text-ink-2">This row is not there any more.</p>
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
  const source = (f: FieldView) => {
    window.location.hash = `#/table/${view.table.id}/${id}?field=${encodeURIComponent(f.name)}`
  }
  const notes = view.fields.find((f) => f.kind === 'notes')
  const doc =
    notes && typeof view.row.values[notes.slug] === 'string'
      ? (view.row.values[notes.slug] as string)
      : ''
  // the title is the row's first words: a double-click renames it there
  const titled = view.fields.find(
    (f) => f.kind === 'text' && view.row.values[f.slug] === view.title,
  )

  return (
    <div className="h-full overflow-y-auto">
      <InBar>
        <span />
      </InBar>
      <div className="h-28 bg-linear-to-b from-accent-soft to-canvas" />
      <div className="mx-auto grid max-w-6xl gap-12 px-12 pb-16 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <main className="-mt-10 flex min-w-0 flex-col">
          <div className="grid size-16 place-items-center rounded-xl border border-line bg-surface text-accent shadow-btn">
            <ModuleIcon name={view.table.module.name} className="size-8" />
          </div>
          <a
            href={`#/table/${view.table.id}`}
            className="mt-4 w-fit text-ink-3 text-sm hover:text-accent hover:underline"
          >
            {view.table.module.name} · {view.table.name}
          </a>
          <Title
            title={view.title}
            onRename={titled && canType(titled) ? (t) => edit(titled, t) : undefined}
          />
          <Properties view={view} onEdit={edit} onSource={source} skip={titled?.slug} />
          <Refusal words={problem} />
          <hr className="my-6 border-line" />
          {notes ? (
            <Blocks key={id} value={doc} opens={opens} onSave={(md) => edit(notes, md || null)} />
          ) : (
            <div className="flex flex-col items-start gap-2">
              <p className="text-ink-3 text-md">
                {view.table.name} keeps no document on its rows yet; starting one gives every row of{' '}
                {view.table.name} its own.
              </p>
              <Button
                size="sm"
                variant="primary"
                onClick={() =>
                  api
                    .post(`/api/tables/${view.table.id}/fields`, {
                      name: 'Document',
                      kind: 'notes',
                    })
                    .then(
                      async () => setView(await api.get<RowPageView>(`/api/rows/${id}`)),
                      (err: unknown) => setProblem(wordsOf(err)),
                    )
                }
              >
                <FilePlus className="size-3.5" />
                Start a document
              </Button>
            </div>
          )}
        </main>
        <aside className="flex min-w-0 flex-col xl:pt-10">
          <div className="overflow-hidden rounded-lg border border-line bg-surface xl:sticky xl:top-6">
            <RowBody
              around
              tableId={view.table.id}
              kinds={view.documents}
              row={view.row}
              fields={view.fields}
              names={view.names}
              onField={() => undefined}
              onEdit={edit}
            />
          </div>
        </aside>
      </div>
    </div>
  )
}

// The row's title, large; a double-click changes it where it is kept.
function Title({
  title,
  onRename,
}: {
  title: string
  onRename: ((t: string) => Promise<boolean>) | undefined
}) {
  const [typing, setTyping] = useState<string | null>(null)
  if (typing !== null)
    return (
      <input
        // biome-ignore lint/a11y/noAutofocus: a double-click opened it to type in
        autoFocus
        aria-label="Title"
        value={typing}
        onChange={(e) => setTyping(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setTyping(null)
          if (e.key === 'Enter') e.currentTarget.blur()
        }}
        onBlur={async () => {
          const t = typing.trim()
          if (!t || t === title || (await onRename?.(t))) setTyping(null)
        }}
        className="mt-1 w-full bg-transparent font-serif text-2xl text-ink outline-none"
      />
    )
  return (
    <h1
      className="mt-1 font-serif text-2xl text-ink"
      onDoubleClick={() => onRename && setTyping(title)}
      data-tip={onRename ? 'Double-click to rename' : undefined}
    >
      {title}
    </h1>
  )
}

// The row's properties, a line each: its icon and name, then its value. The empty ones fold away,
// and past twelve the rest wait behind Show more.
function Properties({
  view,
  onEdit,
  onSource,
  skip,
}: {
  view: RowPageView
  onEdit: (f: FieldView, v: unknown) => Promise<boolean>
  onSource: (f: FieldView) => void
  skip: string | undefined
}) {
  const [all, setAll] = useState(false)
  const [empty, setEmpty] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const click = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fields = view.fields.filter((f) => f.kind !== 'notes' && f.slug !== skip)
  const filled = fields.filter((f) => show(f, view.row.values[f.slug], view.names))
  const blank = fields.filter((f) => !filled.includes(f))
  const shown = [...(all ? filled : filled.slice(0, SHOWN)), ...(empty ? blank : [])]
  return (
    <div className="mt-5 flex flex-col">
      {shown.map((f) => {
        const Icon = f.summary ? Sigma : isTags(f) ? Tags : (ICONS[f.kind] ?? Type)
        const value = view.row.values[f.slug]
        const text = show(f, value, view.names)
        const src = view.row.sources[f.slug]
        const editable = canType(f)
        return (
          <div
            key={f.id}
            className="group/p grid min-h-8 grid-cols-[12rem_minmax(0,1fr)] items-start gap-3 text-md"
          >
            <span
              className="flex items-center gap-2 py-1.5 text-ink-3"
              data-tip={f.about ?? f.summary ?? undefined}
            >
              <Icon className="size-3.5 shrink-0" />
              <span className="truncate">{f.name}</span>
            </span>
            {editing === f.slug ? (
              <div className="py-0.5">
                <EditCell
                  field={f}
                  value={value}
                  onDone={async (v) => {
                    const ok = v === undefined || (await onEdit(f, v))
                    if (ok) setEditing(null)
                    return ok
                  }}
                />
              </div>
            ) : (
              <button
                type="button"
                data-tip={
                  src
                    ? `${KIND_WORDS[src.kind]}: click for where it came from${editable ? ', double-click to change it' : ''}`
                    : editable
                      ? 'Double-click to change it'
                      : undefined
                }
                onClick={() => {
                  if (!src) return
                  if (click.current) clearTimeout(click.current)
                  click.current = setTimeout(() => onSource(f), 250)
                }}
                onDoubleClick={() => {
                  if (!editable) return
                  if (click.current) clearTimeout(click.current)
                  setEditing(f.slug)
                }}
                className={cn(
                  'min-w-0 rounded-sm px-1.5 py-1.5 text-left hover:bg-hover',
                  text ? 'text-ink' : 'text-ink-3',
                  src && MARK[src.kind] && 'italic',
                )}
              >
                {isTags(f) && text ? (
                  <TagChips field={f} value={value} />
                ) : f.kind === 'link' && text ? (
                  <span className="break-all text-accent">{text}</span>
                ) : (
                  <span className="whitespace-pre-wrap break-words">{text || 'Empty'}</span>
                )}
                {text && src && MARK[src.kind] && (
                  <span className="ml-1.5 text-ink-3 text-sm not-italic">{MARK[src.kind]}</span>
                )}
              </button>
            )}
          </div>
        )
      })}
      <div className="mt-1 flex gap-4 text-ink-3 text-sm">
        {filled.length > SHOWN && (
          <button type="button" onClick={() => setAll(!all)} className="hover:text-ink">
            {all ? 'Show fewer' : `Show ${filled.length - SHOWN} more`}
          </button>
        )}
        {blank.length > 0 && (
          <button type="button" onClick={() => setEmpty(!empty)} className="hover:text-ink">
            {empty ? 'Hide the empty ones' : `${blank.length} empty`}
          </button>
        )}
      </div>
    </div>
  )
}
