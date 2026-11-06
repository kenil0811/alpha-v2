// A table's toolbar, two rows (Vikas, 1–2 Nov). First the lists: All, then each saved list, shared
// by everyone, as pills that wrap, the one on screen lit, ★ on the one the table opens on, + to add
// one; at that row's right Save and Cancel while the list on screen differs from what was saved,
// then the table's one main action (`main`, New). Under it the view, search running up to Filter
// (`tools`), then Columns and ⋮ (`right`). The list's own actions are on a right-click of its pill
// (picking it first): rename, duplicate, open the table on it, delete; a double-click renames.
import type { SavedView } from '@alpha/core/api'
import { Plus, Star } from 'lucide-react'
import { type FormEvent, type ReactNode, useRef, useState } from 'react'
import { Button } from '../ui/button.tsx'
import { cn } from '../ui/cn.ts'
import { Confirm } from '../ui/dialog.tsx'
import { Field } from '../ui/field.tsx'
import { MenuItem, MenuLine, Popover, useContextMenu } from '../ui/popover.tsx'

export function ViewTabs({
  tools,
  right,
  main,
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
  tools: ReactNode // the view, search and filter, under the lists
  right: ReactNode // Columns and ⋮, after Filter
  main: ReactNode // the table's one main action (New), at the lists' right
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
}) {
  const [removing, setRemoving] = useState(false) // Delete the list asks first, in the pop-up
  const [naming, setNaming] = useState<'new' | 'rename' | null>(null)
  const lit = useRef<HTMLButtonElement>(null)
  const plus = useRef<HTMLButtonElement>(null)
  const onList = useContextMenu()
  const view = views.find((v) => v.id === current)
  const close = onList.close
  const allReason = view ? undefined : 'All keeps its name and stays.'
  const mark = views.find((v) => v.isDefault) // the list the table opens on; none, All
  const starred = (v: SavedView | null) => (v ? v.isDefault : !mark)
  return (
    <div className="border-hair border-b px-7">
      <div className="flex items-start gap-2 pt-2">
        <div
          role="toolbar"
          aria-label="Saved lists"
          className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5"
        >
          {[null, ...views].map((v) => {
            const on = (v?.id ?? null) === current
            const pick = () => onPick(v?.id ?? null)
            return (
              <button
                key={v?.id ?? 'all'}
                ref={on ? lit : undefined}
                type="button"
                aria-pressed={on}
                data-tip={
                  v
                    ? 'Double-click to rename it; right-click to rename, duplicate or delete it'
                    : 'Every row; right-click to duplicate it as a list'
                }
                onClick={() => !on && pick()}
                onDoubleClick={() => on && v && setNaming('rename')}
                onContextMenu={(e) => {
                  if (!on) pick()
                  onList.on.onContextMenu(e)
                }}
                onKeyDown={(e) => {
                  if (!on && ((e.shiftKey && e.key === 'F10') || e.key === 'ContextMenu')) pick()
                  onList.on.onKeyDown(e)
                }}
                className={cn(
                  'flex h-7.5 max-w-60 items-center gap-1.5 rounded-full border px-3 text-md',
                  on
                    ? 'border-accent-line bg-accent-soft text-accent'
                    : 'border-line bg-surface text-ink-2 hover:border-accent-line hover:text-ink',
                )}
              >
                {starred(v) && views.length > 0 && (
                  <Star
                    className="size-3 shrink-0 fill-current"
                    aria-label="The table opens on it"
                  />
                )}
                <span className="truncate">{v?.name ?? 'All'}</span>
                {on && dirty && (
                  <span
                    aria-hidden="true"
                    className="size-1.5 shrink-0 rounded-full bg-accent"
                    title="Changed since it was saved"
                  />
                )}
              </button>
            )
          })}
          <button
            ref={plus}
            type="button"
            aria-label="Add list"
            data-tip="Add list: keep what is on screen as a new list"
            onClick={() => setNaming('new')}
            className="grid size-7.5 shrink-0 place-items-center rounded-full text-ink-3 hover:bg-hover hover:text-ink"
          >
            <Plus className="size-3.5" />
          </button>
        </div>
        <span className="flex shrink-0 items-center gap-1">
          {problem && <span className="max-w-60 truncate text-bad text-sm">{problem}</span>}
          {dirty && (
            <>
              <Button size="sm" variant="ghost" onClick={onReset} title="Go back to what was saved">
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={() => (view ? onSave() : setNaming('new'))}
                data-tip={
                  view ? `Save the changes to ${view.name}` : 'Keep what is on screen as a new list'
                }
              >
                {view ? 'Save' : 'Save as list'}
              </Button>
            </>
          )}
          {main}
        </span>
      </div>
      <div className="flex min-h-11 items-center gap-2">
        {tools}
        {right}
      </div>
      <Popover point={onList.point} open={onList.open} onClose={onList.close}>
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
          checked={starred(view ?? null)}
          reason={
            view
              ? undefined
              : mark
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
      </Popover>
      <Popover
        anchor={naming === 'rename' ? lit : plus}
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
