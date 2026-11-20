// A table's toolbar, one row that never wraps: the view as an icon, then every saved list as a pill
// in one row that scrolls sideways (the one the table opens on first, then All and each list,
// shared by everyone; the picked one filled), + for a new list, Cancel and Save while the list on
// screen differs from what was saved (Save ▾ Save as new list keeps a shared list as it was), and
// on the right search and filter (`tools`) and the table's actions (`right`). A list behaves like a
// tab: a right-click gives Rename, Duplicate, Move to the front and Delete, and a double-click
// renames it in place. Resting on a pill says what the list holds. A list Alpha keeps itself
// (people, tasks) holds no saved lists, so it shows neither Save nor its menu, and Cancel alone.
import type { FieldView, SavedView } from '@alpha/core/api'
import { ArrowLeftToLine, ChevronDown, CopyPlus, PencilLine, Plus, Trash2 } from 'lucide-react'
import { type FormEvent, type ReactNode, type RefObject, useRef, useState } from 'react'
import { Button } from '../ui/button.tsx'
import { cn } from '../ui/cn.ts'
import { Confirm } from '../ui/dialog.tsx'
import { Field } from '../ui/field.tsx'
import { MenuItem, MenuLine, Popover, useContextMenu } from '../ui/popover.tsx'
import { listWords } from './list-words.ts'

export function ViewTabs({
  picker,
  tools,
  right,
  views,
  fields,
  saving: keeps = true,
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
  links,
}: {
  picker: ReactNode // how the rows are drawn, an icon before the lists
  tools: ReactNode // search and filter, at the right before the table's actions
  right: ReactNode // the table's own actions, ⋮ and the chevron, at the right end
  views: SavedView[]
  fields: FieldView[] // to say what each list holds
  saving?: boolean // false on a list Alpha keeps itself (people, tasks…): it holds no saved lists
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
  // a list Alpha keeps itself may hold its own lists (Tasks: Today, This week…): pills that go to
  // them, in place of All, in the same one row
  links?:
    | { key: string; label: string; count?: number | undefined; href: string; sel: boolean }[]
    | undefined
}) {
  const [saving, setSaving] = useState(false) // Save ▾
  const [removing, setRemoving] = useState(false) // Delete the list asks first, in the pop-up
  const [renaming, setRenaming] = useState(false) // the picked pill is a box to type its name in
  const [naming, setNaming] = useState<{ at: RefObject<HTMLElement | null> } | null>(null)
  const saveAt = useRef<HTMLSpanElement>(null)
  const plusAt = useRef<HTMLButtonElement>(null)
  const onList = useContextMenu()
  const view = views.find((v) => v.id === current)
  const close = () => onList.close()
  const allReason = view ? undefined : 'All keeps its name and stays.'
  const mark = views.find((v) => v.isDefault) // the list the table opens on; none, All
  const starred = (v: SavedView | null) => (v ? v.isDefault : !mark)
  // every list in one row that scrolls sideways, the one the table opens on first
  const ordered = [null, ...views].sort((a, b) => Number(starred(b)) - Number(starred(a)))

  // what a list holds, one line each; on the picked one, that it changed and how to rename it
  const tipOf = (v: SavedView | null) => {
    const mine = (v?.id ?? null) === current
    const lines = [
      ...(mine && dirty ? ['Changed since it was saved'] : []),
      ...(v ? listWords(v.config, fields) : []),
      ...(mine && v ? ['Double-click to rename it'] : []),
    ]
    return lines.length ? lines.join('\n') : undefined
  }
  const rename = () => setRenaming(true)

  // the picked list's own actions: behind ▾ and on a right-click of its pill
  const actions = (
    <>
      <MenuItem
        reason={allReason}
        onClick={() => {
          close()
          rename()
        }}
      >
        <PencilLine className="size-3.5 text-ink-3" />
        Rename list
      </MenuItem>
      <MenuItem
        onClick={() => {
          close()
          onSaveAs(view ? `${view.name} (copy)` : 'All (copy)')
        }}
      >
        <CopyPlus className="size-3.5 text-ink-3" />
        Duplicate list
      </MenuItem>
      <MenuItem
        reason={
          (view ? view.isDefault : !mark)
            ? 'It is already first; the table opens on it.'
            : undefined
        }
        onClick={() => {
          close()
          // the first list is the one the table opens on, kept by the core
          if (view) onDefault(view.id, true)
          else if (mark) onDefault(mark.id, false)
        }}
      >
        <ArrowLeftToLine className="size-3.5 text-ink-3" />
        Move to the front
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
        <Trash2 className="size-3.5" />
        Delete list
      </MenuItem>
    </>
  )
  const pill = (v: SavedView | null) => {
    const mine = (v?.id ?? null) === current
    if (mine && v && renaming)
      return (
        <RenameBox
          key={v.id}
          start={v.name}
          onDone={(name) => {
            setRenaming(false)
            if (name && name !== v.name) onRename(name)
          }}
        />
      )
    return (
      <button
        key={v?.id ?? 'all'}
        type="button"
        aria-pressed={mine}
        data-tip={tipOf(v)}
        onClick={() => onPick(v?.id ?? null)}
        onDoubleClick={() => mine && v && keeps && rename()}
        onContextMenu={
          keeps
            ? (e) => {
                if (!mine) onPick(v?.id ?? null)
                onList.on.onContextMenu(e)
              }
            : undefined
        }
        onKeyDown={mine && keeps ? onList.on.onKeyDown : undefined}
        className={cn(
          'flex h-7 max-w-44 shrink-0 items-center gap-1.5 rounded-full px-3 text-md',
          mine ? 'bg-accent-soft font-medium text-ink' : 'text-ink-2 hover:bg-hover hover:text-ink',
        )}
      >
        <span className="truncate">{v?.name ?? 'All'}</span>
        {mine && dirty && (
          <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-accent" />
        )}
      </button>
    )
  }
  return (
    <div className="relative flex min-h-11 items-center gap-2 border-hair border-b px-7">
      {picker}
      <fieldset className="scroll-quiet m-0 flex min-w-0 gap-1 overflow-x-auto border-0 p-0">
        <legend className="sr-only">Saved lists</legend>
        {links
          ? links.map((l) => (
              <a
                key={l.key}
                href={l.href}
                aria-current={l.sel ? 'page' : undefined}
                className={cn(
                  'flex h-7 shrink-0 items-center gap-1.5 rounded-full px-3 text-md',
                  l.sel
                    ? 'bg-accent-soft font-medium text-ink'
                    : 'text-ink-2 hover:bg-hover hover:text-ink',
                )}
              >
                {l.label}
                {l.count !== undefined && (
                  <span className="text-ink-3 text-sm tabular-nums">{l.count}</span>
                )}
              </a>
            ))
          : ordered.map((v) => pill(v))}
      </fieldset>
      {keeps && !links && (
        <button
          ref={plusAt}
          type="button"
          aria-label="New list"
          data-tip="New list, from what shows now"
          onClick={() => setNaming({ at: plusAt })}
          className="grid size-7 shrink-0 place-items-center rounded-full text-ink-3 hover:bg-hover hover:text-ink"
        >
          <Plus className="size-3.5" />
        </button>
      )}
      {dirty && (
        <>
          <Button size="sm" variant="ghost" onClick={onReset} data-tip="Go back to what was saved">
            Cancel
          </Button>
          {!keeps ? null : view ? (
            <span ref={saveAt} className="flex shrink-0">
              <Button
                size="sm"
                variant="primary"
                className="rounded-r-none"
                onClick={onSave}
                data-tip="Everyone sees the change"
              >
                Save
              </Button>
              <Button
                size="sm"
                variant="primary"
                className="rounded-l-none border-l-accent-ink/30 px-1.25"
                aria-haspopup="menu"
                aria-expanded={saving}
                aria-label="More ways to save"
                data-tip="More ways to save"
                onClick={() => setSaving((o) => !o)}
              >
                <ChevronDown className="size-3.5" />
              </Button>
            </span>
          ) : (
            <span ref={saveAt} className="flex shrink-0">
              <Button size="sm" variant="primary" onClick={() => setNaming({ at: saveAt })}>
                Save as list
              </Button>
            </span>
          )}
        </>
      )}
      {problem && <span className="min-w-0 truncate text-bad text-sm">{problem}</span>}
      <span className="ml-auto flex shrink-0 items-center gap-1">
        {tools}
        {right}
      </span>
      <Popover anchor={saveAt} open={saving} onClose={() => setSaving(false)} align="end">
        <MenuItem
          onClick={() => {
            setSaving(false)
            setNaming({ at: saveAt })
          }}
        >
          <CopyPlus className="size-3.5 text-ink-3" />
          Save as new list
        </MenuItem>
      </Popover>
      <Popover point={onList.point} open={onList.open} onClose={onList.close}>
        {actions}
      </Popover>
      <Popover anchor={naming?.at ?? plusAt} open={naming !== null} onClose={() => setNaming(null)}>
        <NameForm
          start=""
          label="Save"
          onSave={(name) => {
            setNaming(null)
            onSaveAs(name)
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

// A list's name typed in its own pill: Enter or leaving keeps it, Escape puts it back.
function RenameBox({ start, onDone }: { start: string; onDone: (name: string | null) => void }) {
  const [name, setName] = useState(start)
  return (
    <input
      // biome-ignore lint/a11y/noAutofocus: opened by a double-click on the pill, to type in
      autoFocus
      value={name}
      aria-label="The list’s name, shared with everyone"
      onChange={(e) => setName(e.target.value)}
      onFocus={(e) => e.currentTarget.select()}
      onBlur={() => onDone(name.trim() || null)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur()
        if (e.key === 'Escape') {
          e.preventDefault()
          onDone(null)
        }
      }}
      style={{ width: `${Math.max(6, name.length + 2)}ch` }}
      className="h-7 max-w-56 shrink-0 rounded-full border border-accent-line bg-surface px-3 font-medium text-ink text-md outline-none"
    />
  )
}

export function NameForm({
  start,
  label,
  about = 'The list’s name, shared with everyone',
  onSave,
}: {
  start: string
  label: string
  about?: string
  onSave: (name: string) => void
}) {
  const [name, setName] = useState(start)
  const save = (e: FormEvent) => {
    e.preventDefault()
    if (name.trim()) onSave(name.trim())
  }
  return (
    <form onSubmit={save} className="flex w-64 flex-col gap-2 p-1.5">
      <span className="text-ink-2 text-sm">{about}</span>
      <Field
        autoFocus
        value={name}
        placeholder="Fits, Georgia, This week…"
        onChange={(e) => setName(e.target.value)}
        aria-label={about}
      />
      <div className="flex gap-2">
        <Button type="submit" size="sm" variant="primary" disabled={!name.trim()}>
          {label}
        </Button>
      </div>
    </form>
  )
}
