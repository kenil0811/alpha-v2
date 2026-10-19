// A table in its table view (design §14: the first of the eight views). Every value opens to
// where it came from.
import type { FieldView, RowView, SourceView, TableView as TableData } from '@alpha/core/api'
import { createColumnHelper, tableFeatures, useTable } from '@tanstack/react-table'
import { useMemo, useState } from 'react'
import { api } from './api.ts'
import { cn } from './ui/cn.ts'

const features = tableFeatures({})
const helper = createColumnHelper<typeof features, RowView>()

const KIND_WORDS: Record<SourceView['kind'], string> = {
  stated: 'Stated',
  looked_up: 'Looked up',
  estimated: 'Estimated',
  assumed: 'Assumed',
  computed: 'Computed',
}

function show(field: FieldView, value: unknown): string {
  if (value === null || value === undefined) return ''
  if (field.kind === 'money' && typeof value === 'object') {
    const m = value as { amount: number; currency: string }
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: m.currency }).format(
      m.amount,
    )
  }
  if (field.kind === 'date' && typeof value === 'string' && !Number.isNaN(Date.parse(value)))
    return new Date(value).toLocaleDateString(undefined, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  if (Array.isArray(value)) return value.join(', ')
  return String(value)
}

export function TableView({ data }: { data: TableData }) {
  const [picked, setPicked] = useState<{
    field: FieldView
    source: SourceView
    value: string
  } | null>(null)
  const columns = useMemo(
    () =>
      helper.columns(
        data.fields.map((f) =>
          helper.display({
            id: f.slug,
            header: () => f.name,
            cell: ({ row }) => {
              const source = row.original.sources[f.slug]
              const value = show(f, row.original.values[f.slug])
              return (
                <button
                  type="button"
                  disabled={!source}
                  className={cn(
                    'w-full text-left',
                    source && 'hover:underline decoration-neutral-300 underline-offset-4',
                    (source?.kind === 'estimated' || source?.kind === 'assumed') &&
                      'text-neutral-500 italic',
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
    [data.fields],
  )
  const table = useTable({ features, columns, data: data.rows })

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-neutral-200 px-6 py-4">
        <div className="text-xs text-neutral-400">{data.module.name}</div>
        <h1 className="text-lg text-neutral-900">{data.name}</h1>
      </div>
      <div className="flex-1 overflow-auto px-6 py-4">
        {data.rows.length === 0 ? (
          <p className="text-neutral-400">No rows yet.</p>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead>
              {table.getHeaderGroups().map((g) => (
                <tr key={g.id}>
                  {g.headers.map((h) => (
                    <th
                      key={h.id}
                      className="border-b border-neutral-200 px-2 py-1.5 text-left font-normal text-neutral-500"
                    >
                      {h.isPlaceholder ? null : <table.FlexRender header={h} />}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.map((row) => (
                <tr key={row.id} className="hover:bg-neutral-50">
                  {row.getAllCells().map((cell) => (
                    <td key={cell.id} className="border-b border-neutral-100 px-2 py-1.5 align-top">
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
    <div className="border-t border-neutral-200 bg-neutral-50 px-6 py-3 text-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-xs text-neutral-400">
            {field.name}: {value} · {KIND_WORDS[source.kind]} ·{' '}
            {new Date(source.at).toLocaleString(undefined, {
              day: 'numeric',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </div>
          <div className="mt-1 text-neutral-800">{source.words}</div>
          {open && 'file' in open && (
            <a
              className="mt-1 inline-block text-xs underline"
              href={api.fileUrl(open.file)}
              target="_blank"
              rel="noreferrer"
            >
              Open the file{open.cell ? ` at ${open.cell}` : ''}
            </a>
          )}
          {open && 'url' in open && (
            <a
              className="mt-1 inline-block text-xs underline"
              href={open.url}
              target="_blank"
              rel="noreferrer"
            >
              Open the page
            </a>
          )}
        </div>
        <button
          type="button"
          className="text-xs text-neutral-400 hover:text-neutral-700"
          onClick={onClose}
        >
          Close
        </button>
      </div>
    </div>
  )
}
