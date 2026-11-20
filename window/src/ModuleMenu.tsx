// A module's menu in the rail, on ⋮ or a right-click, and the modules hidden from the rail. Out
// of Shell.tsx, which holds the rail itself.
import type { ModuleSummary } from '@alpha/core/api'
import { EllipsisVertical, EyeOff, PencilLine, Pin, PinOff, Trash2 } from 'lucide-react'
import { useRef, useState } from 'react'
import { DeleteModule } from './DeleteModule.tsx'
import { ModuleIcon } from './moduleIcon.tsx'
import { tops } from './tree.ts'
import { cn } from './ui/cn.ts'
import { MenuItem, MenuLine, Popover, SubMenu } from './ui/popover.tsx'

// Modules hidden from the rail, with the modules inside them, kept per person by the core like the
// rail's folds. A hidden one still opens by its link and by Find. Pinned ones sit first, in the
// order pinned; only a module at the top level pins.
export type Hiding = {
  hidden: string[]
  set: (ids: string[]) => void
  pinned: string[]
  pin: (ids: string[]) => void
}

export const shownTops = (modules: ModuleSummary[], hidden: string[], pinned: string[] = []) => {
  const shown = tops(modules).filter((m) => !hidden.includes(m.id))
  const first = pinned.flatMap((id) => shown.filter((m) => m.id === id))
  return [...first, ...shown.filter((m) => !pinned.includes(m.id))]
}

// Hidden modules ›: each one, to bring back; only when any are hidden.
export function HiddenMenu({
  modules,
  hiding,
  onDone,
}: {
  modules: ModuleSummary[]
  hiding: Hiding
  onDone: () => void
}) {
  const gone = modules.filter((m) => hiding.hidden.includes(m.id))
  if (!gone.length) return null
  return (
    <SubMenu
      label={
        <>
          <EyeOff className="size-3.5 text-ink-3" />
          Hidden modules
        </>
      }
    >
      {gone.map((g) => (
        <MenuItem
          key={g.id}
          onClick={() => {
            hiding.set(hiding.hidden.filter((x) => x !== g.id))
            onDone()
          }}
        >
          <ModuleIcon name={g.name} className="size-3.5 shrink-0 text-ink-3" />
          {g.name}
        </MenuItem>
      ))}
    </SubMenu>
  )
}

// A module's menu: Rename, Pin to top or Unpin, Hide, Hidden modules ›, and Delete
export function ModuleMenu({
  m,
  modules,
  hiding,
  point,
  onShut,
  onRename,
}: {
  m: ModuleSummary
  modules: ModuleSummary[]
  hiding: Hiding
  point: { x: number; y: number } | null // a right-click's place
  onShut: () => void
  onRename: (() => void) | undefined // its name edited in place in the rail
}) {
  const [open, setOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const anchor = useRef<HTMLButtonElement>(null)
  const close = () => {
    setOpen(false)
    onShut()
  }
  const shown = shownTops(modules, hiding.hidden)
  const last = shown.length === 1 && shown[0]?.id === m.id
  return (
    <>
      <button
        ref={anchor}
        type="button"
        aria-label={`${m.name} menu`}
        data-tip={`${m.name} menu`}
        onClick={() => {
          setOpen((o) => !o)
        }}
        className={cn(
          'grid size-6 shrink-0 place-items-center rounded-md text-rail-ink-3 opacity-0 hover:text-rail-ink focus-visible:opacity-100 group-hover/item:opacity-100',
          (open || point) && 'opacity-100',
        )}
      >
        <EllipsisVertical className="size-3.5" />
      </button>
      <Popover anchor={anchor} point={point} open={open || !!point} onClose={close}>
        {onRename && (
          <MenuItem
            onClick={() => {
              close()
              onRename()
            }}
          >
            <PencilLine className="size-3.5 text-ink-3" />
            Rename
          </MenuItem>
        )}
        {hiding.pinned.includes(m.id) && !m.parent ? (
          <MenuItem
            onClick={() => {
              hiding.pin(hiding.pinned.filter((x) => x !== m.id))
              close()
            }}
          >
            <PinOff className="size-3.5 text-ink-3" />
            Unpin
          </MenuItem>
        ) : (
          <MenuItem
            onClick={() => {
              hiding.pin([...hiding.pinned.filter((x) => x !== m.id), m.id])
              close()
            }}
            reason={m.parent ? 'Pin the module it sits in' : undefined}
          >
            <Pin className="size-3.5 text-ink-3" />
            Pin to top
          </MenuItem>
        )}
        <MenuItem
          onClick={() => {
            hiding.set([...hiding.hidden, m.id])
            close()
          }}
          reason={last ? 'The last module in the sidebar stays' : undefined}
        >
          <EyeOff className="size-3.5 text-ink-3" />
          Hide
        </MenuItem>
        {modules.some((x) => hiding.hidden.includes(x.id)) && (
          <>
            <MenuLine />
            <HiddenMenu modules={modules} hiding={hiding} onDone={close} />
          </>
        )}
        <MenuLine />
        <MenuItem
          danger
          onClick={() => {
            close()
            setDeleting(true)
          }}
        >
          <Trash2 className="size-3.5" />
          Delete
        </MenuItem>
      </Popover>
      <DeleteModule module={m} open={deleting} onClose={() => setDeleting(false)} />
    </>
  )
}
