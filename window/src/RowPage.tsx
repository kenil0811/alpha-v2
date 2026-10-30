// A row's own page (Vikas, 27 Oct), at #/row/<id>: the whole width, made for the row. On top the
// module's mark, the table it belongs to and the row's title; under it its properties, a line
// each, the empty ones folded away; then at its centre the row's document, open blocks written
// where they stand (table/Blocks.tsx), kept in its notes. Beside it, on a wide window, what is
// around the row: its parts, what links to it, its files and tasks. A property's click opens where
// it came from; a double-click changes it, as everywhere (T4). It comes again whenever the world
// changes.
import type { FieldView, RowAround, RowPageView } from '@alpha/core/api'
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
import { peek } from './Peek.tsx'
import { InBar } from './Shell.tsx'
import { Blocks } from './table/Blocks.tsx'
import { EditCell } from './table/Grid.tsx'
import { opens } from './table/Notes.tsx'
import { RowBody } from './table/RowPanel.tsx'
import { TagChips } from './table/Tags.tsx'
import {
  canChange,
  canType,
  hrefOf,
  isTags,
  KIND_WORDS,
  MARK,
  show,
  whyFixed,
} from './table/values.ts'
import { Refusal } from './ui/act.tsx'
import { Button } from './ui/button.tsx'
import { cn } from './ui/cn.ts'
import { Choice, optionClass, Pill } from './ui/pill.tsx'
import { Section } from './ui/section.tsx'
import { Title } from './ui/title.tsx'
import { tipNow } from './ui/tooltip.tsx'

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
  inside = false,
}: {
  id: string
  version: number
  onPlace: (p: RowPlace | null) => void
  // drawn beside a list (table/views/Cards.tsx): no bar of its own, no banner
  inside?: boolean
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
    <div className="@container h-full overflow-y-auto">
      {!inside && (
        <>
          <InBar>
            <span />
          </InBar>
          <div className="h-28 bg-linear-to-b from-accent-soft to-canvas" />
        </>
      )}
      {/* a page in Notion (Vikas, 27 and 28 Oct): the row's states in a line under its title, its
          properties and then its document as the centre, and what hangs off it (each part a
          short list, links, files, tasks) grouped in the column beside */}
      <div className={cn('mx-auto flex max-w-6xl flex-col pb-16', inside ? 'px-8 pt-6' : 'px-12')}>
        <div
          className={cn(
            'grid place-items-center rounded-xl border border-line bg-surface text-accent shadow-btn',
            inside ? 'size-11' : '-mt-10 size-16',
          )}
        >
          <ModuleIcon name={view.table.module.name} className={inside ? 'size-5' : 'size-8'} />
        </div>
        <a
          href={`#/table/${view.table.id}`}
          className="mt-4 w-fit text-ink-3 text-sm hover:text-accent hover:underline"
        >
          {view.table.module.name === view.table.name
            ? view.table.name
            : `${view.table.module.name} · ${view.table.name}`}
        </a>
        <Title
          title={view.title}
          onRename={titled && canType(titled) ? (t) => edit(titled, t) : undefined}
        />
        <States view={view} onEdit={edit} />
        <Refusal words={problem} />
        <div className="mt-8 grid items-start gap-x-12 gap-y-10 @4xl:grid-cols-[minmax(0,1fr)_20rem]">
          <main className="flex min-w-0 flex-col">
            <Properties view={view} onEdit={edit} onSource={source} skip={titled?.slug} states />
            <hr className="my-8 border-line" />
            {notes ? (
              <Blocks key={id} value={doc} opens={opens} onSave={(md) => edit(notes, md || null)} />
            ) : (
              <div className="flex flex-col items-start gap-2">
                <Button
                  size="sm"
                  variant="soft"
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
          <aside className="flex min-w-0 flex-col gap-10 @4xl:sticky @4xl:top-6">
            <PartSections id={id} />
            <RowBody
              around
              parts={false}
              tableId={view.table.id}
              kinds={view.documents}
              row={view.row}
              fields={view.fields}
              names={view.names}
              onField={() => undefined}
              onEdit={edit}
            />
          </aside>
        </div>
      </div>
    </div>
  )
}

// The row's states in one line under its title: each choice that carries a tone (Stage, Risk,
// Benefit), as the coloured word it is everywhere.
const toned = (f: FieldView) => f.kind === 'choice' && !f.many && Object.keys(f.tones).length > 0
// A double-click on one changes it in the one dropdown, as every value does (Vikas, 30 Oct: Dell's
// Contact and Prior contact showed only here, and nothing changed them).
function States({
  view,
  onEdit,
}: {
  view: RowPageView
  onEdit: (f: FieldView, v: unknown) => Promise<boolean>
}) {
  const [editing, setEditing] = useState<string | null>(null)
  const shown = view.fields.filter((f) => toned(f) && view.row.values[f.slug])
  if (!shown.length) return null
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      {shown.map((f) => {
        const v = String(view.row.values[f.slug])
        return editing === f.slug ? (
          <span key={f.id} className="w-56">
            <EditCell
              field={f}
              value={view.row.values[f.slug]}
              onDone={async (value) => {
                const ok = value === undefined || (await onEdit(f, value))
                if (ok) setEditing(null)
                return ok
              }}
            />
          </span>
        ) : (
          <button
            key={f.id}
            type="button"
            data-tip={`Double-click to change ${f.name}`}
            onDoubleClick={() => setEditing(f.slug)}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === 'F2') && setEditing(f.slug)}
            className="rounded-full"
          >
            <Pill colour={optionClass(f, v)}>
              <span className="font-normal opacity-70">{f.name}</span> {v}
            </Pill>
          </button>
        )
      })}
    </div>
  )
}

// What hangs off the row, a section each: every part a short list, a line a row with its first
// words, its state and a date; a click opens the row's own page.
function PartSections({ id }: { id: string }) {
  const [around, setAround] = useState<RowAround | null>(null)
  useEffect(() => {
    api.get<RowAround>(`/api/rows/${id}/around`).then(setAround, () => setAround(null))
  }, [id])
  const parts = (around?.parts ?? []).filter((p) => p.rows.length)
  if (!parts.length) return null
  return (
    <>
      {parts.map((p) => {
        const head = p.fields.find((f) => f.kind === 'text') ?? p.fields[0]
        const state = p.fields.find(toned)
        const when = p.fields.find((f) => f.kind === 'date')
        return (
          <Section key={p.table.id} title={`${p.table.name} · ${p.rows.length}`}>
            <div className="flex flex-col">
              {p.rows.slice(0, 6).map((r) => {
                const v = state ? String(r.values[state.slug] ?? '') : ''
                return (
                  <a
                    key={r.id}
                    href={`#/row/${r.id}`}
                    className="flex items-center gap-3 border-hair border-b py-2 text-md hover:bg-hover"
                  >
                    <span className="min-w-0 flex-1 truncate text-ink">
                      {(head && show(head, r.values[head.slug], {})) || p.table.name}
                    </span>
                    {state && v && <Choice of={state} value={v} />}
                    {when && (
                      <span className="shrink-0 text-ink-3 text-sm tabular-nums">
                        {show(when, r.values[when.slug], {})}
                      </span>
                    )}
                  </a>
                )
              })}
              {p.rows.length > 6 && (
                <a
                  href={`#/table/${p.table.id}?only=${p.rows.map((r) => r.id).join(',')}`}
                  className="pt-2 text-accent text-sm hover:underline"
                >
                  All {p.rows.length}
                </a>
              )}
            </div>
          </Section>
        )
      })}
    </>
  )
}

// The row's properties, a line each: its icon and name, then its value. The empty ones fold away,
// and past twelve the rest wait behind Show more.
function Properties({
  view,
  onEdit,
  onSource,
  skip,
  states = false,
}: {
  view: RowPageView
  onEdit: (f: FieldView, v: unknown) => Promise<boolean>
  onSource: (f: FieldView) => void
  skip: string | undefined
  states?: boolean // the toned choices are said under the title already
}) {
  const [all, setAll] = useState(false)
  const [empty, setEmpty] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const click = useRef<ReturnType<typeof setTimeout> | null>(null)
  // who and what it hangs off first (its insurer, its people), then the rest in the table's order
  const fields = view.fields
    .filter((f) => f.kind !== 'notes' && f.slug !== skip && !(states && toned(f)))
    .sort((a, b) => Number(b.kind === 'relation') - Number(a.kind === 'relation'))
  const filled = fields.filter((f) => show(f, view.row.values[f.slug], view.names))
  const blank = fields.filter((f) => !filled.includes(f))
  const shown = [...(all ? filled : filled.slice(0, SHOWN)), ...(empty ? blank : [])]
  return (
    <div className="flex flex-col">
      {shown.map((f) => {
        const Icon = f.summary ? Sigma : isTags(f) ? Tags : (ICONS[f.kind] ?? Type)
        const value = view.row.values[f.slug]
        const text = show(f, value, view.names)
        const src = view.row.sources[f.slug]
        const editable = canChange(f)
        return (
          <div
            key={f.id}
            className="group/p grid min-h-8 grid-cols-[10rem_minmax(0,1fr)] items-start gap-3 text-md"
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
                      : whyFixed(f)
                }
                onClick={(e) => {
                  const link = (e.target as HTMLElement).closest<HTMLElement>('[data-href]')
                    ?.dataset.href
                  if (link?.startsWith('#')) return peek(link)
                  if (link)
                    return void window.open(
                      link,
                      link.startsWith('http') ? '_blank' : '_self',
                      'noreferrer',
                    )
                  if (!src) return
                  if (click.current) clearTimeout(click.current)
                  click.current = setTimeout(() => onSource(f), 250)
                }}
                onDoubleClick={(e) => {
                  if (!editable) return void tipNow(e.currentTarget)
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
                ) : f.kind === 'relation' && typeof value === 'string' && text ? (
                  <span
                    data-href={`#/row/${value}`}
                    data-tip={`Open ${text}`}
                    className="cursor-pointer text-accent hover:underline"
                  >
                    {text}
                  </span>
                ) : f.kind !== 'relation' && f.kind !== 'person' && hrefOf(f.kind, text) ? (
                  <span
                    data-href={hrefOf(f.kind, text) ?? undefined}
                    data-tip={`Open ${text}`}
                    className="cursor-pointer break-all text-accent underline"
                  >
                    {text}
                  </span>
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
