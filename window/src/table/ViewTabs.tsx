// A table's toolbar, one row that never wraps, in this order: the saved list (a dropdown: the one
// the table opens on first, its ★ filled, then All and each list, shared by everyone, a ★ on hover
// making one the default, with Add list at its foot), the view, search and filter (`tools`), and on the right
// the table's actions, ⋮ and the numbers' chevron (`right`). The list's own actions sit in the
// dropdown and on a right-click of it: rename, duplicate, open the table on it, delete. Save and
// Cancel, while the list on screen differs from what was saved, sit beside New (`saveAt`; Vikas,
// 27 Oct).
import type { SavedView } from '@alpha/core/api'
import { ChevronDown, Plus } from 'lucide-react'
import { type FormEvent, type ReactNode, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Button } from '../ui/button.tsx'
import { Confirm } from '../ui/dialog.tsx'
import { Field } from '../ui/field.tsx'
import { MenuHeading, MenuItem, MenuLine, Popover, useContextMenu } from '../ui/popover.tsx'

export function ViewTabs({
  tools,
  right,
  views,
  current,
  dirty,
  problem,
  onPick,
  onSave,
  onSaveAs,
  onRename,
  onDefault,
  onRemove,
  onReset,
  saveAt,
}: {
  tools: ReactNode // the view, search and filter, after the saved list
  right: ReactNode // the table's own actions, ⋮ and the chevron, at the right end
  views: SavedView[]
  current: string | null
  dirty: boolean
  problem: string | null
  onPick: (id: string | null) => void
  onSave: () => void
  onSaveAs: (name: string) => void
  onRename: (name: string) => void
  onDefault: (id: string, on: boolean) => void // the core keeps the list the table opens on
  onRemove: () => void
  onReset: () => void
  saveAt: HTMLElement | null // where Save and Cancel go: beside New
}) {
  const [open, setOpen] = useState(false)
  const [removing, setRemoving] = useState(false) // Delete the list asks first, in the pop-up
  const [naming, setNaming] = useState<'new' | 'rename' | null>(null)
  const picker = useRef<HTMLButtonElement>(null)
  const saver = useRef<HTMLButtonElement>(null)
  const onList = useContextMenu()
  const view = views.find((v) => v.id === current)
  const name = view?.name ?? 'All'
  const close = () => {
    setOpen(false)
    onList.close()
  }
  const allReason = view ? undefined : 'All keeps its name and stays.'
  const mark = views.find((v) => v.isDefault) // the list the table opens on; none, All
  const starred = (v: SavedView | null) => (v ? v.isDefault : !mark)
  // the list's own actions: in the dropdown, under its lines, and on a right-click of it
  const actions = (
    <>
      <MenuItem
        reason={allReason}
        onClick={() => {
          close()
          setNaming('rename')
        }}
      >
        Rename list…
      </MenuItem>
      <MenuItem
        onClick={() => {
          close()
          onSaveAs(view ? `${view.name} (copy)` : 'All (copy)')
        }}
      >
        Duplicate list
      </MenuItem>
      <MenuItem
        checked={view ? view.isDefault : !views.some((v) => v.isDefault)}
        reason={
          view
            ? undefined
            : views.some((v) => v.isDefault)
              ? 'Open another list on its own default to change it.'
              : 'The table already opens on All.'
        }
        onClick={() => {
          close()
          if (view) onDefault(view.id, !view.isDefault)
        }}
      >
        Open the table on this list
      </MenuItem>
      <MenuLine />
      <MenuItem
        danger
        reason={allReason}
        onClick={() => {
          close()
          setRemoving(true)
        }}
      >
        Delete list
      </MenuItem>
    </>
  )
  return (
    <div className="flex min-h-11 items-center gap-2 border-hair border-b px-7">
      <button
        ref={picker}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Saved list: ${name}`}
        data-tip={
          view
            ? 'The saved list: double-click to rename it; right-click to rename, duplicate or delete it'
            : 'The saved list: right-click to duplicate it'
        }
        onClick={() => setOpen((o) => !o)}
        onDoubleClick={() => {
          if (!view) return
          setOpen(false)
          setNaming('rename')
        }}
        {...onList.on}
        className="flex h-7.5 max-w-40 shrink-0 items-center gap-1.5 rounded-md border border-line bg-surface pr-1.5 pl-2.5 text-ink text-md hover:border-accent-line hover:bg-accent-soft"
      >
        <span className="truncate">{name}</span>
        {dirty && (
          <span
            aria-hidden="true"
            className="size-1.5 shrink-0 rounded-full bg-accent"
            title="Changed since it was saved"
          />
        )}
        <ChevronDown className="size-3.5 shrink-0 text-ink-3" />
      </button>
      {tools}
      {problem && <span className="min-w-0 truncate text-bad text-sm">{problem}</span>}
      <span className="ml-auto flex shrink-0 items-center gap-1">{right}</span>
      <Popover anchor={picker} open={open} onClose={() => setOpen(false)}>
        <MenuHeading>Saved lists</MenuHeading>
        {[null, ...views]
          .sort((a, b) => Number(starred(b)) - Number(starred(a)))
          .map((v) => (
            <MenuItem
              key={v?.id ?? 'all'}
              checked={(v?.id ?? null) === current}
              star={{
                on: starred(v),
                // All's ★ comes back when no list has one; a list's own ★ off opens the table on All
                onClick: v
                  ? () => onDefault(v.id, !v.isDefault)
                  : mark
                    ? () => onDefault(mark.id, false)
                    : undefined,
              }}
              onClick={() => {
                setOpen(false)
                onPick(v?.id ?? null)
              }}
            >
              {v?.name ?? 'All'}
            </MenuItem>
          ))}
        <MenuLine />
        {actions}
        <MenuLine />
        <MenuItem
          onClick={() => {
            setOpen(false)
            setNaming('new')
          }}
        >
          <Plus className="size-3.5 text-ink-3" />
          Add list
        </MenuItem>
      </Popover>
      <Popover point={onList.point} open={onList.open} onClose={onList.close}>
        {actions}
      </Popover>
      {dirty &&
        saveAt &&
        createPortal(
          <>
            <Button
              ref={saver}
              size="sm"
              variant="primary"
              onClick={() => (view ? onSave() : setNaming('new'))}
              data-tip={
                view ? `Save the changes to ${view.name}` : 'Keep what is on screen as a new list'
              }
            >
              {view ? 'Save' : 'Save as list'}
            </Button>
            <Button size="sm" variant="ghost" onClick={onReset} title="Go back to what was saved">
              Cancel
            </Button>
          </>,
          saveAt,
        )}
      <Popover
        anchor={naming === 'new' && dirty && saveAt ? saver : picker}
        open={naming !== null}
        onClose={() => setNaming(null)}
      >
        <NameForm
          start={naming === 'rename' ? (view?.name ?? '') : ''}
          label={naming === 'rename' ? 'Rename' : 'Save'}
          onSave={(name) => {
            setNaming(null)
            if (naming === 'rename') onRename(name)
            else onSaveAs(name)
          }}
        />
      </Popover>
      <Confirm
        open={removing && !!view}
        title={`Delete ${view?.name} for everyone?`}
        yes="Delete list"
        onClose={() => setRemoving(false)}
        onYes={() => {
          setRemoving(false)
          onRemove()
        }}
      >
        The list goes, with its filters, sorts and columns, and can’t be brought back; the rows
        stay.
      </Confirm>
    </div>
  )
}

function NameForm({
  start,
  label,
  onSave,
}: {
  start: string
  label: string
  onSave: (name: string) => void
}) {
  const [name, setName] = useState(start)
  const save = (e: FormEvent) => {
    e.preventDefault()
    if (name.trim()) onSave(name.trim())
  }
  return (
    <form onSubmit={save} className="flex w-64 flex-col gap-2 p-1.5">
      <span className="text-ink-2 text-sm">The list’s name, shared with everyone</span>
      <Field
        autoFocus
        value={name}
        placeholder="Fits, Georgia, This week…"
        onChange={(e) => setName(e.target.value)}
        aria-label="The list’s name"
      />
      <div className="flex gap-2">
        <Button type="submit" size="sm" variant="primary" disabled={!name.trim()}>
          {label}
        </Button>
      </div>
    </form>
  )
}
