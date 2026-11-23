// A row's own page, at #/row/<id>: the record page (RecordPage.tsx), its blocks the parts of the
// row's view, each drawn by RowBody alone (its fields across the top, its note, its files, its tasks,
// each part, what links to it, what Alpha knows). The bar holds the way back to its module and
// table. It comes again whenever the world changes.
import type {
  FieldView,
  ModuleView,
  RowAround,
  RowFileView,
  RowPageView,
  RuleView,
  TasksView,
} from '@alpha/core/api'
import { useEffect, useState } from 'react'
import { api, wordsOf } from './api.ts'
import { PageView } from './PageView.tsx'
import { type Block, Framed, RecordPage } from './RecordPage.tsx'
import { TableName } from './table/context.ts'
import { RowBody } from './table/RowPanel.tsx'
import { show, sourceTip } from './table/values.ts'
import { Refusal } from './ui/act.tsx'
import { cn } from './ui/cn.ts'
import { PageTitle } from './ui/rename.tsx'
import { Waiting } from './ui/waiting.tsx'

export interface RowPlace {
  module: { id: string; name: string }
  table: { id: string; name: string }
  title: string
}

// what is around the row, counted for its blocks
interface Around {
  files: number
  tasks: number
  around: RowAround | null
  rules: RuleView[]
  module: ModuleView | null // for its pages drawn for this row
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
      api.get<ModuleView>(`/api/modules/${moduleId}`).catch(() => null),
    ]).then(([files, tasks, around, rules, module]) =>
      setNear({
        files: files.length,
        tasks: tasks?.lines.length ?? 0,
        around,
        rules: rules.filter((r) => !r.revokedAt),
        module,
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
          }
        : null,
    )
  }, [view, onPlace])
  if (view === undefined) return <Waiting />
  if (view === null) return <p className="p-6 text-ink-2">This row is not there any more.</p>
  // its name is its first text field that holds one (as the core names a row), else the first
  const texts = view.fields.filter((f) => f.kind === 'text' && !f.summary)
  const named = texts.find((f) => view.row.values[f.slug]) ?? texts[0]
  const edit = (f: FieldView, value: unknown, grey?: 'accept' | 'reject') =>
    api.post(`/api/tables/${view.table.id}/rows/${id}`, { field: f.name, value, grey }).then(
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
  // in sentences, never the values again (they are the properties above): where they came from
  // and when, which ones when not all of them, then the rules that hold here
  const froms = new Map<string, string[]>()
  for (const f of known) {
    const s = view.row.sources[f.slug]
    if (s) froms.set(sourceTip(s), [...(froms.get(sourceTip(s)) ?? []), f.name])
  }
  const knows = (all: boolean) => (
    <div className={cn('flex flex-col gap-3', !all && 'max-h-96 overflow-y-auto')}>
      <Framed>
        {[...froms].map(([from, names]) => (
          <p key={from} className="border-hair border-b px-4 py-2.5 text-md text-ink-2">
            {from}:{' '}
            {names.length === known.length
              ? 'every property above that holds a value.'
              : `${names.slice(0, -1).join(', ')}${names.length > 1 ? ' and ' : ''}${names.at(-1)}.`}
          </p>
        ))}
        {near?.rules.map((r) => (
          <p key={r.id} className="border-hair border-b px-4 py-2.5 text-md text-ink-2">
            <span className={r.side === 'deny' ? 'text-bad' : 'text-good'}>
              {r.side === 'deny' ? 'Never' : 'May'}:
            </span>{' '}
            {r.words}{' '}
            <span className="text-ink-3">
              ({r.kind === 'inferred' ? 'Alpha noticed' : 'you said'}, {r.where})
            </span>
          </p>
        ))}
      </Framed>
      {Object.values(view.row.sources).some((s) => s?.open) && part('read')}
    </div>
  )
  // the module's pages drawn for one record of this table: a report on each client
  const mine = near?.module
  const pages: Block[] = mine
    ? mine.pages
        .filter((p) => p.record === view.table.id)
        .map((p) => {
          const drawn = (
            <Framed>
              <PageView m={mine} page={p} version={version} record={id} />
            </Framed>
          )
          return { key: `page:${p.name}`, title: p.title, full: drawn } // its own tab, never on Summary
        })
    : []
  const blocks: Block[] = [
    ...pages,
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
        'Where the values above came from, what Alpha read, and the rules that hold here. A value you doubt: right-click it to clear it, or type your own.',
      count: froms.size + (near?.rules.length ?? 0),
      short: knows(false),
      full: knows(true),
    },
  ]
  return (
    <TableName.Provider value={{ name: view.table.name, id: view.table.id }}>
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
