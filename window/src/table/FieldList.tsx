// A row's properties, every one, as a record's page and the row panel draw them. Out of
// RowPanel.tsx (the window file wall).
import type { FieldView, RowView } from '@alpha/core/api'
import { type KeyboardEvent, type MouseEvent, useState } from 'react'
import { NO_RECORD, useLayout } from '../layout.ts'
import { AddCell, HiddenToggle } from '../RecordFields.tsx'
import { cn } from '../ui/cn.ts'
import { Choice } from '../ui/pill.tsx'
import { Popover } from '../ui/popover.tsx'
import { CellHistory } from './CellHistory.tsx'
import { EditCell } from './EditCell.tsx'
import { type Grey, GreyChoice, isGrey } from './GreyChoice.tsx'
import { RowMenu } from './RowMenu.tsx'
import { TagChips } from './Tags.tsx'
import { canEdit, EMPTY_WORDS, hrefOf, isTags, MARK, show, sourceTip } from './values.ts'

// A row's fields, every one: a double-click (or Enter or F2) changes one that can be typed, a
// right-click (or Shift+F10) opens the cell's menu with where it came from. The row's view draws it,
// and a person's page draws their rows of one-row-per-person tables with it.
export function FieldList({
  tableId,
  fields,
  row,
  names,
  onField,
  onEdit,
  columns = false,
  hideable = false,
}: {
  hideable?: boolean // a record page's: right-click hides one, and a + in the next cell adds one
  tableId: string
  fields: FieldView[]
  row: RowView
  names: Record<string, string>
  onField: (slug: string) => void
  onEdit?: ((field: FieldView, value: unknown, grey?: Grey) => Promise<boolean>) | undefined
  columns?: boolean // across the width in columns (a record page's Summary)
}) {
  const [editing, setEditing] = useState<string | null>(null)
  const [greyed, setGreyed] = useState<string | null>(null)
  const [menu, setMenu] = useState<{ field: FieldView; x: number; y: number } | null>(null)
  const [past, setPast] = useState<FieldView | null>(null)
  const { layout, change } = useLayout()
  const [unhidden, setUnhidden] = useState(false)
  // the properties the person hid from every record of this table
  const kept = layout.records[tableId] ?? NO_RECORD
  const hidden = hideable ? fields.filter((f) => kept.hidden.includes(f.id)) : []
  const first = fields[0]
  return (
    <>
      <dl
        className={cn(columns ? 'grid gap-x-6 @3xl:grid-cols-2 @6xl:grid-cols-3' : 'flex flex-col')}
      >
        {fields
          .filter((f) => f.kind !== 'notes' && (unhidden || !hidden.includes(f)))
          .map((f) => {
            const source = row.sources[f.slug]
            const text = show(f, row.values[f.slug], names)
            const out = hrefOf(f, row.values[f.slug])
            const editable = !!onEdit && canEdit(f)
            if (editing === f.slug && onEdit)
              return (
                <div
                  key={f.id}
                  className="flex flex-col gap-0.5 border-hair border-b px-4.5 py-2.5"
                >
                  <dt className="text-ink-3 text-sm">{f.name}</dt>
                  <EditCell
                    field={f}
                    value={row.values[f.slug]}
                    onDone={async (v) => {
                      const ok = v === undefined || (await onEdit(f, v))
                      if (ok) setEditing(null)
                      return ok
                    }}
                  />
                </div>
              )
            if (greyed === f.slug && onEdit)
              return (
                <div
                  key={f.id}
                  className="flex flex-col gap-0.5 border-hair border-b px-4.5 py-2.5"
                >
                  <dt className="text-ink-3 text-sm">{f.name}</dt>
                  <GreyChoice
                    text={text}
                    onCancel={() => setGreyed(null)}
                    onChoose={async (g) => {
                      if (await onEdit(f, undefined, g)) setGreyed(null)
                    }}
                  />
                </div>
              )
            // a related row's name is a link that opens it beside the page (T4)
            const related =
              f.kind === 'relation'
                ? (Array.isArray(row.values[f.slug])
                    ? (row.values[f.slug] as unknown[])
                    : [row.values[f.slug]]
                  )
                    .filter((id) => id != null && id !== '')
                    .map(String)
                : []
            const props = {
              onDoubleClick: () =>
                editable && (isGrey(source?.kind) ? setGreyed(f.slug) : setEditing(f.slug)),
              onContextMenu: (e: MouseEvent<HTMLElement>) => {
                e.preventDefault()
                setMenu({ field: f, x: e.clientX, y: e.clientY })
              },
              onKeyDown: (e: KeyboardEvent<HTMLElement>) => {
                if (e.target !== e.currentTarget) return
                if ((e.shiftKey && e.key === 'F10') || e.key === 'ContextMenu') {
                  e.preventDefault()
                  const r = e.currentTarget.getBoundingClientRect()
                  setMenu({ field: f, x: r.left + 8, y: r.bottom })
                } else if (editable && (e.key === 'Enter' || e.key === 'F2')) {
                  e.preventDefault()
                  if (isGrey(source?.kind)) setGreyed(f.slug)
                  else setEditing(f.slug)
                }
              },
              className:
                'flex cursor-default flex-col gap-0.5 border-hair border-b px-4.5 py-2.5 text-left hover:bg-hover',
            }
            const inner = (
              <>
                <dt
                  className="flex items-center gap-2 text-ink-3 text-sm"
                  data-tip={f.about ?? f.summary ?? undefined}
                >
                  {f.name}
                </dt>
                {/* where it came from, in plain words on its hover */}
                <dd
                  data-tip={source ? sourceTip(source) : undefined}
                  className={cn(
                    'whitespace-pre-wrap break-words text-md',
                    text ? 'text-ink' : 'text-ink-3',
                    source && MARK[source.kind] && 'italic',
                  )}
                >
                  {related.length > 0 ? (
                    related.map((id, i) => (
                      <span key={id}>
                        {i > 0 && ', '}
                        <a href={`#/row/${id}`} className="text-ink hover:underline">
                          {names[id] ?? '…'}
                        </a>
                      </span>
                    ))
                  ) : isTags(f) && text ? (
                    <TagChips field={f} value={row.values[f.slug]} />
                  ) : out ? (
                    <a
                      href={out}
                      target="_blank"
                      rel="noreferrer"
                      className="text-accent hover:underline"
                    >
                      {text}
                    </a>
                  ) : f.kind === 'choice' && text ? (
                    <Choice of={f} value={text} />
                  ) : (
                    text || EMPTY_WORDS
                  )}
                  {text && source && MARK[source.kind] && (
                    <span className="ml-1.5 text-ink-3 text-sm not-italic">
                      {MARK[source.kind]}
                    </span>
                  )}
                </dd>
              </>
            )
            // a field holding links cannot be a button: a link inside a button is never clicked
            return related.length > 0 || out ? (
              // biome-ignore lint/a11y/noNoninteractiveTabindex: reached by Tab like every field, for F2 and the menu key
              <div key={f.id} tabIndex={0} {...props}>
                {inner}
              </div>
            ) : (
              <button key={f.id} type="button" {...props}>
                {inner}
              </button>
            )
          })}
        {hideable && <AddCell tableId={tableId} />}
      </dl>
      <Popover point={menu && { x: menu.x, y: menu.y }} open={!!menu} onClose={() => setMenu(null)}>
        {menu && (
          <RowMenu
            tableId={tableId}
            row={row}
            field={menu.field}
            names={names}
            readOnly={!onEdit}
            elsewhere={false}
            onDone={() => setMenu(null)}
            onEdit={() => setEditing(menu.field.slug)}
            onClear={() => void onEdit?.(menu.field, null)}
            onSource={() => onField(menu.field.slug)}
            onHistory={() => setPast(menu.field)}
            onHide={
              hideable
                ? () => {
                    const id = menu.field.id
                    const on = kept.hidden.includes(id)
                    change({
                      records: {
                        [tableId]: {
                          ...kept,
                          hidden: on ? kept.hidden.filter((x) => x !== id) : [...kept.hidden, id],
                        },
                      },
                    })
                  }
                : undefined
            }
            hidden={kept.hidden.includes(menu.field.id)}
          />
        )}
      </Popover>
      {hidden.length > 0 && (
        <HiddenToggle
          hidden={hidden.length}
          shown={unhidden}
          onShow={() => setUnhidden(!unhidden)}
        />
      )}
      {past && (
        <CellHistory
          tableId={tableId}
          row={row.id}
          field={past}
          rowName={first ? show(first, row.values[first.slug], names) : ''}
          names={names}
          onClose={() => setPast(null)}
        />
      )}
    </>
  )
}
