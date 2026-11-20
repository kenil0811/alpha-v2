// A table's toolbar, one row that never wraps, in this order: the saved lists as pills (the one the
// table opens on first, then All and each list, shared by everyone; the picked one filled; as many
// as fit, the rest behind ▾ with the picked list's own actions and Add list), Cancel and Save while
// the list on screen differs from what was saved (Save ▾ Save as new list keeps a shared list as it
// was), the view, search and filter (`tools`), and on the right the table's actions (`right`). A
// list's own actions sit behind ▾ and on a right-click of its pill: rename, duplicate, open the
// table on it, delete. Resting on a pill says what the list holds. A list Alpha keeps itself
// (people, tasks) holds no saved lists, so it shows neither Save nor ▾, and Cancel alone.
import type { FieldView, SavedView } from '@alpha/core/api'
import { ChevronDown, CopyPlus, List, PencilLine, Plus, Star, Trash2 } from 'lucide-react'
import {
  type FormEvent,
  type ReactNode,
  type RefObject,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import { Button } from '../ui/button.tsx'
import { cn } from '../ui/cn.ts'
import { Confirm } from '../ui/dialog.tsx'
import { Field } from '../ui/field.tsx'
import { MenuHeading, MenuItem, MenuLine, Popover, useContextMenu } from '../ui/popover.tsx'
import { listWords } from './list-words.ts'

const PILL_GAP = 4 // the pills' gap-1
const LINE_GAP = 8 // the line's gap-2

export function ViewTabs({
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
  tools: ReactNode // the view, search and filter, after the saved lists
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
  const [more, setMore] = useState(false) // ▾: the lists that don't fit, the list's actions
  const [saving, setSaving] = useState(false) // Save ▾
  const [removing, setRemoving] = useState(false) // Delete the list asks first, in the pop-up
  const [naming, setNaming] = useState<{
    kind: 'new' | 'rename'
    at: RefObject<HTMLElement | null>
  } | null>(null)
  const line = useRef<HTMLDivElement>(null)
  const pills = useRef<HTMLFieldSetElement>(null)
  const measure = useRef<HTMLDivElement>(null)
  const picked = useRef<HTMLButtonElement>(null)
  const moreAt = useRef<HTMLButtonElement>(null)
  const saveAt = useRef<HTMLSpanElement>(null)
  const onList = useContextMenu()
  const view = views.find((v) => v.id === current)
  const close = () => {
    setMore(false)
    onList.close()
  }
  const allReason = view ? undefined : 'All keeps its name and stays.'
  const mark = views.find((v) => v.isDefault) // the list the table opens on; none, All
  const starred = (v: SavedView | null) => (v ? v.isDefault : !mark)
  const ordered = [null, ...views].sort((a, b) => Number(starred(b)) - Number(starred(a)))

  // as many pills as fit in what the line leaves them; the picked one always among them
  const [fit, setFit] = useState(ordered.length)
  const [, setWidth] = useState(0) // a new width measures again
  useLayoutEffect(() => {
    const el = line.current
    if (!el) return
    const watch = new ResizeObserver(() => setWidth(el.clientWidth))
    watch.observe(el)
    return () => watch.disconnect()
  }, [])
  useLayoutEffect(() => {
    const el = line.current
    const box = pills.current
    if (!el || !box || !measure.current) return
    const pad = Number.parseFloat(getComputedStyle(el).paddingLeft) * 2
    const others = [...el.children].filter((c) => c !== box && c !== measure.current)
    const taken = others.reduce((sum, c) => sum + (c as HTMLElement).offsetWidth + LINE_GAP, 0)
    const room = el.clientWidth - pad - taken - 4
    let used = 0
    let n = 0
    for (const c of measure.current.children) {
      const add = (n ? PILL_GAP : 0) + (c as HTMLElement).offsetWidth
      if (used + add > room) break
      used += add
      n++
    }
    const next = Math.max(1, n)
    if (next !== fit) setFit(next)
  })
  let shown = ordered.slice(0, fit)
  const here = ordered.find((v) => (v?.id ?? null) === current)
  if (here !== undefined && !shown.includes(here)) shown = [...shown.slice(0, fit - 1), here]
  const rest = ordered.filter((v) => !shown.includes(v))

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
  const rename = () => setNaming({ kind: 'rename', at: picked })

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
        <Star className="size-3.5 text-ink-3" />
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
        <Trash2 className="size-3.5" />
        Delete list
      </MenuItem>
    </>
  )
  const pill = (v: SavedView | null, ghost = false) => {
    const mine = (v?.id ?? null) === current
    return (
      <button
        key={v?.id ?? 'all'}
        ref={mine && !ghost ? picked : undefined}
        type="button"
        tabIndex={ghost ? -1 : undefined}
        aria-pressed={mine}
        data-tip={ghost ? undefined : tipOf(v)}
        onClick={() => onPick(v?.id ?? null)}
        onDoubleClick={() => mine && v && rename()}
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
    <div ref={line} className="relative flex min-h-11 items-center gap-2 border-hair border-b px-7">
      {/* every pill at its own width, out of sight, to know how many fit */}
      <div
        ref={measure}
        aria-hidden="true"
        className="pointer-events-none invisible absolute top-0 left-0 flex gap-1"
      >
        {ordered.map((v) => pill(v, true))}
      </div>
      <fieldset ref={pills} className="m-0 flex min-w-0 gap-1 border-0 p-0">
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
          : shown.map((v) => pill(v))}
      </fieldset>
      {keeps && (
        <button
          ref={moreAt}
          type="button"
          aria-haspopup="menu"
          aria-expanded={more}
          aria-label={rest.length ? `${rest.length} more saved lists` : 'Saved lists'}
          data-tip={rest.length ? `${rest.length} more` : 'Saved lists'}
          onClick={() => setMore((o) => !o)}
          className="-ml-1 flex h-7 shrink-0 items-center gap-0.5 rounded-full px-1.5 text-ink-3 text-sm hover:bg-hover hover:text-ink"
        >
          {rest.length > 0 && <span className="tabular-nums">{rest.length}</span>}
          <ChevronDown className="size-3.5" />
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
              <Button
                size="sm"
                variant="primary"
                onClick={() => setNaming({ kind: 'new', at: saveAt })}
              >
                Save as list
              </Button>
            </span>
          )}
        </>
      )}
      {tools}
      {problem && <span className="min-w-0 truncate text-bad text-sm">{problem}</span>}
      <span className="ml-auto flex shrink-0 items-center gap-1">{right}</span>
      <Popover anchor={moreAt} open={more} onClose={() => setMore(false)}>
        {rest.length > 0 && (
          <>
            <MenuHeading>More lists</MenuHeading>
            {rest.map((v) => (
              <MenuItem
                key={v?.id ?? 'all'}
                tip={tipOf(v)}
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
                  setMore(false)
                  onPick(v?.id ?? null)
                }}
              >
                <List className="size-3.5 text-ink-3" />
                {v?.name ?? 'All'}
              </MenuItem>
            ))}
            <MenuLine />
          </>
        )}
        <MenuHeading>{view?.name ?? 'All'}</MenuHeading>
        {actions}
        <MenuLine />
        <MenuItem
          onClick={() => {
            setMore(false)
            setNaming({ kind: 'new', at: moreAt })
          }}
        >
          <Plus className="size-3.5 text-ink-3" />
          Add list
        </MenuItem>
      </Popover>
      <Popover anchor={saveAt} open={saving} onClose={() => setSaving(false)} align="end">
        <MenuItem
          onClick={() => {
            setSaving(false)
            setNaming({ kind: 'new', at: saveAt })
          }}
        >
          <CopyPlus className="size-3.5 text-ink-3" />
          Save as new list
        </MenuItem>
      </Popover>
      <Popover point={onList.point} open={onList.open} onClose={onList.close}>
        {actions}
      </Popover>
      <Popover anchor={naming?.at ?? moreAt} open={naming !== null} onClose={() => setNaming(null)}>
        <NameForm
          start={naming?.kind === 'rename' ? (view?.name ?? '') : ''}
          label={naming?.kind === 'rename' ? 'Rename' : 'Save'}
          onSave={(name) => {
            const kind = naming?.kind
            setNaming(null)
            if (kind === 'rename') onRename(name)
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
