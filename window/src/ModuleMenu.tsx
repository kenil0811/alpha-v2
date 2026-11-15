// A module's menu in the rail, on ⋮ or a right-click, and the modules hidden from the rail. Out
// of Shell.tsx, which holds the rail itself.
import type { ModuleSummary } from '@alpha/core/api'
import {
  CornerLeftUp,
  EllipsisVertical,
  EyeOff,
  FolderInput,
  PanelRightOpen,
  PencilLine,
  Trash2,
} from 'lucide-react'
import { useRef, useState } from 'react'
import { api } from './api.ts'
import { DeleteModule } from './DeleteModule.tsx'
import { ModuleIcon } from './moduleIcon.tsx'
import { flat, inside, landingOf, tops } from './tree.ts'
import { cn } from './ui/cn.ts'
import { MenuItem, MenuLine, Popover, SubMenu } from './ui/popover.tsx'

// Modules hidden from the rail, with the modules inside them, kept per person by the core like the
// rail's folds. A hidden one still opens by its link and by Find.
export type Hiding = { hidden: string[]; set: (ids: string[]) => void }

export const shownTops = (modules: ModuleSummary[], hidden: string[]) =>
  tops(modules).filter((m) => !hidden.includes(m.id))

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

// A module's menu: Open, Move to › every other module it may sit inside (never itself or one of its
// own) or the top, Hide, Hidden modules ›, and Delete
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
  const [problem, setProblem] = useState<string | null>(null)
  const anchor = useRef<HTMLButtonElement>(null)
  const own = new Set(inside(modules, m.id))
  const close = () => {
    setOpen(false)
    onShut()
  }
  const move = async (within: string | null) => {
    try {
      await api.post(`/api/modules/${m.id}/place`, { within })
      close()
    } catch (err) {
      setProblem(err instanceof Error ? err.message : 'That did not move.')
    }
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
          setProblem(null)
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
        <MenuItem
          onClick={() => {
            window.location.hash = landingOf(modules, m)
            close()
          }}
        >
          <PanelRightOpen className="size-3.5 text-ink-3" />
          Open
        </MenuItem>
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
        <SubMenu
          label={
            <>
              <FolderInput className="size-3.5 text-ink-3" />
              Move to
            </>
          }
        >
          {flat(modules)
            .filter(({ module }) => !own.has(module.id))
            .map(({ module, depth }) => (
              <MenuItem
                key={module.id}
                checked={m.parent === module.id}
                onClick={() => move(module.id)}
              >
                <span
                  className={cn(
                    'flex min-w-0 items-center gap-2',
                    depth === 1 && 'pl-3',
                    depth > 1 && 'pl-6',
                  )}
                >
                  <ModuleIcon name={module.name} className="size-3.5 shrink-0 text-ink-3" />
                  {module.name}
                </span>
              </MenuItem>
            ))}
          <MenuLine />
          <MenuItem checked={!m.parent} onClick={() => move(null)}>
            <CornerLeftUp className="size-3.5 text-ink-3" />
            Top level
          </MenuItem>
        </SubMenu>
        <MenuItem
          onClick={() => {
            hiding.set([...hiding.hidden, m.id])
            close()
          }}
          reason={last ? 'The last module in the rail stays' : undefined}
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
        {problem && <p className="max-w-60 px-2.5 py-1.5 text-bad text-sm">{problem}</p>}
      </Popover>
      <DeleteModule module={m} open={deleting} onClose={() => setDeleting(false)} />
    </>
  )
}
