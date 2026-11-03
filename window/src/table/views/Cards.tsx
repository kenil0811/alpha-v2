// The list and the gallery. The list is rows down the left and the picked row's page beside them,
// like a folder of files (Vikas, 27 Oct); it keeps the view's groups. The gallery is a card a row,
// each opening the row whole.
import type { FieldView, RowFileView, RowView } from '@alpha/core/api'
import { Fragment, useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../../api.ts'
import { FileView } from '../../FileView.tsx'
import { RowPage } from '../../RowPage.tsx'
import { Choice } from '../../ui/pill.tsx'
import { SideHeading, SideItem, SideList } from '../../ui/side-list.tsx'
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

// what a line of the list says under its title: the first coloured state (Risk, Stage) and the
// first date, else the card's own summary
function glance(fields: FieldView[], r: RowView, group: FieldView | undefined): FieldView[] {
  const has = (f: FieldView) => f !== group && r.values[f.slug] != null && r.values[f.slug] !== ''
  const picked = [
    fields.find((f) => f.kind === 'choice' && !f.many && Object.keys(f.tones).length && has(f)),
    fields.find((f) => f.kind === 'date' && has(f)),
  ].filter((f) => f !== undefined)
  return picked.length ? picked : summary(fields, r, 2, group ? [group.id] : [])
}

export function ListView({
  rows,
  fields,
  group,
  names,
  files,
}: {
  rows: RowView[]
  fields: FieldView[]
  group: FieldView | undefined
  names: Record<string, string>
  files?: string | undefined // a table of documents: a row opens on its file (Vikas, 3 Nov)
}) {
  const groups: Group[] = group ? groupRows(rows, group, names) : [{ key: '', label: '', rows }]
  const [picked, setPicked] = useState<string | null>(null)
  const open = rows.some((r) => r.id === picked) ? picked : (groups[0]?.rows[0]?.id ?? null)
  // the page comes again whenever the rows do: the world changed
  const version = useRef(0)
  const seen = useRef(rows)
  if (seen.current !== rows) {
    seen.current = rows
    version.current++
  }
  const keep = useCallback(() => undefined, [])
  return (
    <div className="mx-7 mb-6 flex min-h-0 flex-1 overflow-hidden rounded-lg border border-line bg-surface">
      <SideList label="Rows" className="w-80 shrink-0 overflow-y-auto border-line border-r p-1.5">
        {groups.map((g) => (
          <Fragment key={g.key || 'all'}>
            {group && (
              <SideHeading>
                {g.label}
                <span className="font-normal">{g.rows.length}</span>
              </SideHeading>
            )}
            {g.rows.map((r) => (
              <SideItem
                key={r.id}
                id={`row-${r.id}`}
                sel={r.id === open}
                onClick={() => setPicked(r.id)}
                sub={glance(fields, r, group).map((f) => (
                  <span key={f.id} className="truncate">
                    <Value field={f} row={r} names={names} />
                  </span>
                ))}
              >
                {titleOf(fields, r)}
              </SideItem>
            ))}
          </Fragment>
        ))}
      </SideList>
      <div className="min-w-0 flex-1">
        {open &&
          (files ? (
            <RowFile key={open} table={files} row={open} version={version.current} />
          ) : (
            <RowPage key={open} id={open} version={version.current} onPlace={keep} inside />
          ))}
      </div>
    </div>
  )
}

// A document's row opens on the document itself, no details (Vikas, 3 Nov: "the document preview
// should directly appear"); a row with no file yet shows its page
function RowFile({ table, row, version }: { table: string; row: string; version: number }) {
  const [file, setFile] = useState<RowFileView | null | undefined>(undefined)
  useEffect(() => {
    if (version < 0) return
    api.get<RowFileView[]>(`/api/tables/${table}/rows/${row}/files`).then(
      (fs) => setFile(fs[0] ?? null),
      () => setFile(null),
    )
  }, [table, row, version])
  const keep = useCallback(() => undefined, [])
  if (file === undefined) return null
  if (!file) return <RowPage id={row} version={version} onPlace={keep} inside />
  return (
    <FileView
      place={{ hash: file.hash, sheet: null, cell: null, page: null, box: null, line: null }}
      onName={keep}
    />
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
