// A row's menu, opened from the grid by a right-click, Shift+F10 or its ⋮: the cell's own lines
// (Edit, Copy, Clear, where it came from) when it was opened on a cell, then the row's (Open,
// Duplicate, Copy link, Delete row). A line that can't be used here stays, greyed, saying why.
import type { FieldView, RowView } from '@alpha/core/api'
import { Copy, CopyPlus, Eraser, History, Link, PanelRightOpen, Pencil, Trash2 } from 'lucide-react'
import { MenuItem, MenuLine } from '../ui/popover.tsx'
import { CORRECTABLE, show } from './values.ts'

export function RowMenu({
  tableId,
  row: r,
  field: f,
  names,
  readOnly,
  elsewhere,
  onDone,
  onEdit,
  onClear,
  onHistory,
  onOpen,
  onDuplicate,
  onRemove,
}: {
  tableId: string
  row: RowView
  field: FieldView | null
  names: Record<string, string>
  readOnly: boolean // nothing in this list changes in a cell; its row's page changes it
  elsewhere: boolean // a kept list's row (a task, a person): copied and deleted on its own page
  onDone: () => void
  onEdit: () => void
  onClear: () => void
  onHistory: () => void
  onOpen: () => void
  onDuplicate: () => void
  onRemove: () => void
}) {
  const then = (fn: () => void) => () => {
    onDone()
    fn()
  }
  const text = f ? show(f, r.values[f.slug], names) : ''
  const kept = elsewhere ? 'This row is kept on its own page; do that there.' : undefined
  const fixed = readOnly
    ? 'This row changes on its own page.'
    : f && !CORRECTABLE.has(f.kind)
      ? 'Alpha works this value out; open where it came from to correct that.'
      : undefined
  return (
    <>
      {f && (
        <>
          <MenuItem reason={fixed} hint="Enter" onClick={then(onEdit)}>
            <Pencil className="size-3.5 text-ink-3" />
            Edit
          </MenuItem>
          <MenuItem
            reason={text ? undefined : 'There is nothing in it to copy.'}
            onClick={then(() => navigator.clipboard?.writeText(text))}
          >
            <Copy className="size-3.5 text-ink-3" />
            Copy
          </MenuItem>
          <MenuItem
            reason={fixed ?? (text ? undefined : 'It is already empty.')}
            onClick={then(onClear)}
          >
            <Eraser className="size-3.5 text-ink-3" />
            Clear
          </MenuItem>
          <MenuItem onClick={then(onHistory)}>
            <History className="size-3.5 text-ink-3" />
            Where it came from, and its history
          </MenuItem>
          <MenuLine />
        </>
      )}
      <MenuItem onClick={then(onOpen)}>
        <PanelRightOpen className="size-3.5 text-ink-3" />
        Open
      </MenuItem>
      <MenuItem reason={kept} onClick={then(onDuplicate)}>
        <CopyPlus className="size-3.5 text-ink-3" />
        Duplicate
      </MenuItem>
      <MenuItem
        onClick={then(() =>
          navigator.clipboard?.writeText(
            `${location.origin}${location.pathname}#/table/${tableId}/${r.id}`,
          ),
        )}
      >
        <Link className="size-3.5 text-ink-3" />
        Copy link
      </MenuItem>
      <MenuLine />
      <MenuItem danger reason={kept} onClick={then(onRemove)}>
        <Trash2 className="size-3.5" />
        Delete row
      </MenuItem>
    </>
  )
}
