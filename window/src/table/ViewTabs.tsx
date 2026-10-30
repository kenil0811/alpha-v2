// A table's toolbar, one row that never wraps, in this order: the lists dropdown, the view, search
// and filter (`tools`), and on the right the table's actions, ⋮ and the numbers' chevron (`right`).
// The dropdown, named for the list on screen, holds every list there is to choose (Vikas, 30 Oct):
// All and the saved lists, ★ on hover making one the default, then the values of the table's list
// choice (Clients, Insurers, Leads, My team), each in its own colour with its count; a search past
// six and Add new… at its foot. A list's own actions (rename, duplicate, open the table on it,
// delete) are on a right-click of the dropdown or of the list's line in it, never in the dropdown;
// nothing repeats the lists under the toolbar. Save and Cancel, while the list on screen differs
// from what was saved, sit beside New (`saveAt`; Vikas, 27 Oct).
import type { SavedView } from '@alpha/core/api'
import { ChevronDown, Plus, Search } from 'lucide-react'
import {
  type FormEvent,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
  useRef,
  useState,
} from 'react'
import { createPortal } from 'react-dom'
import { Button } from '../ui/button.tsx'
import { Confirm } from '../ui/dialog.tsx'
import { Field } from '../ui/field.tsx'
import { Choice, type Choices } from '../ui/pill.tsx'
import { MenuItem, MenuLine, Popover, useContextMenu } from '../ui/popover.tsx'

// the values of the table's list choice, as lists: Clients, Insurers…
export type QuickLists = {
  of: Choices
  items: { value: string; count: number }[]
  on: string | undefined // the one on screen
  pick: (value: string) => void
  keep: (value: string) => void // kept as a saved list of its own
}

export function ViewTabs({
  tools,
  right,
  views,
  counts,
  quick,
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
  tools: ReactNode // the view, search and filter, after the lists dropdown
  right: ReactNode // the table's own actions, ⋮ and the chevron, at the right end
  views: SavedView[]
  counts: (id: string | null) => number // the rows a list holds; null is All
  quick: QuickLists | null
  current: string | null
  dirty: boolean
  problem: string | null
  onPick: (id: string | null) => void
  onSave: () => void
  onSaveAs: (name: string, from?: string | null) => void // from: a list's id (null, All); none, the screen
  onRename: (id: string, name: string) => void
  onDefault: (id: string, on: boolean) => void // the core keeps the list the table opens on
  onRemove: (id: string) => void
  onReset: () => void
  saveAt: HTMLElement | null // where Save and Cancel go: beside New
}) {
  const [open, setOpen] = useState(false)
  const [words, setWords] = useState('')
  // the list a right-click acts on: a saved list, All (null), or a value of the list choice
  const [target, setTarget] = useState<SavedView | null | { value: string }>(null)
  const [removing, setRemoving] = useState<SavedView | null>(null) // asked first, in the pop-up
  const [naming, setNaming] = useState<'new' | SavedView | null>(null)
  const picker = useRef<HTMLButtonElement>(null)
  const saver = useRef<HTMLButtonElement>(null)
  const menu = useContextMenu()
  const view = views.find((v) => v.id === current)
  const name = quick?.on ?? view?.name ?? 'All'
  const close = () => {
    setOpen(false)
    setWords('')
    menu.close()
  }
  const mark = views.find((v) => v.isDefault) // the list the table opens on; none, All
  const starred = (v: SavedView | null) => (v ? v.isDefault : !mark)
  const hit = (n: string) => n.toLowerCase().includes(words.trim().toLowerCase())
  const lists = [null, ...views]
    .sort((a, b) => Number(starred(b)) - Number(starred(a)))
    .filter((v) => hit(v?.name ?? 'All'))
  const values = (quick?.items ?? []).filter((q) => hit(q.value))
  const many = views.length + 1 + (quick?.items.length ?? 0) > 6
  // a right-click on the dropdown, or on a line in it, opens that list's actions
  const rightClick = (t: SavedView | null | { value: string }) => ({
    onContextMenu: (e: MouseEvent) => {
      setTarget(t)
      menu.on.onContextMenu(e)
    },
    onKeyDown: (e: KeyboardEvent) => {
      setTarget(t)
      menu.on.onKeyDown(e)
    },
  })
  const t = target && 'value' in target ? null : target // the saved list acted on; null, All
  const actions =
    target && 'value' in target ? (
      <MenuItem
        onClick={() => {
          close()
          quick?.keep(target.value)
        }}
      >
        Keep {target.value} as a saved list
      </MenuItem>
    ) : (
      <>
        <MenuItem
          reason={t ? undefined : 'All keeps its name and stays.'}
          onClick={() => {
            close()
            if (t) setNaming(t)
          }}
        >
          Rename list…
        </MenuItem>
        <MenuItem
          onClick={() => {
            close()
            // the list on screen is duplicated as it is now; another as it was saved
            onSaveAs(
              `${t?.name ?? 'All'} (copy)`,
              (t?.id ?? null) === current ? undefined : (t?.id ?? null),
            )
          }}
        >
          Duplicate list
        </MenuItem>
        <MenuItem
          checked={starred(t)}
          reason={
            t
              ? undefined
              : mark
                ? 'Open another list on its own default to change it.'
                : 'The table already opens on All.'
          }
          onClick={() => {
            close()
            if (t) onDefault(t.id, !t.isDefault)
          }}
        >
          Open the table on this list
        </MenuItem>
        <MenuLine />
        <MenuItem
          danger
          reason={t ? undefined : 'All keeps its name and stays.'}
          onClick={() => {
            close()
            if (t) setRemoving(t)
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
        aria-label={`List: ${name}`}
        data-tip="The lists: right-click to rename, duplicate or delete this one"
        onClick={() => (open ? close() : setOpen(true))}
        onDoubleClick={() => {
          if (!view || quick?.on) return
          close()
          setNaming(view)
        }}
        {...rightClick(quick?.on ? { value: quick.on } : (view ?? null))}
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
      <Popover anchor={picker} open={open} onClose={close}>
        <div className="flex max-h-96 min-w-52 flex-col">
          {many && (
            <label className="mb-1 flex items-center gap-1.5 border-line border-b px-2 pb-1.5">
              <Search className="size-3.25 text-ink-3" />
              <input
                // biome-ignore lint/a11y/noAutofocus: the list was opened to choose; typing narrows it
                autoFocus
                value={words}
                onChange={(e) => setWords(e.target.value)}
                placeholder="Search lists"
                aria-label="Search lists"
                className="min-w-0 flex-1 bg-transparent text-ink text-md outline-none placeholder:text-ink-3"
              />
            </label>
          )}
          <div role="menu" className="overflow-y-auto">
            {lists.map((v) => (
              <div key={v?.id ?? 'all'} {...rightClick(v)}>
                <MenuItem
                  checked={!quick?.on && (v?.id ?? null) === current}
                  hint={counts(v?.id ?? null).toLocaleString()}
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
                    close()
                    onPick(v?.id ?? null)
                  }}
                >
                  {v?.name ?? 'All'}
                </MenuItem>
              </div>
            ))}
            {values.length > 0 && <MenuLine />}
            {values.map((q) => (
              <div key={q.value} {...rightClick({ value: q.value })}>
                <MenuItem
                  checked={quick?.on === q.value}
                  hint={q.count.toLocaleString()}
                  onClick={() => {
                    close()
                    quick?.pick(q.value)
                  }}
                >
                  <Choice of={quick?.of} value={q.value} />
                </MenuItem>
              </div>
            ))}
            {lists.length + values.length === 0 && (
              <p className="px-2.5 py-1.5 text-ink-3 text-md">No match.</p>
            )}
          </div>
          <MenuLine />
          <MenuItem
            onClick={() => {
              close()
              setNaming('new')
            }}
          >
            <Plus className="size-3.5 text-ink-3" />
            Add new…
          </MenuItem>
        </div>
      </Popover>
      <Popover point={menu.point} open={menu.open} onClose={menu.close}>
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
          start={naming && naming !== 'new' ? naming.name : ''}
          label={naming && naming !== 'new' ? 'Rename' : 'Save'}
          onSave={(name) => {
            setNaming(null)
            if (naming && naming !== 'new') onRename(naming.id, name)
            else onSaveAs(name)
          }}
        />
      </Popover>
      <Confirm
        open={!!removing}
        title={`Delete ${removing?.name} for everyone?`}
        yes="Delete list"
        onClose={() => setRemoving(null)}
        onYes={() => {
          if (removing) onRemove(removing.id)
          setRemoving(null)
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
