// The list and the gallery: a row as a line with its title and a few values, or as a card. Either
// opens the row whole. The list keeps the view's groups.
import type { FieldView, RowLine, RowView } from '@alpha/core/api'
import { cn } from '../../ui/cn.ts'
import { FRAME } from '../../ui/frame.tsx'
import { List } from '../../ui/list.tsx'
import { Choice, Pill } from '../../ui/pill.tsx'
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

// A kept list's row said as one sentence: what differs from row to row in bold, a light line with
// its dates in the person's own day, and a chip for where it holds; greyed once it no longer holds.
function Sentence({ line }: { line: RowLine }) {
  let at = 0
  const keyed = <T extends { text: string }>(xs: T[]) =>
    xs.map((x) => {
      at += x.text.length
      return { ...x, key: at }
    })
  const day = (d: string) =>
    new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
  const light = keyed(line.light.map((x) => ({ text: typeof x === 'string' ? x : day(x.at) })))
  return (
    <>
      <span className={cn('text-base', line.dim ? 'text-ink-3' : 'text-ink')}>
        {keyed(line.parts).map((p) =>
          p.bold ? (
            <strong key={p.key} className="font-semibold">
              {p.text}
            </strong>
          ) : (
            <span key={p.key}>{p.text}</span>
          ),
        )}
      </span>
      <span className="flex flex-wrap items-center gap-2 text-ink-3 text-sm">
        <span>{light.map((x) => x.text).join('')}</span>
        {line.chip && <Pill>{line.chip}</Pill>}
      </span>
    </>
  )
}

export function ListView({
  rows,
  lines,
  fields,
  group,
  names,
  onOpen,
}: {
  rows: RowView[]
  lines?: Record<string, RowLine> | undefined // a kept list's rows, each said as one sentence
  fields: FieldView[]
  group: FieldView | undefined
  names: Record<string, string>
  onOpen: (id: string) => void
}) {
  const groups: Group[] = group ? groupRows(rows, group, names) : [{ key: '', label: '', rows }]
  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-4">
      {groups.map((g) => (
        <section key={g.key || 'all'} className="mb-4">
          {group && (
            <div className="mb-1.5 flex items-center gap-2 px-1 font-medium text-ink text-md">
              {g.label}
              <span className="font-normal text-ink-3 text-sm">{g.rows.length}</span>
            </div>
          )}
          <List>
            {g.rows.map((r) => (
              <button
                key={r.id}
                type="button"
                id={`row-${r.id}`}
                onClick={() => onOpen(r.id)}
                className="flex w-full flex-col gap-1 border-hair border-t px-4 py-2.5 text-left first:border-t-0 hover:bg-hover"
              >
                {lines?.[r.id] ? (
                  <Sentence line={lines[r.id] as RowLine} />
                ) : (
                  <>
                    <span className="truncate font-medium text-base text-ink">
                      {titleOf(fields, r)}
                    </span>
                    <span className="flex flex-wrap items-center gap-x-4 gap-y-1 text-ink-2 text-sm">
                      {summary(fields, r, 5, group ? [group.id] : []).map((f) => (
                        <span key={f.id} className="inline-flex items-center gap-1.5">
                          <span className="text-ink-3">{f.name}</span>
                          <Value field={f} row={r} names={names} />
                        </span>
                      ))}
                    </span>
                  </>
                )}
              </button>
            ))}
          </List>
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
    <div className="min-h-0 flex-1 overflow-y-auto p-4">
      <div className="grid grid-cols-[repeat(auto-fill,minmax(248px,1fr))] gap-3">
        {rows.map((r) => (
          <button
            key={r.id}
            type="button"
            id={`row-${r.id}`}
            onClick={() => onOpen(r.id)}
            className={`${FRAME} flex flex-col gap-2 p-4 text-left hover:border-accent-line lift`}
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
