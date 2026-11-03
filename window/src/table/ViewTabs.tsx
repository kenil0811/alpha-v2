// A table's two rows above its rows (Vikas, 2 Nov). First the lists, spread out left to right: All
// and the saved lists (★ the one the table opens on), then the values of the table's list choice
// (Brokers, Sellers, Lenders…), each with its count, the one on screen lit, and + to keep what is
// on screen as a new list; at that row's right the table's actions: New, Save and Cancel while the
// list differs from what was saved (`saveAt`), Sync now. A list's own actions (rename, duplicate,
// open the table on it, delete) are on its right-click; a double-click renames. Under it the
// toolbar: the view, search and filter (`tools`), and Filter and ⋮ on the right (`right`).
import type { SavedView } from '@alpha/core/api'
import { Plus } from 'lucide-react'
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
import { cn } from '../ui/cn.ts'
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
  actions,
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
  right: ReactNode // the view's own tools, Filter and ⋮, at the right of the toolbar
  actions: ReactNode // the table's actions (New, Save and Cancel, Sync now), right of the lists
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
  saveAt: HTMLElement | null // where Save and Cancel go: beside New, in the lists row
}) {
  // the list a right-click acts on: a saved list, All (null), or a value of the list choice
  const [target, setTarget] = useState<SavedView | null | { value: string }>(null)
  const [removing, setRemoving] = useState<SavedView | null>(null) // asked first, in the pop-up
  const [naming, setNaming] = useState<'new' | SavedView | null>(null)
  const picker = useRef<HTMLButtonElement>(null)
  const saver = useRef<HTMLButtonElement>(null)
  const menu = useContextMenu()
  const view = views.find((v) => v.id === current)
  const close = () => menu.close()
  const mark = views.find((v) => v.isDefault) // the list the table opens on; none, All
  const starred = (v: SavedView | null) => (v ? v.isDefault : !mark)
  const lists = [null, ...views].sort((a, b) => Number(starred(b)) - Number(starred(a)))
  const values = quick?.items ?? []
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
  const listMenu =
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
  // a list as a pill in the lists row: left-aligned, the one on screen lit
  const pill = (
    key: string,
    on: boolean,
    label: ReactNode,
    n: number,
    props: object,
    pick: () => void,
    tip?: string,
  ) => (
    <button
      key={key}
      type="button"
      aria-pressed={on}
      data-tip={tip}
      onClick={pick}
      {...props}
      className={cn(
        'flex h-7 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-md',
        on ? 'bg-accent-soft font-medium text-accent' : 'text-ink-2 hover:bg-hover hover:text-ink',
      )}
    >
      {label}
      <span className={cn('text-sm tabular-nums', on ? 'text-accent' : 'text-ink-3')}>
        {n.toLocaleString()}
      </span>
      {on && dirty && (
        <span
          aria-hidden="true"
          className="size-1.5 rounded-full bg-accent"
          title="Changed since it was saved"
        />
      )}
    </button>
  )
  return (
    <div className="border-hair border-b">
      {/* the lists, spread out in a row of their own above search and filter, the one on screen
          lit; the table's actions at the row's right (Vikas, 2 Nov) */}
      <div className="flex min-h-11 items-center gap-2 border-hair border-b px-7">
        <div
          role="tablist"
          aria-label="Lists"
          className="-mx-1 flex min-w-0 flex-1 flex-wrap items-center gap-0.5 px-1 py-1.5"
        >
          {lists.map((v) =>
            pill(
              v?.id ?? 'all',
              !quick?.on && (v?.id ?? null) === current,
              <>
                {starred(v) && (
                  <span title="Opens on this list" className="text-accent">
                    ★
                  </span>
                )}
                {v?.name ?? 'All'}
              </>,
              counts(v?.id ?? null),
              {
                ...rightClick(v),
                onDoubleClick: () => v && setNaming(v),
              },
              () => onPick(v?.id ?? null),
              'Right-click to rename, duplicate, open the table on it or delete',
            ),
          )}
          {values.map((q) =>
            pill(
              q.value,
              quick?.on === q.value,
              <Choice of={quick?.of} value={q.value} />,
              q.count,
              rightClick({ value: q.value }),
              () => quick?.pick(q.value),
            ),
          )}
          <button
            ref={picker}
            type="button"
            aria-label="Add a list"
            data-tip="Keep what is on screen as a new list"
            onClick={() => setNaming('new')}
            className="grid size-7 shrink-0 place-items-center rounded-md text-ink-3 hover:bg-hover hover:text-ink"
          >
            <Plus className="size-3.5" />
          </button>
        </div>
        <span className="flex shrink-0 items-center gap-1">{actions}</span>
      </div>
      <div className="flex min-h-11 items-center gap-2 px-7">
        {tools}
        {problem && <span className="min-w-0 truncate text-bad text-sm">{problem}</span>}
        <span className="ml-auto flex shrink-0 items-center gap-1">{right}</span>
      </div>
      <Popover point={menu.point} open={menu.open} onClose={menu.close}>
        {listMenu}
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
