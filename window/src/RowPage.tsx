// A row's own page, at #/row/<id>: the record page (RecordPage.tsx), its blocks the parts of the
// row's view, each drawn by RowBody alone (its fields across the top, its note, its files, its tasks,
// each part, what links to it, what Alpha knows). The bar holds the way back to its module and
// table. It comes again whenever the world changes.
import type {
  FieldView,
  RowAround,
  RowFileView,
  RowPageView,
  RuleView,
  TasksView,
} from '@alpha/core/api'
import { useEffect, useState } from 'react'
import { api, wordsOf } from './api.ts'
import { type Block, Framed, RecordPage } from './RecordPage.tsx'
import { TableName } from './table/context.ts'
import { RowBody } from './table/RowPanel.tsx'
import { KIND_WORDS, show } from './table/values.ts'
import { Refusal } from './ui/act.tsx'
import { cn } from './ui/cn.ts'
import { Pill } from './ui/pill.tsx'
import { PageTitle } from './ui/rename.tsx'
import { Waiting } from './ui/waiting.tsx'

export interface RowPlace {
  module: { id: string; name: string }
  table: { id: string; name: string }
  title: string
  path: string // under the bar's way back: Module / Table
}

// what is around the row, counted for its blocks
interface Around {
  files: number
  tasks: number
  around: RowAround | null
  rules: RuleView[]
}

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
  const [near, setNear] = useState<Around | null>(null)
  useEffect(() => {
    if (version < 0) return
    api.get<RowPageView>(`/api/rows/${id}`).then(setView, () => setView(null))
  }, [id, version])
  const tableId = view?.table.id
  const moduleId = view?.table.module.id
  // ponytail: each block's RowBody asks again for what it draws; one row view from the core
  // (the proposal's Q3) would ask once
  useEffect(() => {
    if (!tableId || !moduleId || version < 0) return
    void Promise.all([
      api.get<RowFileView[]>(`/api/tables/${tableId}/rows/${id}/files`).catch(() => []),
      api.get<TasksView>(`/api/tasks?row=${id}`).catch(() => null),
      api.get<RowAround>(`/api/rows/${id}/around`).catch(() => null),
      api.get<RuleView[]>(`/api/rules?module=${encodeURIComponent(moduleId)}`).catch(() => []),
    ]).then(([files, tasks, around, rules]) =>
      setNear({
        files: files.length,
        tasks: tasks?.lines.length ?? 0,
        around,
        rules: rules.filter((r) => !r.revokedAt),
      }),
    )
  }, [tableId, moduleId, id, version])
  useEffect(() => {
    onPlace(
      view
        ? {
            module: view.table.module,
            table: view.table,
            title: view.title,
            path: `${view.table.module.name} / ${view.table.name}`,
          }
        : null,
    )
  }, [view, onPlace])
  if (view === undefined) return <Waiting />
  if (view === null) return <p className="p-6 text-ink-2">This row is not there any more.</p>
  // its name is its first text field that holds one (as the core names a row), else the first
  const texts = view.fields.filter((f) => f.kind === 'text' && !f.summary)
  const named = texts.find((f) => view.row.values[f.slug]) ?? texts[0]
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
  // one part of the row's view, as a block draws it
  const part = (only: string, columns = false) => (
    <Framed>
      <RowBody
        page
        only={only}
        columns={columns}
        tableId={view.table.id}
        kinds={view.documents}
        row={view.row}
        fields={view.fields}
        names={view.names}
        onField={(slug) => {
          const f = view.fields.find((x) => x.slug === slug)
          window.location.hash = `#/table/${view.table.id}/${id}${f ? `?field=${encodeURIComponent(f.name)}` : ''}`
        }}
        onEdit={edit}
      />
    </Framed>
  )
  const around = near?.around
  const notes = view.fields.find((f) => f.kind === 'notes')
  const linked =
    (around?.links ?? []).reduce((n, l) => n + l.rows.length, 0) +
    (around?.mentions ?? []).reduce((n, m) => n + m.rows.length, 0)
  const known = view.fields.filter((f) => {
    const s = view.row.sources[f.slug]
    return (
      f.kind !== 'notes' &&
      s &&
      s.kind !== 'stated' &&
      s.kind !== 'computed' &&
      show(f, view.row.values[f.slug], view.names)
    )
  })
  // all of it on Summary too, scrolling inside its block (Vikas, 20 Nov: read all 9 there)
  const knows = (all: boolean) => (
    <div className={cn('flex flex-col gap-4', !all && 'max-h-96 overflow-y-auto')}>
      {known.length > 0 && (
        <Framed>
          {known.map((f) => {
            const s = view.row.sources[f.slug]
            return (
              <div key={f.id} className="flex flex-col gap-0.5 border-hair border-b px-4 py-2.5">
                <span className="text-md">
                  <span className="text-ink-3">{f.name}</span>{' '}
                  {show(f, view.row.values[f.slug], view.names)}
                </span>
                <span className="flex gap-3 text-ink-3 text-sm">
                  <span className="min-w-0 flex-1 truncate">
                    {s ? `${KIND_WORDS[s.kind]}: ${s.words}` : ''}
                  </span>
                  <button
                    type="button"
                    className="text-accent hover:underline"
                    onClick={() => void edit(f, view.row.values[f.slug])}
                  >
                    Keep
                  </button>
                  <button
                    type="button"
                    className="hover:text-bad hover:underline"
                    onClick={() => void edit(f, null)}
                  >
                    Forget
                  </button>
                </span>
              </div>
            )
          })}
        </Framed>
      )}
      {!!near?.rules.length && (
        <Framed>
          {near.rules.map((r) => (
            <div key={r.id} className="flex items-start gap-2 border-hair border-b px-4 py-2.5">
              <Pill tone={r.side === 'deny' ? 'bad' : 'good'}>
                {r.side === 'deny' ? 'Never' : 'May'}
              </Pill>
              <span className="min-w-0 flex-1 text-md">
                {r.words}
                <span className="block text-ink-3 text-sm">
                  {r.kind === 'inferred' ? 'Alpha noticed' : 'You said'} · {r.where}
                </span>
              </span>
            </div>
          ))}
        </Framed>
      )}
      {all && part('read')}
    </div>
  )
  const blocks: Block[] = [
    ...(notes ? [{ key: 'notes', title: notes.name, short: part('notes'), wide: true }] : []),
    ...(around?.parts ?? []).map((p) => ({
      key: `part:${p.table.id}`,
      title: p.table.name,
      count: p.count,
      short: part(`part:${p.table.id}`),
      full: part(`part:${p.table.id}`),
    })),
    {
      key: 'files',
      title: 'Files',
      about: 'Drop a file here to keep it on this row; Alpha reads it',
      short: part('files'),
      ...(near?.files ? { count: near.files, full: part('files') } : {}),
    },
    {
      key: 'tasks',
      title: 'Tasks',
      count: near?.tasks ?? 0,
      short: part('tasks'),
      full: part('tasks'),
    },
    {
      key: 'linked',
      title: 'Related',
      about: 'Rows that link to it, and notes that mention it',
      count: linked,
      short: part('linked'),
      full: part('linked'),
    },
    {
      key: 'knows',
      title: 'What Alpha knows',
      about:
        'Values Alpha read, looked up or guessed, with where from: Keep makes one your word, Forget clears it. Then the rules that hold here.',
      count: known.length + (near?.rules.length ?? 0),
      short: knows(false),
      full: knows(true),
    },
  ]
  return (
    <TableName.Provider value={view.table.name}>
      <RecordPage
        scope={view.table.id}
        name={view.title}
        title={
          <PageTitle
            name={view.title}
            className="truncate text-xl"
            rename={
              named
                ? (to) =>
                    api
                      .post(`/api/tables/${view.table.id}/rows/${id}`, {
                        field: named.name,
                        value: to,
                      })
                      .then(async () => setView(await api.get<RowPageView>(`/api/rows/${id}`)))
                : null
            }
          />
        }
        head={<Refusal words={problem} />}
        properties={part('fields', true)}
        blocks={blocks}
      />
    </TableName.Provider>
  )
}
