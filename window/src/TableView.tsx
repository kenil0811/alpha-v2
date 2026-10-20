// A table in its table view, and as a board when it has a choice to group by (design §14: the
// first two of the eight views). Every value opens to where it came from.
import type { FieldView, RowView, SourceView, TableView as TableData } from '@alpha/core/api'
import { createColumnHelper, tableFeatures, useTable } from '@tanstack/react-table'
import { X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { api } from './api.ts'
import { IconButton } from './ui/button.tsx'
import { cn } from './ui/cn.ts'
import { Select } from './ui/field.tsx'
import { Pill, type Tone } from './ui/pill.tsx'
import { Segmented } from './ui/segmented.tsx'

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

export function TableView({ data, row: openRow }: { data: TableData; row?: string | null }) {
  const [picked, setPicked] = useState<{
    field: FieldView
    source: SourceView
    value: string
  } | null>(null)
  // the board groups by Stage when there is one, else by the first choice
  const groupBy =
    data.fields.find((f) => f.kind === 'choice' && f.name === 'Stage') ??
    data.fields.find((f) => f.kind === 'choice')
  const [view, setView] = useState<'table' | 'board'>('table')
  useEffect(() => {
    if (openRow) document.getElementById(`row-${openRow}`)?.scrollIntoView({ block: 'center' })
  }, [openRow])
  const columns = useMemo(
    () =>
      helper.columns(
        data.fields.map((f) =>
          helper.display({
            id: f.slug,
            header: () => f.name,
            cell: ({ row }) => {
              const source = row.original.sources[f.slug]
              const value = show(f, row.original.values[f.slug], data.names)
              return (
                <button
                  type="button"
                  disabled={!source}
                  title={value.length > 40 ? value : undefined}
                  className={cn(
                    'block w-full max-w-64 truncate text-left',
                    source && 'hover:underline decoration-line underline-offset-4',
                    (source?.kind === 'estimated' || source?.kind === 'assumed') &&
                      'text-ink-2 italic',
                  )}
                  onClick={() => source && setPicked({ field: f, source, value })}
                >
                  {value}
                </button>
              )
            },
          }),
        ),
      ),
    [data.fields, data.names],
  )
  const table = useTable({ features, columns, data: data.rows })

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-4 px-7 pt-5 pb-3">
        <div>
          <h1 className="text-2xl text-ink">{data.name}</h1>
        </div>
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
      </div>
      <div className="flex-1 overflow-auto px-6 py-4">
        {data.rows.length === 0 ? (
          <p className="text-ink-3">No rows yet.</p>
        ) : view === 'board' && groupBy ? (
          <Board data={data} by={groupBy} />
        ) : (
          <table className="w-full border-collapse text-base">
            <thead>
              {table.getHeaderGroups().map((g) => (
                <tr key={g.id}>
                  {g.headers.map((h) => (
                    <th
                      key={h.id}
                      className="whitespace-nowrap border-b border-line px-2 py-1.5 text-left font-normal text-ink-2"
                    >
                      {h.isPlaceholder ? null : <table.FlexRender header={h} />}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  id={`row-${row.original.id}`}
                  className={cn(
                    'hover:bg-sunk',
                    row.original.id === openRow && 'bg-warn-soft hover:bg-warn-soft',
                  )}
                >
                  {row.getAllCells().map((cell) => (
                    <td key={cell.id} className="border-b border-hair px-2 py-1.5 align-top">
                      <table.FlexRender cell={cell} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {picked && <SourcePanel picked={picked} onClose={() => setPicked(null)} />}
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

function SourcePanel({
  picked,
  onClose,
}: {
  picked: { field: FieldView; source: SourceView; value: string }
  onClose: () => void
}) {
  const { field, source, value } = picked
  const open = source.open
  return (
    <div className="border-t border-line bg-sunk px-6 py-3 text-base">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-ink-3 text-sm">
            <span>
              {field.name}: {value}
            </span>
            <Pill tone={KIND_TONE[source.kind]}>{KIND_WORDS[source.kind]}</Pill>
            <span>
              {new Date(source.at).toLocaleString(undefined, {
                day: 'numeric',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          </div>
          <div className="mt-1 text-ink">{source.words}</div>
          {open && 'file' in open && (
            <a
              className="mt-1 inline-block text-sm underline"
              href={api.fileUrl(open.file)}
              target="_blank"
              rel="noreferrer"
            >
              Open the file{open.cell ? ` at ${open.cell}` : ''}
            </a>
          )}
          {open && 'url' in open && (
            <a
              className="mt-1 inline-block text-sm underline"
              href={open.url}
              target="_blank"
              rel="noreferrer"
            >
              Open the page
            </a>
          )}
        </div>
        <IconButton label="Close" onClick={onClose}>
          <X className="size-4" />
        </IconButton>
      </div>
    </div>
  )
}
