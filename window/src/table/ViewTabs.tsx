// A table's toolbar, one row that never wraps: its saved views as tabs (the saved list), then the
// table's own controls on the right. The saved views: All, then each view, shared by everyone. A
// dot shows when the open view differs from what was saved; its menu saves, saves as new,
// renames, makes it the view the table opens on, or removes it.
import type { SavedView } from '@alpha/core/api'
import { ChevronDown, Plus } from 'lucide-react'
import { type FormEvent, type ReactNode, useRef, useState } from 'react'
import { Button } from '../ui/button.tsx'
import { cn } from '../ui/cn.ts'
import { Confirm } from '../ui/dialog.tsx'
import { Field } from '../ui/field.tsx'
import { MenuItem, MenuLine, Popover } from '../ui/popover.tsx'

export function ViewTabs({
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
  right: ReactNode // the table's own controls, on the right of the tabs
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
  const [menu, setMenu] = useState(false)
  const [removing, setRemoving] = useState(false) // Delete the view asks first, in the pop-up
  const [naming, setNaming] = useState<'new' | 'rename' | null>(null)
  const closeMenu = () => setMenu(false)
  const menuAnchor = useRef<HTMLButtonElement>(null)
  const newAnchor = useRef<HTMLButtonElement>(null)
  const view = views.find((v) => v.id === current)
  const tab = (id: string | null, name: string, isDefault = false) => {
    const sel = id === current
    return (
      <div key={id ?? 'all'} className="flex items-center">
        <button
          type="button"
          onClick={() => onPick(id)}
          title={isDefault ? 'The table opens on this view' : undefined}
          className={cn(
            'flex h-11 items-center gap-1.5 whitespace-nowrap border-b-2 px-2 text-md',
            sel
              ? 'border-accent font-medium text-ink'
              : 'border-transparent text-ink-2 hover:text-ink',
          )}
        >
          {name}
          {sel && dirty && (
            <span
              aria-hidden="true"
              className="size-1.5 rounded-full bg-accent"
              title="Changed since it was saved"
            />
          )}
        </button>
        {sel && (id !== null || dirty) && (
          <button
            ref={menuAnchor}
            type="button"
            aria-label={`${name}: save, rename and more`}
            onClick={() => (menu ? closeMenu() : setMenu(true))}
            className="grid size-6 place-items-center rounded-sm text-ink-3 hover:bg-hover hover:text-ink"
          >
            <ChevronDown className="size-3.5" />
          </button>
        )}
      </div>
    )
  }
  return (
    <div className="flex min-h-11 items-center gap-1 border-hair border-b pr-7 pl-5">
      <div className="scroll-quiet flex min-w-0 items-center gap-1 overflow-x-auto overflow-y-hidden">
        {tab(null, 'All')}
        {views.map((v) => tab(v.id, v.name, v.isDefault))}
        <button
          ref={newAnchor}
          type="button"
          onClick={() => setNaming('new')}
          className="ml-1 flex h-7 items-center gap-1 whitespace-nowrap rounded-md px-2 text-ink-3 text-md hover:bg-hover hover:text-ink"
        >
          <Plus className="size-3.5" />
          Save as a view
        </button>
      </div>
      {problem && <span className="ml-2 min-w-0 truncate text-bad text-sm">{problem}</span>}
      <span className="ml-auto flex shrink-0 items-center gap-2">{right}</span>
      <Popover anchor={menuAnchor} open={menu} onClose={closeMenu}>
        {view ? (
          <>
            <MenuItem
              reason={dirty ? undefined : 'Nothing has changed since it was saved.'}
              onClick={() => {
                setMenu(false)
                onSave()
              }}
            >
              Save the changes to {view.name}
            </MenuItem>
            <MenuItem
              onClick={() => {
                setMenu(false)
                setNaming('new')
              }}
            >
              Save as a new view…
            </MenuItem>
            {dirty && (
              <MenuItem
                onClick={() => {
                  setMenu(false)
                  onReset()
                }}
              >
                Go back to what was saved
              </MenuItem>
            )}
            <MenuLine />
            <MenuItem
              onClick={() => {
                setMenu(false)
                setNaming('rename')
              }}
            >
              Rename…
            </MenuItem>
            <MenuItem
              checked={view.isDefault}
              onClick={() => {
                setMenu(false)
                onDefault(!view.isDefault)
              }}
            >
              Open the table on this view
            </MenuItem>
            <MenuLine />
            <MenuItem
              danger
              onClick={() => {
                setMenu(false)
                setRemoving(true)
              }}
            >
              Delete the view
            </MenuItem>
          </>
        ) : (
          <>
            <MenuItem
              onClick={() => {
                setMenu(false)
                setNaming('new')
              }}
            >
              Save as a view…
            </MenuItem>
            <MenuItem
              onClick={() => {
                setMenu(false)
                onReset()
              }}
            >
              Clear the filters, sorts and columns
            </MenuItem>
          </>
        )}
      </Popover>
      <Popover
        anchor={naming === 'rename' ? menuAnchor : newAnchor}
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
        yes="Delete the view"
        onClose={() => setRemoving(false)}
        onYes={() => {
          setRemoving(false)
          onRemove()
        }}
      >
        Its filters, sorts and columns go; the rows stay.
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
      <span className="text-ink-2 text-sm">The view’s name, shared with everyone</span>
      <Field
        autoFocus
        value={name}
        placeholder="Fits, Georgia, This week…"
        onChange={(e) => setName(e.target.value)}
        aria-label="The view’s name"
      />
      <div className="flex gap-2">
        <Button type="submit" size="sm" variant="primary" disabled={!name.trim()}>
          {label}
        </Button>
      </div>
    </form>
  )
}
