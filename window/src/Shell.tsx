// The shell (Vikas, 25 Oct; reverses design §14's rail
// until Kenil says yes): the rail on the left, a 48px bar over every screen and the assistant on
// the right, their headers on one line. The rail has the person's name at its top, Home with a badge
// for what waits on the person, Conversation, Tasks, the modules by name with the modules inside
// them, New module last in the list, and Intelligence and Settings at its foot; no headings and no
// status lines. It folds to a strip of icons. In Alpha's own Mac window its top row leaves room for
// the window buttons.
import type { Layout, ModuleSummary } from '@alpha/core/api'
import {
  ChevronDown,
  ChevronRight,
  EllipsisVertical,
  House,
  ListChecks,
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  SlidersHorizontal,
  Sparkles,
  X,
} from 'lucide-react'
import { createContext, type ReactNode, useContext, useRef, useState } from 'react'
import { api } from './api.ts'
import { inMacApp } from './macApp.ts'
import { ModuleIcon } from './moduleIcon.tsx'
import { inIntelligence, type Place } from './place.ts'
import { ancestors, childrenOf, flat, inside, tops } from './tree.ts'
import { BarMiddle, InBar } from './ui/bar-slot.tsx'
import { cn } from './ui/cn.ts'
import { Dot, type Signal, strongest } from './ui/dot.tsx'
import { Edge, Opening, SIDE_MIN, STRIP, stripItem, stripName } from './ui/edge.tsx'
import { MenuItem, MenuLine, Popover, SubMenu, useContextMenu } from './ui/popover.tsx'
import { Renamable } from './ui/rename.tsx'

function Nav({
  href,
  icon,
  label,
  current,
  extra,
  small,
}: {
  href: string
  icon: ReactNode
  label: string
  current: boolean
  extra?: ReactNode
  small?: boolean
}) {
  return (
    <a
      href={href}
      aria-current={current ? 'page' : undefined}
      className={cn(
        'group relative flex w-full shrink-0 items-center gap-2.25 rounded-md px-2 text-md text-rail-ink-2 transition-colors hover:bg-rail-hover hover:text-rail-ink',
        small ? 'h-7' : 'h-7.5',
        current &&
          'bg-accent-soft font-medium text-accent before:absolute before:inset-y-1.5 before:left-0 before:w-0.75 before:rounded-full before:bg-accent hover:bg-accent-soft hover:text-accent',
      )}
    >
      <span className={cn('shrink-0 text-rail-ink-3', current && 'text-accent')}>{icon}</span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {extra}
    </a>
  )
}

// Each module's signal, for its dot in the rail (Batch E, 66.18).
const Signals = createContext<Record<string, Signal>>({})

export function Rail({
  modules,
  place,
  name,
  waiting,
  tasksDue,
  online,
  here,
  layout,
  onLayout,
  onNew,
  signals = {},
}: {
  modules: ModuleSummary[]
  place: Place
  signals?: Record<string, Signal> // each module's dot (Batch E, 66.18)
  here: string | null // the module whose screen or table is open
  name: string
  waiting: number
  tasksDue: number // tasks due today or overdue
  online: boolean
  layout: Layout
  onLayout: (change: Partial<Layout>) => void
  onNew: () => void // New module: a blank module whose words Alpha builds it from
}) {
  // the rail's width, dragged by its edge, kept by Alpha per person
  const width = layout.railWidth ?? 216
  const [dragged, setDragged] = useState<number | null>(null)
  const hiding: Hiding = { hidden: layout.hidden, set: (ids) => onLayout({ hidden: ids }) }
  const empty = useContextMenu()
  const keepWidth = (w: number) => onLayout({ railWidth: w })
  if (layout.railFolded)
    return (
      <Strip
        modules={modules}
        place={place}
        here={here}
        name={name}
        waiting={waiting}
        tasksDue={tasksDue}
        hidden={hiding.hidden}
        onNew={onNew}
        onOpen={() => onLayout({ railFolded: false })}
        onOpenAt={(w) => onLayout({ railFolded: false, railWidth: w })}
      />
    )
  const fold = (id: string) =>
    onLayout({
      folded: layout.folded.includes(id)
        ? layout.folded.filter((x) => x !== id)
        : [...layout.folded, id],
    })
  return (
    <nav
      style={{ width: dragged ?? width }}
      className="relative flex shrink-0 flex-col border-rail-line border-r bg-rail px-2.5 pb-2.5 text-rail-ink"
    >
      <Edge
        side="right"
        width={dragged ?? width}
        max={RAIL[1]}
        onDrag={setDragged}
        onDone={keepWidth}
        onFold={() => onLayout({ railFolded: true })}
      />
      {/* the rail's head sits on the window's header line; in Alpha's own window it moves the
          window and leaves room for its buttons */}
      <div
        data-tauri-drag-region
        className={cn(
          '-mx-2.5 mb-2 flex h-12 shrink-0 items-center gap-1 border-hair border-b pr-2 pl-2.5',
          inMacApp() && 'pl-19',
        )}
      >
        <Workspace name={name} />
        <button
          type="button"
          aria-label="Fold the rail"
          data-tip={'Fold the rail (⌘\\)'}
          onClick={() => onLayout({ railFolded: true })}
          className="grid size-7 shrink-0 place-items-center rounded-md text-rail-ink-3 hover:bg-rail-hover hover:text-rail-ink"
        >
          <PanelLeftClose className="size-4" />
        </button>
      </div>
      <Nav
        href="#/"
        icon={<House className="size-4" />}
        label="Home"
        current={place.at === 'home'}
        extra={waiting > 0 && <Badge n={waiting} />}
      />
      <Nav
        href="#/conversation"
        icon={<MessageSquare className="size-4" />}
        label="Conversation"
        current={place.at === 'conversation'}
      />
      <Nav
        href="#/tasks"
        icon={<ListChecks className="size-4" />}
        label="Tasks"
        current={place.at === 'tasks'}
        extra={tasksDue > 0 && <Badge n={tasksDue} />}
      />
      {/* every row 30px, the modules straight after Tasks (Batch E, 79.16, Kenil's look 2 Nov) */}
      {/* biome-ignore lint/a11y/noStaticElementInteractions: a right-click on empty space brings hidden modules back; the ⋮ menus do too, by keyboard */}
      <div
        className="min-h-0 flex-1 overflow-y-auto"
        onContextMenu={(e) => {
          if (e.target === e.currentTarget && modules.some((m) => hiding.hidden.includes(m.id)))
            empty.on.onContextMenu(e)
        }}
      >
        {modules.length === 0 && online && (
          <div className="px-2 py-1 text-rail-ink-3 text-sm">
            Modules appear here as you ask for them.
          </div>
        )}
        <Popover point={empty.point} open={empty.open} onClose={empty.close}>
          <HiddenMenu modules={modules} hiding={hiding} onDone={empty.close} />
        </Popover>
        <Signals.Provider value={signals}>
          {shownTops(modules, hiding.hidden).map((m) => (
            <ModuleItem
              key={m.id}
              m={m}
              modules={modules}
              here={here}
              folded={layout.folded}
              onFold={fold}
              hiding={hiding}
            />
          ))}
        </Signals.Provider>
        <button
          type="button"
          onClick={onNew}
          className="flex h-7.5 w-full items-center gap-2.25 rounded-md px-2 text-md text-rail-ink-3 transition-colors hover:bg-rail-hover hover:text-rail-ink"
        >
          <Plus className="size-4 shrink-0" />
          New module
        </button>
      </div>
      {/* Intelligence and Settings at the foot, each its own place (Kenil's call 1, 7 Nov) */}
      <div className="flex flex-col pt-2">
        <Nav
          href="#/intelligence"
          icon={<Sparkles className="size-4" />}
          label="Intelligence"
          current={inIntelligence(place)}
        />
        <Nav
          href="#/settings"
          icon={<SlidersHorizontal className="size-4" />}
          label="Settings"
          current={place.at === 'settings' || (place.at === 'item' && place.kind === 'rule')}
        />
      </div>
    </nav>
  )
}

// The rail's head: the person's initial on an accent tile and their name. The window moves by it in
// Alpha's own Mac window, so it takes no clicks.
function Workspace({ name, tileOnly }: { name: string; tileOnly?: boolean }) {
  const label = name ? `${name}'s workspace` : 'Your workspace'
  return (
    <div className="pointer-events-none flex min-w-0 flex-1 items-center gap-2 p-1">
      <span className="grid size-6.5 shrink-0 place-items-center rounded-md bg-accent font-semibold text-accent-ink text-md leading-none">
        {(name.trim()[0] ?? 'A').toUpperCase()}
      </span>
      <span className={tileOnly ? 'sr-only' : 'min-w-0 flex-1 truncate font-semibold text-md'}>
        {label}
      </span>
    </div>
  )
}

function Badge({ n }: { n: number }) {
  return (
    <span className="grid h-4.5 min-w-4.5 place-items-center rounded-full bg-accent px-1.25 font-semibold text-accent-ink text-xs">
      {n}
    </span>
  )
}

// Modules hidden from the rail, with the modules inside them, kept per person by the core like the
// rail's folds. A hidden one still opens by its link and by Find.
type Hiding = { hidden: string[]; set: (ids: string[]) => void }

const shownTops = (modules: ModuleSummary[], hidden: string[]) =>
  tops(modules).filter((m) => !hidden.includes(m.id))

// Hidden modules ›: each one, to bring back; only when any are hidden.
function HiddenMenu({
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
    <SubMenu label="Hidden modules">
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

// A module in the rail: its name only (its pages and tables are its screen's tabs), the modules
// inside it under it, and its menu on ⋮ or a right-click.
function ModuleItem({
  m,
  modules,
  here,
  folded,
  onFold,
  hiding,
}: {
  m: ModuleSummary
  modules: ModuleSummary[]
  here: string | null
  folded: string[]
  onFold: (id: string) => void
  hiding: Hiding
}) {
  const kids = childrenOf(modules, m.id).filter((c) => !hiding.hidden.includes(c.id))
  const signals = useContext(Signals)
  const menu = useContextMenu()
  const open = !folded.includes(m.id)
  // folded, it shows the strongest of what waits or runs in the modules inside it too
  const signal =
    open || !kids.length
      ? signals[m.id]
      : strongest(inside(modules, m.id).flatMap((id) => signals[id] ?? []))
  return (
    <div>
      <div {...menu.on} className="group/item relative flex items-center rounded-md">
        <Renamable
          name={m.name}
          rename={(to) => api.post(`/api/modules/${m.id}/name`, { name: to })}
        >
          {(start) => (
            <>
              <Nav
                href={`#/module/${m.id}`}
                icon={<ModuleIcon name={m.name} className="size-4" />}
                label={m.name}
                current={here === m.id}
                extra={
                  <>
                    {signal && <Dot s={signal} />}
                    <span className="w-11 shrink-0" />
                  </>
                }
              />
              <span className="absolute right-0.5 flex items-center">
                <ModuleMenu
                  m={m}
                  modules={modules}
                  hiding={hiding}
                  point={menu.point}
                  onShut={menu.close}
                  onRename={start}
                />
                {kids.length > 0 ? (
                  <button
                    type="button"
                    aria-expanded={open}
                    aria-label={open ? `Fold ${m.name}` : `Unfold ${m.name}`}
                    onClick={() => onFold(m.id)}
                    className="grid size-6 shrink-0 place-items-center rounded-md text-rail-ink-3 hover:text-rail-ink"
                  >
                    {open ? (
                      <ChevronDown className="size-3.25" />
                    ) : (
                      <ChevronRight className="size-3.25" />
                    )}
                  </button>
                ) : (
                  <span className="size-6 shrink-0" />
                )}
              </span>
            </>
          )}
        </Renamable>
      </div>
      {open && kids.length > 0 && (
        <div className="flex flex-col pl-4">
          {kids.map((c) => (
            <ModuleItem
              key={c.id}
              m={c}
              modules={modules}
              here={here}
              folded={folded}
              onFold={onFold}
              hiding={hiding}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// A module's menu: Open, Move to › every other module it may sit inside (never itself or one of its
// own) or the top, Hide, and Hidden modules ›.
function ModuleMenu({
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
            window.location.hash = `#/module/${m.id}`
            close()
          }}
        >
          Open
        </MenuItem>
        {onRename && (
          <MenuItem
            onClick={() => {
              close()
              onRename()
            }}
          >
            Rename
          </MenuItem>
        )}
        <SubMenu label="Move to">
          {flat(modules)
            .filter(({ module }) => !own.has(module.id))
            .map(({ module, depth }) => (
              <MenuItem
                key={module.id}
                checked={m.parent === module.id}
                onClick={() => move(module.id)}
              >
                <span className={cn(depth === 1 && 'pl-3', depth > 1 && 'pl-6')}>
                  {module.name}
                </span>
              </MenuItem>
            ))}
          <MenuLine />
          <MenuItem checked={!m.parent} onClick={() => move(null)}>
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
          Hide
        </MenuItem>
        {modules.some((x) => hiding.hidden.includes(x.id)) && (
          <>
            <MenuLine />
            <HiddenMenu modules={modules} hiding={hiding} onDone={close} />
          </>
        )}
        {problem && <p className="max-w-60 px-2.5 py-1.5 text-bad text-sm">{problem}</p>}
      </Popover>
    </>
  )
}

// The rail folded to a strip of icons: the same places, each named when hovered.
function Strip({
  modules,
  place,
  here,
  name,
  waiting,
  tasksDue,
  hidden,
  onNew,
  onOpen,
  onOpenAt,
}: {
  modules: ModuleSummary[]
  place: Place
  here: string | null
  name: string
  waiting: number
  tasksDue: number
  hidden: string[]
  onNew: () => void
  onOpen: () => void
  onOpenAt: (width: number) => void // dragged out from its edge to this width (79.2)
}) {
  const [opening, setOpening] = useState<number | null>(null)
  // a module inside another lights the one at the top that holds it
  const top = here ? (ancestors(modules, here)[0]?.id ?? here) : null
  const icon = (
    href: string,
    label: string,
    current: boolean,
    child: ReactNode,
    extra?: ReactNode,
  ) => (
    <a
      key={href}
      href={href}
      aria-label={label}
      data-tip={label}
      aria-current={current ? 'page' : undefined}
      className={stripItem(current, true)}
    >
      {child}
      <span className={stripName}>{label.split(',')[0]}</span>
      {extra}
    </a>
  )
  return (
    <nav className="relative flex w-20 shrink-0 flex-col items-center gap-1 overflow-hidden border-rail-line border-r bg-rail px-1 pb-2.5 text-rail-ink">
      <Edge
        side="right"
        folded
        width={STRIP}
        max={RAIL[1]}
        onDrag={setOpening}
        onDone={onOpenAt}
        onFold={() => undefined}
      />
      <Opening side="left" width={opening} />
      <div
        data-tauri-drag-region
        className={cn(
          'flex h-12 w-full shrink-0 items-center justify-center border-hair border-b',
          inMacApp() && 'h-20 items-end pb-1.5',
        )}
      >
        <Workspace name={name} tileOnly />
      </div>
      <button
        type="button"
        aria-label="Open the rail"
        data-tip={'Open the rail (⌘\\)'}
        onClick={onOpen}
        className={cn(stripItem(false, true), 'mt-1 mb-2')}
      >
        <PanelLeftOpen className="size-4" />
        <span className={stripName}>Open</span>
      </button>
      {icon(
        '#/',
        waiting ? `Home, ${waiting} waiting for you` : 'Home',
        place.at === 'home',
        <House className="size-4" />,
        waiting > 0 && (
          <span
            className="absolute top-1 right-4 size-2 rounded-full bg-accent"
            aria-hidden="true"
          />
        ),
      )}
      {icon(
        '#/tasks',
        tasksDue ? `Tasks, ${tasksDue} due` : 'Tasks',
        place.at === 'tasks',
        <ListChecks className="size-4" />,
      )}
      <div className="my-1.5 h-px w-6 shrink-0 bg-rail-line" />
      <div className="scroll-quiet flex min-h-0 w-full flex-1 flex-col items-center gap-1 overflow-y-auto">
        {shownTops(modules, hidden).map((m) =>
          icon(
            `#/module/${m.id}`,
            m.name,
            top === m.id,
            <ModuleIcon name={m.name} className="size-4" />,
          ),
        )}
        <button
          type="button"
          aria-label="New module"
          data-tip="New module"
          onClick={onNew}
          className={stripItem(false, true)}
        >
          <Plus className="size-4" />
          <span className={stripName}>New</span>
        </button>
      </div>
      {icon(
        '#/intelligence',
        'Intelligence',
        place.at === 'intelligence',
        <Sparkles className="size-4" />,
      )}
      {icon(
        '#/settings',
        'Settings',
        place.at === 'settings',
        <SlidersHorizontal className="size-4" />,
      )}
    </nav>
  )
}

// the rail's narrowest and widest
const RAIL = [SIDE_MIN, 360] as const // narrowest at the panels' 200px (Batch D, 79.1)

// The module People and Organizations live in, as its module.yaml says (people: true); none, and
// they show nowhere.
export const network = (modules: ModuleSummary[]) => modules.find((m) => m.people) ?? null

// What a screen puts in the middle of the bar lives in ui/bar-slot.tsx, where a part reaches it.
export { BarMiddle, InBar }

// The bar over each screen, at the shared 48px: the screen's switch or name centred, and the lens
// on the left when one is on. Find is ⌘K, from anywhere.
export function Bar({
  name,
  lens,
  onClearLens,
  middle,
}: {
  name: string
  lens: { id: string; name: string } | null
  onClearLens: () => void
  middle: (at: HTMLElement | null) => void
}) {
  return (
    <div
      data-tauri-drag-region
      className="@container grid h-12 shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-3 border-hair border-b bg-canvas pr-3.5 pl-6"
    >
      <div className="flex min-w-0 items-center gap-2" data-tauri-drag-region>
        {lens && (
          <span className="inline-flex h-6 shrink-0 items-center gap-1 rounded-full bg-accent-soft pr-0.75 pl-2.25 font-medium text-accent text-sm">
            Only {lens.name}
            <button
              type="button"
              aria-label={`Show all, not only ${lens.name}`}
              data-tip="Show all"
              onClick={onClearLens}
              className="grid size-5 place-items-center rounded-full hover:bg-accent-line/40"
            >
              <X className="size-3.25" />
            </button>
          </span>
        )}
      </div>
      <div className="flex min-w-0 justify-center">
        <div ref={middle} className="peer flex min-w-0 justify-center empty:hidden" />
        <h1 className="hidden min-w-0 truncate font-serif text-ink text-xl peer-empty:block">
          {name}
        </h1>
      </div>
      <div data-tauri-drag-region />
    </div>
  )
}
