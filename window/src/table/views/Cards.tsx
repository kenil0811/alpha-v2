// The list and the gallery: a row as one line, its title then a few values (Vikas, 3 Nov), or as
// a card. Either opens the row whole. The list keeps the view's groups.
import type { FieldView, RowView } from '@alpha/core/api'
import { Choice } from '../../ui/pill.tsx'
import { type Group, groupRows } from '../engine.ts'
import { TagChips } from '../Tags.tsx'
import { show, summary, titleOf } from '../values.ts'

function Value({
  field,
  row,
  names,
}: {
  field: FieldView
  row: RowView
  names: Record<string, string>
}) {
  const text = show(field, row.values[field.slug], names)
  if (field.kind === 'choice' && field.many)
    return <TagChips field={field} value={row.values[field.slug]} />
  if (field.kind === 'choice') return <Choice of={field} value={text} />
  return <span className="tabular-nums">{text}</span>
}

export function ListView({
  rows,
  fields,
  group,
  names,
  onOpen,
}: {
  rows: RowView[]
  fields: FieldView[]
  group: FieldView | undefined
  names: Record<string, string>
  onOpen: (id: string) => void
}) {
  const groups: Group[] = group ? groupRows(rows, group, names) : [{ key: '', label: '', rows }]
  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-7 pb-6">
      {groups.map((g) => (
        <section key={g.key || 'all'} className="mb-4">
          {group && (
            <div className="mb-1.5 flex items-center gap-2 px-1 font-medium text-ink text-md">
              {g.label}
              <span className="font-normal text-ink-3 text-sm">{g.rows.length}</span>
            </div>
          )}
          <div className="overflow-hidden rounded-lg border border-line bg-surface">
            {g.rows.map((r) => (
              <button
                key={r.id}
                type="button"
                id={`row-${r.id}`}
                onClick={() => onOpen(r.id)}
                className="flex w-full items-center gap-4 border-hair border-t px-4 py-2.5 text-left first:border-t-0 hover:bg-hover"
              >
                <span className="max-w-1/3 shrink-0 truncate font-medium text-base text-ink">
                  {titleOf(fields, r)}
                </span>
                <span className="flex min-w-0 items-center gap-x-4 overflow-hidden whitespace-nowrap text-ink-2 text-sm">
                  {summary(fields, r, 5, group ? [group.id] : []).map((f) => (
                    <span key={f.id} className="inline-flex shrink-0 items-center gap-1.5">
                      <span className="text-ink-3">{f.name}</span>
                      <Value field={f} row={r} names={names} />
                    </span>
                  ))}
                </span>
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

export function GalleryView({
  rows,
  fields,
  names,
  onOpen,
}: {
  rows: RowView[]
  fields: FieldView[]
  names: Record<string, string>
  onOpen: (id: string) => void
}) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-7 pb-6">
      <div className="grid grid-cols-[repeat(auto-fill,minmax(248px,1fr))] gap-3">
        {rows.map((r) => (
          <button
            key={r.id}
            type="button"
            id={`row-${r.id}`}
            onClick={() => onOpen(r.id)}
            className="flex flex-col gap-2 rounded-lg border border-line bg-surface p-4 text-left hover:border-accent-line"
          >
            <span className="line-clamp-2 font-medium text-base text-ink">
              {titleOf(fields, r)}
            </span>
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
              {summary(fields, r, 5).map((f) => (
                <span key={f.id} className="contents">
                  <dt className="text-ink-3">{f.name}</dt>
                  <dd className="min-w-0 truncate text-ink">
                    <Value field={f} row={r} names={names} />
                  </dd>
                </span>
              ))}
            </dl>
          </button>
        ))}
      </div>
    </div>
  )
}
