// A table in its table view, and as a board when it has a choice to group by (design §14: the
// first two of the eight views; Ledger's look). Every value opens to where it came from in the
// source panel on the right, which stays open while the person clicks along a row: its kind,
// why, the page or formula, Correct it, and the value's history.
import type {
  FieldView,
  HistoryView,
  RowView,
  SourceView,
  TableView as TableData,
} from '@alpha/core/api'
import { createColumnHelper, tableFeatures, useTable } from '@tanstack/react-table'
import { ExternalLink, FileText, ListFilter, Plus, Search, X } from 'lucide-react'
import { type FormEvent, useEffect, useMemo, useState } from 'react'
import { api, Problem } from './api.ts'
import { Button } from './ui/button.tsx'
import { cn } from './ui/cn.ts'
import { Field, Select } from './ui/field.tsx'
import { Pill, type Tone } from './ui/pill.tsx'
import { Segmented } from './ui/segmented.tsx'
import { SidePanel } from './ui/side-panel.tsx'

const features = tableFeatures({})
const helper = createColumnHelper<typeof features, RowView>()

const KIND_TONE: Record<SourceView['kind'], Tone> = {
  stated: 'accent',
  looked_up: 'neutral',
  computed: 'neutral',
  estimated: 'warn',
  assumed: 'warn',
}

const KIND_WORDS: Record<SourceView['kind'], string> = {
  stated: 'You said',
  looked_up: 'Looked up',
  estimated: 'Estimated',
  assumed: 'Assumed',
  computed: 'Computed',
}

// A choice that is a state shows as a dot in its colour, with its words.
const DOT: Record<string, string> = {
  good: 'bg-good',
  warn: 'bg-warn',
  bad: 'bg-bad',
  accent: 'bg-accent',
}

// The marks on a value Alpha is not sure of: ≈ estimated, ? assumed.
const MARK: Partial<Record<SourceView['kind'], string>> = { estimated: '≈', assumed: '?' }

const NUMERIC = new Set(['money', 'number'])
// What can be corrected in the panel; a relation, a file or a person is changed by asking Alpha.
const CORRECTABLE = new Set(['text', 'number', 'money', 'date', 'choice', 'email', 'link', 'phone'])

const when = (at: string) =>
  new Date(at).toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })

function show(field: FieldView, value: unknown, names: Record<string, string> = {}): string {
  if (value === null || value === undefined) return ''
  if (field.kind === 'relation')
    return (Array.isArray(value) ? value : [value]).map((id) => names[String(id)] ?? '…').join(', ')
  if (field.kind === 'money' && typeof value === 'object') {
    const m = value as { amount: number; currency: string }
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: m.currency,
      currencyDisplay: 'narrowSymbol',
      ...(Number.isInteger(m.amount) ? { maximumFractionDigits: 0 } : {}),
    }).format(m.amount)
  }
  if (field.kind === 'date' && typeof value === 'string' && !Number.isNaN(Date.parse(value)))
    return new Date(value).toLocaleString(undefined, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      // a date with its time shows the time, in the person's own zone
      ...(/T\d{2}:\d{2}/.test(value) ? { hour: '2-digit', minute: '2-digit' } : {}),
    })
  if (Array.isArray(value)) return value.join(', ')
  return String(value)
}

export function TableView({
  data,
  row: openRow,
  quiet = false,
}: {
  data: TableData
  row?: string | null
  quiet?: boolean // the Ask panel is open: the source panel gives way to it
}) {
  const [picked, setPicked] = useState<{ row: string; field: string } | null>(
    openRow ? { row: openRow, field: data.fields[0]?.slug ?? '' } : null,
  )
  const [words, setWords] = useState('')
  // filters: a choice field set to one of its choices, each a chip with ×
  const [filters, setFilters] = useState<{ field: string; value: string }[]>([])
  const [adding, setAdding] = useState(false)
  // the board groups by Stage when there is one, else by the first choice
  const groupBy =
    data.fields.find((f) => f.kind === 'choice' && f.name === 'Stage') ??
    data.fields.find((f) => f.kind === 'choice')
  const [view, setView] = useState<'table' | 'board'>('table')
  useEffect(() => {
    if (openRow) document.getElementById(`row-${openRow}`)?.scrollIntoView({ block: 'center' })
  }, [openRow])

  const w = words.trim().toLowerCase()
  const rows = useMemo(
    () =>
      data.rows
        .filter(
          (r) =>
            !w ||
            data.fields.some((f) =>
              show(f, r.values[f.slug], data.names).toLowerCase().includes(w),
            ),
        )
        .filter((r) =>
          filters.every((fl) => {
            const f = data.fields.find((x) => x.name === fl.field)
            return f && r.values[f.slug] === fl.value
          }),
        ),
    [data, w, filters],
  )
  const choiceFields = data.fields.filter((f) => f.kind === 'choice' && f.choices.length)
  const first = data.fields[0]?.slug
  const columns = useMemo(
    () =>
      helper.columns(
        data.fields.map((f) =>
          helper.display({
            id: f.slug,
            header: () => f.name,
            cell: ({ row }) => {
              const r = row.original
              const value = r.values[f.slug]
              const source = r.sources[f.slug]
              const text = show(f, value, data.names)
              const mark = source ? MARK[source.kind] : undefined
              const empty = value === null || value === undefined || text === ''
              const sel = picked?.row === r.id && picked.field === f.slug
              return (
                <button
                  type="button"
                  onClick={() => setPicked({ row: r.id, field: f.slug })}
                  className={cn(
                    'group flex h-9.5 w-full items-center gap-0.75 px-2.5 text-left tabular-nums',
                    NUMERIC.has(f.kind) && 'justify-end',
                    sel && 'bg-accent-soft ring-2 ring-accent ring-inset',
                  )}
                >
                  {empty ? (
                    NUMERIC.has(f.kind) ? (
                      <span className="text-ink-3">None given</span>
                    ) : null
                  ) : f.kind === 'choice' && f.tones[text] ? (
                    <span className="inline-flex items-center gap-1.5">
                      <span className={cn('size-1.75 rounded-full', DOT[f.tones[text]])} />
                      {text}
                    </span>
                  ) : f.kind === 'choice' ? (
                    <Pill>{text}</Pill>
                  ) : (
                    <span
                      className={cn(
                        'truncate decoration-dotted decoration-ink-3 underline-offset-3 group-hover:underline',
                        f.slug === first ? 'max-w-58 font-medium' : 'max-w-64',
                        mark && 'text-ink-2 italic',
                      )}
                      title={text.length > 40 ? text : undefined}
                    >
                      {text}
                    </span>
                  )}
                  {mark && !empty && (
                    <span className="self-start pt-2 font-bold text-warn text-xs leading-none">
                      {mark}
                    </span>
                  )}
                </button>
              )
            },
          }),
        ),
      ),
    [data.fields, data.names, picked, first],
  )
  const table = useTable({ features, columns, data: rows })
  const pickedRow = picked ? data.rows.find((r) => r.id === picked.row) : undefined
  const pickedField = picked ? data.fields.find((f) => f.slug === picked.field) : undefined

  return (
    <div className="flex h-full min-h-0">
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex flex-wrap items-center gap-2 px-7 pt-3.5 pb-3">
          <label className="flex h-7.5 w-46 items-center gap-1.75 rounded-md border border-line bg-surface px-2.5 text-ink-3 focus-within:border-accent-line">
            <Search className="size-3.25 shrink-0" />
            <input
              value={words}
              onChange={(e) => setWords(e.target.value)}
              placeholder={`Find in ${data.name}`}
              aria-label={`Find in ${data.name}`}
              className="min-w-0 flex-1 bg-transparent text-ink text-md outline-none placeholder:text-ink-3"
            />
          </label>
          {filters.map((fl) => (
            <span
              key={`${fl.field}${fl.value}`}
              className="inline-flex h-7.5 items-center gap-1 rounded-md border border-accent-line bg-accent-soft pr-1 pl-2.5 text-accent text-md"
            >
              {fl.field}: {fl.value}
              <button
                type="button"
                aria-label={`Remove the filter ${fl.field}: ${fl.value}`}
                onClick={() => setFilters((fs) => fs.filter((x) => x !== fl))}
                className="grid size-5 place-items-center rounded-sm hover:bg-accent-line/40"
              >
                <X className="size-3.25" />
              </button>
            </span>
          ))}
          {choiceFields.length > 0 && (
            <FilterButton
              fields={choiceFields}
              onPick={(field, value) =>
                setFilters((fs) => [...fs.filter((x) => x.field !== field), { field, value }])
              }
            />
          )}
          <span className="text-ink-3 text-sm">
            {rows.length === data.rows.length
              ? `${data.rows.length} row${data.rows.length === 1 ? '' : 's'}`
              : `${rows.length} of ${data.rows.length}`}
          </span>
          <span className="flex-1" />
          {groupBy && (
            <Segmented
              label="View"
              value={view}
              onChange={setView}
              options={[
                { value: 'table', label: 'Table' },
                { value: 'board', label: 'Board' },
              ]}
            />
          )}
          <Button size="sm" variant="primary" onClick={() => setAdding(true)}>
            <Plus className="size-3.25" />
            Add a row
          </Button>
        </div>
        {data.rows.length === 0 ? (
          <p className="px-7 text-ink-3">No rows yet.</p>
        ) : view === 'board' && groupBy ? (
          <div className="min-h-0 flex-1 overflow-auto px-7 pb-6">
            <Board data={{ ...data, rows }} by={groupBy} />
          </div>
        ) : (
          <div className="mx-7 mb-6 min-h-0 flex-1 overflow-auto rounded-lg border border-line bg-surface">
            <table className="w-max min-w-full border-separate border-spacing-0 text-md">
              <thead>
                {table.getHeaderGroups().map((g) => (
                  <tr key={g.id}>
                    {g.headers.map((h, i) => {
                      const f = data.fields[i]
                      return (
                        <th
                          key={h.id}
                          className={cn(
                            'sticky top-0 z-10 h-9 whitespace-nowrap border-line border-b bg-surface px-2.5 font-medium text-ink-3 text-sm',
                            f && NUMERIC.has(f.kind) ? 'text-right' : 'text-left',
                            i === 0 && 'left-0 z-20 shadow-[inset_-1px_0_0_var(--hair)]',
                          )}
                        >
                          {h.isPlaceholder ? null : <table.FlexRender header={h} />}
                        </th>
                      )
                    })}
                  </tr>
                ))}
              </thead>
              <tbody>
                {table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    id={`row-${row.original.id}`}
                    className={cn(
                      'group/row',
                      row.original.id === openRow && '[&>td]:bg-accent-soft',
                    )}
                  >
                    {row.getAllCells().map((cell, i) => (
                      <td
                        key={cell.id}
                        className={cn(
                          'whitespace-nowrap border-hair border-b bg-surface p-0 group-last/row:border-b-0 group-hover/row:bg-hover',
                          i === 0 && 'sticky left-0 z-1 shadow-[inset_-1px_0_0_var(--hair)]',
                        )}
                      >
                        <table.FlexRender cell={cell} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
          rowName={
            first ? show(data.fields[0] as FieldView, pickedRow.values[first], data.names) : ''
          }
          names={data.names}
          onClose={() => setPicked(null)}
        />
      )}
    </div>
  )
}

// The board: a column per choice, each row a card with its name and a few of its values, moved
// by setting its choice (the person's own word).
function Board({ data, by }: { data: TableData; by: FieldView }) {
  const [busy, setBusy] = useState<string | null>(null)
  const name = data.fields.find((f) => f.kind === 'text')
  // on a card: up to two amounts, then up to two other choices, each only when it has a value
  const others = data.fields.filter((f) => f !== name && f !== by)
  const cardFields = (r: RowView) => [
    ...others.filter((f) => f.kind === 'money' && r.values[f.slug] != null).slice(0, 2),
    ...others.filter((f) => f.kind === 'choice' && r.values[f.slug] != null).slice(0, 2),
  ]
  const move = async (row: string, value: string) => {
    setBusy(row)
    await api
      .post(`/api/tables/${data.id}/rows/${row}`, { field: by.name, value })
      .catch(() => undefined)
    setBusy(null)
  }
  const columns = [...by.choices, '']
  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {columns.map((choice) => {
        const rows = data.rows.filter((r) => (r.values[by.slug] ?? '') === choice)
        if (choice === '' && rows.length === 0) return null
        return (
          <div key={choice || 'none'} className="flex w-56 shrink-0 flex-col gap-2">
            <div className="flex justify-between px-1 text-sm text-ink-2">
              <span>{choice || `No ${by.name.toLowerCase()}`}</span>
              <span className="text-ink-3">{rows.length}</span>
            </div>
            {rows.map((r) => (
              <div
                key={r.id}
                id={`row-${r.id}`}
                className="flex flex-col gap-1 rounded-lg border border-line px-3 py-2 text-base"
              >
                <div className="text-ink">
                  {name ? show(name, r.values[name.slug]) || 'Untitled' : 'Untitled'}
                </div>
                {cardFields(r).map((f) => {
                  const v = show(f, r.values[f.slug], data.names)
                  return v ? (
                    <div key={f.id} className="text-sm text-ink-2">
                      {f.name}: {v}
                    </div>
                  ) : null
                })}
                <Select
                  className="mt-1 h-6.5 text-sm"
                  value={choice}
                  disabled={busy === r.id}
                  aria-label={`Move to another ${by.name.toLowerCase()}`}
                  onChange={(e) => move(r.id, e.target.value)}
                >
                  {choice === '' && <option value="">Move to…</option>}
                  {by.choices.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </Select>
              </div>
            ))}
          </div>
        )
      })}
    </div>
  )
}

// The source panel: one value, where it came from, and its history; Correct it makes the value
// the person's own word.
function SourcePanel({
  tableId,
  row,
  field,
  rowName,
  names,
  onClose,
}: {
  tableId: string
  row: RowView
  field: FieldView
  rowName: string
  names: Record<string, string>
  onClose: () => void
}) {
  const value = row.values[field.slug]
  const source = row.sources[field.slug]
  const text = show(field, value, names)
  const [history, setHistory] = useState<HistoryView[]>([])
  const [correcting, setCorrecting] = useState(false)
  useEffect(() => {
    setCorrecting(false)
    api
      .get<HistoryView[]>(`/api/tables/${tableId}/rows/${row.id}/history?field=${field.slug}`)
      .then(setHistory, () => setHistory([]))
  }, [tableId, row.id, field.slug, row.values[field.slug]])
  const open = source?.open
  return (
    <SidePanel title={field.name} onClose={onClose}>
      <div className="flex flex-col gap-3.5 p-4.5">
        <div>
          <div
            className={cn(
              'flex items-start gap-1 font-medium font-serif text-ink tabular-nums',
              text.length > 18 ? 'text-xl' : 'text-2xl',
            )}
          >
            <span className="min-w-0 break-words">{text || 'None given'}</span>
            {source && MARK[source.kind] && (
              <span className="pt-1 font-bold font-sans text-sm text-warn">
                {MARK[source.kind]}
              </span>
            )}
          </div>
          {rowName && <div className="mt-1 truncate text-ink-3 text-sm">{rowName}</div>}
        </div>
        {source ? (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <Pill tone={KIND_TONE[source.kind]}>{KIND_WORDS[source.kind]}</Pill>
              <span className="text-ink-3 text-sm">{when(source.at)}</span>
            </div>
            <p className="text-ink text-md leading-relaxed">{source.words}</p>
            {source.note && (
              <div className="whitespace-pre-wrap rounded-md bg-sunk px-3 py-2.5 font-mono text-ink text-sm tabular-nums leading-relaxed">
                {source.note}
              </div>
            )}
          </>
        ) : (
          <p className="text-ink-3 text-md">Nothing is kept here yet.</p>
        )}
        <div className="flex flex-wrap gap-1.5">
          {open && 'url' in open && (
            <Button size="sm" onClick={() => window.open(open.url, '_blank', 'noreferrer')}>
              <ExternalLink className="size-3.25" />
              Open the page
            </Button>
          )}
          {open && 'file' in open && (
            <Button
              size="sm"
              onClick={() => window.open(api.fileUrl(open.file), '_blank', 'noreferrer')}
            >
              <FileText className="size-3.25" />
              Open the file{open.cell ? ` at ${open.cell}` : ''}
            </Button>
          )}
          {CORRECTABLE.has(field.kind) && !correcting && (
            <Button size="sm" variant="ghost" onClick={() => setCorrecting(true)}>
              Correct it
            </Button>
          )}
        </div>
        {correcting && (
          <Correct
            tableId={tableId}
            rowId={row.id}
            field={field}
            value={value}
            onDone={() => setCorrecting(false)}
          />
        )}
        {history.length > 1 && (
          <div>
            <div className="font-semibold text-ink-3 text-xs uppercase tracking-label">History</div>
            <ol className="mt-1.5">
              {history.map((h, i) => (
                <li
                  key={i}
                  className="grid grid-cols-[5.25rem_1fr] gap-x-2.5 gap-y-0.5 border-hair border-t py-2 text-sm"
                >
                  <span className="row-span-2 text-ink-3 tabular-nums">
                    {h.source ? when(h.source.at) : ''}
                  </span>
                  <span className="font-medium text-ink tabular-nums">
                    {show(field, h.value, names)}
                  </span>
                  <span className="text-ink-3">
                    {h.source ? KIND_WORDS[h.source.kind] : ''}
                    {i === 0 ? ' · now' : ''}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
    </SidePanel>
  )
}

// Correct it: the value as the person types it, read for its kind, saved as their word.
function Correct({
  tableId,
  rowId,
  field,
  value,
  onDone,
}: {
  tableId: string
  rowId: string
  field: FieldView
  value: unknown
  onDone: () => void
}) {
  const start =
    field.kind === 'money' && value && typeof value === 'object'
      ? String((value as { amount: number }).amount)
      : value === null || value === undefined
        ? ''
        : String(value)
  const [typed, setTyped] = useState(start)
  const [problem, setProblem] = useState<string | null>(null)
  const save = async (e: FormEvent) => {
    e.preventDefault()
    setProblem(null)
    const t = typed.trim()
    const amount = Number(t.replace(/[$,\s]/g, ''))
    const read =
      field.kind === 'money'
        ? {
            amount,
            currency:
              (value && typeof value === 'object' && (value as { currency?: string }).currency) ||
              'USD',
          }
        : field.kind === 'number'
          ? amount
          : t
    if ((field.kind === 'money' || field.kind === 'number') && Number.isNaN(amount)) {
      setProblem('That is not a number.')
      return
    }
    try {
      await api.post(`/api/tables/${tableId}/rows/${rowId}`, { field: field.name, value: read })
      onDone()
    } catch (err) {
      setProblem(err instanceof Problem ? err.message : 'That was not saved.')
    }
  }
  return (
    <form onSubmit={save} className="flex flex-col gap-2">
      {field.kind === 'choice' ? (
        <Select value={typed} onChange={(e) => setTyped(e.target.value)} aria-label={field.name}>
          {field.choices.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </Select>
      ) : (
        <Field
          autoFocus
          value={typed}
          aria-label={field.name}
          type={field.kind === 'date' ? 'date' : 'text'}
          onChange={(e) => setTyped(e.target.value)}
        />
      )}
      {problem && <div className="text-bad text-sm">{problem}</div>}
      <div className="flex gap-2">
        <Button type="submit" size="sm" variant="primary">
          Save as yours
        </Button>
        <Button size="sm" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  )
}

// + Filter: a choice field, then one of its choices.
function FilterButton({
  fields,
  onPick,
}: {
  fields: FieldView[]
  onPick: (field: string, value: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [field, setField] = useState<FieldView | null>(null)
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen((o) => !o)
          setField(null)
        }}
        className="flex h-7.5 items-center gap-1.5 rounded-md border border-line border-dashed px-2.5 text-ink-2 text-md hover:border-accent-line hover:text-ink"
      >
        <ListFilter className="size-3.25" />
        Filter
      </button>
      {open && (
        <div className="absolute top-8.5 left-0 z-30 min-w-48 overflow-hidden rounded-md border border-line bg-surface p-1 shadow-pop">
          {(field ? field.choices : fields.map((f) => f.name)).map((o) => (
            <button
              key={o}
              type="button"
              onClick={() => {
                if (!field) setField(fields.find((f) => f.name === o) ?? null)
                else {
                  onPick(field.name, o)
                  setOpen(false)
                }
              }}
              className="flex h-7.5 w-full items-center rounded-sm px-2.5 text-left text-ink text-md hover:bg-hover"
            >
              {o}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// Add a row: the person's own values, each saved as theirs.
function AddRow({
  tableId,
  name,
  fields,
  onClose,
}: {
  tableId: string
  name: string
  fields: FieldView[]
  onClose: () => void
}) {
  const [values, setValues] = useState<Record<string, string>>({})
  const [problem, setProblem] = useState<string | null>(null)
  const save = async (e: FormEvent) => {
    e.preventDefault()
    setProblem(null)
    const read: Record<string, unknown> = {}
    for (const f of fields) {
      const t = (values[f.name] ?? '').trim()
      if (!t) continue
      const n = Number(t.replace(/[$,\s]/g, ''))
      if ((f.kind === 'money' || f.kind === 'number') && Number.isNaN(n)) {
        setProblem(`${f.name} is not a number.`)
        return
      }
      read[f.name] =
        f.kind === 'money' ? { amount: n, currency: 'USD' } : f.kind === 'number' ? n : t
    }
    try {
      await api.post(`/api/tables/${tableId}/rows`, { values: read })
      onClose()
    } catch (err) {
      setProblem(err instanceof Problem ? err.message : 'That row was not added.')
    }
  }
  return (
    <SidePanel title={`Add a row to ${name}`} onClose={onClose}>
      <form onSubmit={save} className="flex flex-col gap-3 p-4.5">
        {fields.map((f) => (
          <label key={f.id} className="flex flex-col gap-1 text-md" htmlFor={`add-${f.id}`}>
            <span className="text-ink-2">{f.name}</span>
            {f.kind === 'choice' ? (
              <Select
                id={`add-${f.id}`}
                value={values[f.name] ?? ''}
                onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
              >
                <option value="" />
                {f.choices.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </Select>
            ) : (
              <Field
                id={`add-${f.id}`}
                type={f.kind === 'date' ? 'date' : 'text'}
                value={values[f.name] ?? ''}
                onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
              />
            )}
          </label>
        ))}
        {problem && <div className="text-bad text-sm">{problem}</div>}
        <div className="flex gap-2">
          <Button type="submit" size="sm" variant="primary">
            Add it
          </Button>
          <Button size="sm" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </form>
    </SidePanel>
  )
}
