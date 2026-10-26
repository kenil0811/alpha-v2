// A table's toolbar, one row that never wraps, in this order: the saved list (a dropdown: All,
// then each list, shared by everyone, with Add list at its foot), Save and Cancel while the list
// on screen differs from what was saved, the view and search (`tools`), and on the right Filter,
// then ⋮ (`right`). The list's own actions sit in the
// dropdown and on a right-click of it: rename, duplicate, open the table on it, delete.
import type { SavedView } from '@alpha/core/api'
import { ChevronDown, Plus, Star } from 'lucide-react'
import { type FormEvent, type ReactNode, useRef, useState } from 'react'
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
}: {
  tools: ReactNode // the view and search, after the saved list
  right: ReactNode // Filter, then ⋮, at the right end
  views: SavedView[]
  current: string | null
  dirty: boolean
  problem: string | null
  onPick: (id: string | null) => void
  onSave: () => void
  onSaveAs: (name: string) => void
  onRename: (name: string) => void
  onDefault: (on: boolean) => void
  onRemove: () => void
  onReset: () => void
}) {
  const [open, setOpen] = useState(false)
  const [removing, setRemoving] = useState(false) // Delete the list asks first, in the pop-up
  const [naming, setNaming] = useState<'new' | 'rename' | null>(null)
  const picker = useRef<HTMLButtonElement>(null)
  const onList = useContextMenu()
  const view = views.find((v) => v.id === current)
  const name = view?.name ?? 'All'
  const close = () => {
    setOpen(false)
    onList.close()
  }
  const allReason = view ? undefined : 'All keeps its name and stays.'
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
          if (view) onDefault(!view.isDefault)
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
        title={
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
        className="flex h-7.5 max-w-40 shrink-0 items-center gap-1.5 rounded-md border border-line bg-surface pr-1.5 pl-2.5 text-ink text-md hover:border-accent-line"
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
      {dirty && (
        <>
          <Button size="sm" variant="ghost" onClick={onReset} title="Go back to what was saved">
            Cancel
          </Button>
          <Button
            size="sm"
            variant="primary"
            onClick={() => (view ? onSave() : setNaming('new'))}
            title={
              view ? `Save the changes to ${view.name}` : 'Keep what is on screen as a new list'
            }
          >
            {view ? 'Save' : 'Save as list'}
          </Button>
        </>
      )}
      {tools}
      {problem && <span className="min-w-0 truncate text-bad text-sm">{problem}</span>}
      <span className="ml-auto flex shrink-0 items-center gap-1">{right}</span>
      <Popover anchor={picker} open={open} onClose={() => setOpen(false)}>
        <MenuHeading>Saved lists</MenuHeading>
        {[null, ...views].map((v) => (
          <MenuItem
            key={v?.id ?? 'all'}
            checked={(v?.id ?? null) === current}
            hint={
              (v ? v.isDefault : !views.some((x) => x.isDefault)) && (
                <Star className="size-3.25 fill-current" aria-label="The table opens on it" />
              )
            }
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
      <Popover anchor={picker} open={naming !== null} onClose={() => setNaming(null)}>
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
        The list goes, with its filters, sorts and columns; the rows stay.
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
