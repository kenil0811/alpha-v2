// The shell (Vikas, 25 Oct; reverses design §14's rail
// until Kenil says yes): the rail on the left, a 48px bar over every screen and the assistant on
// the right, their headers on one line. The rail has the workspace at its top, Home with a badge
// for what waits on the person, Agents, Tasks, the modules by name (People and Organizations are
// tabs inside Network; a rail item of their own only when there is no Network) with the modules inside them,
// New module last in the list, and Settings at its foot with the Second Brain beside it (Vikas,
// 28 Oct); no headings and no status lines. It
// folds to a strip of icons. In Alpha's own Mac window its top row leaves room for the window
// buttons.
import type { FoundRow, Layout, ModuleSummary } from '@alpha/core/api'
import {
  ArrowLeftRight,
  Bot,
  Brain,
  ChevronDown,
  ChevronRight,
  EllipsisVertical,
  House,
  ListChecks,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Search,
  SlidersHorizontal,
  Users,
  X,
} from 'lucide-react'
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { createPortal } from 'react-dom'
import { api } from './api.ts'
import type { FilePlace } from './FileView.tsx'
import { inMacApp } from './macApp.ts'
import { ModuleIcon } from './moduleIcon.tsx'
import { applyTheme, savedTheme, type Theme } from './theme.ts'
import { ancestors, childrenOf, flat, inside, tops } from './tree.ts'
import { Back } from './ui/back.tsx'
import { Button } from './ui/button.tsx'
import { cn } from './ui/cn.ts'
import { Edge, Opening, SIDE_MIN, STRIP, stripItem, stripName } from './ui/edge.tsx'
import { Field } from './ui/field.tsx'
import { MenuItem, MenuLine, Popover, SubMenu, useContextMenu } from './ui/popover.tsx'
import { Segmented } from './ui/segmented.tsx'

export type Place =
  | { at: 'home' }
  | { at: 'conversation' }
  | { at: 'activity' }
  | { at: 'parts' }
  | { at: 'new' }
  | { at: 'item'; kind: 'agent' | 'run' | 'rule'; id: string }
  | { at: 'row'; id: string }
  | {
      at: 'table'
      id: string
      row: string | null
      only: string[] | null
      of: string | null
      field: string | null
    }
  | {
      at: 'module'
      id: string
      tab: 'overview' | 'conversation' | 'agents' | null
      page: string | null
    }
  | { at: 'settings'; section: string | null; open: null }
  | { at: 'intelligence'; section: string | null; open: string | null }
  | { at: 'file'; place: FilePlace }
  | { at: 'people'; kind: 'person' | 'company'; id: string | null }
  | {
      at: 'tasks'
      list: 'today' | 'week' | 'overdue' | 'waiting' | 'agents' | 'open' | 'done'
      id: string | null
    }

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
}: {
  modules: ModuleSummary[]
  place: Place
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
        onOpen={(w) => onLayout({ railFolded: false, ...(w ? { railWidth: w } : {}) })}
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
        min={RAIL[0]}
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
      <div className="flex flex-col">
        {places(place, waiting, tasksDue, modules).map((f) => (
          <Nav
            key={f.href}
            href={f.href}
            icon={<f.icon className="size-4" />}
            label={f.label}
            current={f.current}
            extra={f.count > 0 && <Badge n={f.count} />}
          />
        ))}
      </div>
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
        <ModuleDrag modules={modules}>
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
        </ModuleDrag>
        <button
          type="button"
          onClick={onNew}
          className="flex h-7.5 w-full items-center gap-2.25 rounded-md px-2 text-md text-rail-ink-3 transition-colors hover:bg-rail-hover hover:text-rail-ink"
        >
          <Plus className="size-4 shrink-0" />
          New module
        </button>
      </div>
      <div className="flex items-center gap-1 pt-2">
        <div className="min-w-0 flex-1">
          <Nav
            href="#/settings"
            icon={<SlidersHorizontal className="size-4" />}
            label="Settings"
            current={place.at === 'settings' || (place.at === 'item' && place.kind === 'rule')}
          />
        </div>
        <a
          href={BRAIN}
          aria-label="Second Brain"
          data-tip="Second Brain"
          aria-current={place.at === 'intelligence' ? 'page' : undefined}
          className={cn(
            'grid size-8 shrink-0 place-items-center rounded-md text-rail-ink-3 transition-colors hover:bg-rail-hover hover:text-rail-ink',
            place.at === 'intelligence' &&
              'bg-accent-soft text-accent hover:bg-accent-soft hover:text-accent',
          )}
        >
          <Brain className="size-4" />
        </a>
      </div>
    </nav>
  )
}

// The places at the top of the rail and its strip, from one list: Home, Agents, Tasks, and People
// when there is no Network
const places = (place: Place, waiting: number, tasksDue: number, modules: ModuleSummary[]) => [
  { href: '#/', label: 'Home', icon: House, current: place.at === 'home', count: waiting },
  {
    href: '#/conversation',
    label: 'Agents',
    icon: Bot,
    current: place.at === 'conversation',
    count: 0,
  },
  {
    href: '#/tasks',
    label: 'Tasks',
    icon: ListChecks,
    current: place.at === 'tasks',
    count: tasksDue,
  },
  ...(network(modules)
    ? []
    : [
        {
          href: '#/people',
          label: 'People',
          icon: Users,
          current: place.at === 'people',
          count: 0,
        },
      ]),
]

// the rail's small Second Brain icon lands on Intelligence's Second Brain tab
const BRAIN = '#/intelligence/brain'

// The rail's head (Vikas, 29 Oct): the workspace's initial and name. A click opens the account's
// menu: the workspace and where it runs, Appearance on one line, Switch account and Log out;
// Settings and the Second Brain are on the rail already.
function Workspace({ name, tileOnly }: { name: string; tileOnly?: boolean }) {
  const label = name ? `${name}'s workspace` : 'Your workspace'
  const anchor = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  const [theme, setTheme] = useState<Theme>(savedTheme)
  const [switching, setSwitching] = useState<string | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const look = (t: Theme) => {
    setTheme(t)
    applyTheme(t)
    void api.post('/api/appearance', { theme: t }).catch(() => undefined) // kept here regardless
  }
  // Log out: this browser forgets the per-install token, and the window shows the core's own
  // words for opening Alpha again from the address it printed
  const logOut = () => {
    try {
      sessionStorage.removeItem('alpha-token')
    } catch {
      // a private window keeps nothing
    }
    window.location.replace(window.location.pathname)
  }
  // Switch account: another Alpha (another install, another person) is another address with its
  // own token, the one its core printed
  const go = (address: string) => {
    try {
      const u = new URL(address.trim())
      if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error()
      window.location.assign(u.href)
    } catch {
      setProblem('Paste the whole address the core printed, starting http.')
    }
  }
  const tile = (
    <span className="grid size-6.5 shrink-0 place-items-center rounded-md bg-accent font-semibold text-accent-ink text-md leading-none">
      {(name.trim()[0] ?? 'A').toUpperCase()}
    </span>
  )
  return (
    <>
      <button
        ref={anchor}
        type="button"
        data-tip={label}
        aria-label={tileOnly ? label : undefined}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation() // the folded rail opens on a click
          setOpen(!open)
        }}
        className="flex min-w-0 flex-1 items-center gap-2 rounded-md p-1 text-left hover:bg-rail-hover"
      >
        {tile}
        {!tileOnly && (
          <>
            <span className="min-w-0 flex-1 truncate font-semibold text-md">{label}</span>
            <ChevronDown className="size-3.5 shrink-0 text-rail-ink-3" />
          </>
        )}
      </button>
      <Popover
        anchor={anchor}
        open={open}
        onClose={() => {
          setOpen(false)
          setSwitching(null)
          setProblem(null)
        }}
      >
        <div className="flex min-w-72 flex-col p-1" role="menu" aria-label={label}>
          <div className="flex items-center gap-2 px-2.5 py-2">
            {tile}
            <div className="min-w-0">
              <div className="truncate font-medium text-ink text-md">{label}</div>
              <div className="text-ink-3 text-sm">On this Mac</div>
            </div>
          </div>
          <MenuLine />
          <div className="flex items-center gap-3 px-2.5 py-1.5">
            <span className="flex-1 text-ink-2 text-md">Appearance</span>
            <Segmented
              label="Appearance"
              value={theme}
              onChange={look}
              options={[
                { value: 'mac', label: 'Match Mac' },
                { value: 'light', label: 'Light' },
                { value: 'dark', label: 'Dark' },
              ]}
            />
          </div>
          <MenuLine />
          {switching === null ? (
            <MenuItem onClick={() => setSwitching('')}>
              <ArrowLeftRight className="size-3.5 text-ink-3" />
              Switch account
            </MenuItem>
          ) : (
            <form
              className="flex flex-col gap-1.5 px-2.5 py-1.5"
              onSubmit={(e) => {
                e.preventDefault()
                go(switching)
              }}
            >
              <span className="text-ink-3 text-sm">The address another Alpha's core printed</span>
              <div className="flex gap-1.5">
                <Field
                  autoFocus
                  aria-label="The address to open"
                  placeholder="http://localhost:4700/?t=…"
                  value={switching}
                  onChange={(e) => setSwitching(e.target.value)}
                  className="h-7 min-w-0 flex-1"
                />
                <Button size="sm" variant="primary" type="submit" disabled={!switching.trim()}>
                  Open
                </Button>
              </div>
            </form>
          )}
          {/* Alpha's own Mac window is signed in by the Mac: nothing to log out of there */}
          {!inMacApp() && (
            <MenuItem onClick={logOut}>
              <LogOut className="size-3.5 text-ink-3" />
              Log out
            </MenuItem>
          )}
          {problem && <p className="max-w-72 px-2.5 py-1.5 text-bad text-sm">{problem}</p>}
        </div>
      </Popover>
    </>
  )
}

function Badge({ n }: { n: number }) {
  return (
    <span className="grid h-4.5 min-w-4.5 place-items-center rounded-full bg-accent px-1.25 font-semibold text-accent-ink text-xs">
      {n}
    </span>
  )
}

// Dragging a module onto another puts it inside; onto Top level, out to the top. The same place
// route as the ⋮ menu, which stays the keyboard's way to move one.
type Dragging = {
  id: string | null
  start: (id: string | null) => void
  drop: (within: string | null) => void
}
const Drag = createContext<Dragging>({ id: null, start: () => undefined, drop: () => undefined })

function ModuleDrag({ modules, children }: { modules: ModuleSummary[]; children: ReactNode }) {
  const [id, setId] = useState<string | null>(null)
  const [over, setOver] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const drop = async (within: string | null) => {
    setId(null)
    if (!id) return
    try {
      await api.post(`/api/modules/${id}/place`, { within })
      setProblem(null)
    } catch (err) {
      setProblem(err instanceof Error ? err.message : 'That did not move.')
    }
  }
  const nested = !!modules.find((m) => m.id === id)?.parent
  return (
    <Drag.Provider value={{ id, start: setId, drop: (w) => void drop(w) }}>
      {nested && (
        // biome-ignore lint/a11y/noStaticElementInteractions: a drop target; the ⋮ menu moves by keyboard
        <div
          onDragOver={(e) => {
            e.preventDefault()
            setOver(true)
          }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            e.preventDefault()
            setOver(false)
            void drop(null)
          }}
          className={cn(
            'mb-1 flex h-7.5 items-center rounded-md border border-rail-line border-dashed px-2 text-rail-ink-3 text-sm',
            over && 'border-accent bg-rail-hover text-rail-ink',
          )}
        >
          Drop here for the top level
        </div>
      )}
      {children}
      {problem && <p className="px-2 py-1 text-bad text-sm">{problem}</p>}
    </Drag.Provider>
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
  const menu = useContextMenu()
  const open = !folded.includes(m.id)
  const drag = useContext(Drag)
  const [over, setOver] = useState(false)
  // never into itself, one of its own, or where it already sits
  const can =
    !!drag.id &&
    !inside(modules, drag.id).includes(m.id) &&
    modules.find((x) => x.id === drag.id)?.parent !== m.id
  return (
    <div>
      {/* biome-ignore lint/a11y/noStaticElementInteractions: dragged and dropped on; the ⋮ menu moves by keyboard */}
      <div
        draggable
        onDragStart={(e) => {
          e.dataTransfer.effectAllowed = 'move'
          drag.start(m.id)
        }}
        onDragEnd={() => drag.start(null)}
        {...menu.on}
        onDragOver={(e) => {
          if (!can) return
          e.preventDefault()
          setOver(true)
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          if (!can) return
          e.preventDefault()
          setOver(false)
          drag.drop(m.id)
        }}
        className={cn(
          'group/item relative flex items-center rounded-md',
          over && 'bg-rail-hover ring-2 ring-accent',
        )}
      >
        <Nav
          href={`#/module/${m.id}`}
          icon={<ModuleIcon name={m.name} className="size-4" />}
          label={m.name}
          current={here === m.id}
          extra={<span className="w-11 shrink-0" />}
        />
        <span className="absolute right-0.5 flex items-center">
          <ModuleMenu
            m={m}
            modules={modules}
            hiding={hiding}
            point={menu.point}
            onShut={menu.close}
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
}: {
  m: ModuleSummary
  modules: ModuleSummary[]
  hiding: Hiding
  point: { x: number; y: number } | null // a right-click's place
  onShut: () => void
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
}: {
  modules: ModuleSummary[]
  place: Place
  here: string | null
  name: string
  waiting: number
  tasksDue: number
  hidden: string[]
  onNew: () => void
  onOpen: (width?: number) => void // a drag out of its edge opens it at that width
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
      className={cn(
        stripItem(current),
        !current && 'text-rail-ink-3 hover:bg-rail-hover hover:text-rail-ink',
      )}
    >
      {child}
      <span className={stripName}>{label.split(',')[0]}</span>
      {extra}
    </a>
  )
  return (
    <nav className="relative flex w-20 shrink-0 flex-col items-center gap-1 border-rail-line border-r bg-rail px-1 pb-2.5 text-rail-ink">
      <Edge
        side="right"
        folded
        width={STRIP}
        max={RAIL[1]}
        onDrag={setOpening}
        onDone={(w) => onOpen(w)}
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
        onClick={() => onOpen()}
        className={cn(
          stripItem(),
          'mt-1 mb-2 text-rail-ink-3 hover:bg-rail-hover hover:text-rail-ink',
        )}
      >
        <PanelLeftOpen className="size-4" />
        <span className={stripName}>Open</span>
      </button>
      {places(place, waiting, tasksDue, modules).map((f) =>
        icon(
          f.href,
          f.count
            ? `${f.label}, ${f.count} ${f.href === '#/' ? 'waiting for you' : 'due'}`
            : f.label,
          f.current,
          <f.icon className="size-4" />,
          f.href === '#/' && f.count > 0 && (
            <span
              className="absolute top-1 right-1 size-2 rounded-full bg-accent"
              aria-hidden="true"
            />
          ),
        ),
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
          className={cn(stripItem(), 'text-rail-ink-3 hover:bg-rail-hover hover:text-rail-ink')}
        >
          <Plus className="size-4" />
          <span className={stripName}>New</span>
        </button>
      </div>
      {icon(BRAIN, 'Second Brain', place.at === 'intelligence', <Brain className="size-4" />)}
      {icon(
        '#/settings',
        'Settings',
        place.at === 'settings',
        <SlidersHorizontal className="size-4" />,
      )}
    </nav>
  )
}

// Where a screen sits, for the bar: a few words, the last in bold; each before it opens its place.
export interface Crumb {
  icon?: ReactNode
  parts: { label: string; href?: string | undefined }[]
}

// the rail's narrowest and widest
const RAIL = [SIDE_MIN, 360] as const

// The module People and Organizations live in, as its module.yaml says (people: true; Network's).
export const network = (modules: ModuleSummary[]) => modules.find((m) => m.people) ?? null

// What a screen puts in the middle of the bar: its pill switch, or its title. A screen that puts
// nothing there gets its name in serif.
const Middle = createContext<HTMLElement | null>(null)
export const BarMiddle = Middle.Provider
export function InBar({ children }: { children: ReactNode }) {
  const at = useContext(Middle)
  return at ? createPortal(children, at) : null
}

// The places this window went, in order: Back returns to the one before, wherever it was (Vikas,
// 30 Oct: "when I press back, it's going to home and not to the previous path"); a link, not
// history.back(), so a place left by replace never takes Back out of the window
const been: string[] = [globalThis.location?.hash || '#/']
globalThis.addEventListener?.('hashchange', () => {
  const h = location.hash || '#/'
  if (been.at(-2) === h)
    been.pop() // went back
  else if (been.at(-1) !== h) been.push(h)
})

// The bar over each screen, at the shared 48px: Back on the left on every screen but Home, the
// screen's switch or name centred. Find is ⌘K, from anywhere.
export function Bar({
  crumb,
  lens,
  onClearLens,
  middle,
}: {
  crumb: Crumb
  lens: { id: string; name: string } | null
  onClearLens: () => void
  middle: (at: HTMLElement | null) => void
}) {
  const last = crumb.parts.at(-1)?.label ?? ''
  const back = crumb.parts.at(-2)
  const home = !crumb.parts.length || (crumb.parts.length === 1 && last === 'Home')
  return (
    <div
      data-tauri-drag-region
      className="@container grid h-12 shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-3 border-hair border-b bg-canvas pr-3.5 pl-6"
    >
      <div className="flex min-w-0 items-center gap-2" data-tauri-drag-region>
        {/* every screen but Home: Back to where the person was, else the place above it */}
        {!home &&
          (been.length > 1 ? (
            <Back to="where you were" href={been.at(-2) ?? '#/'} />
          ) : (
            <Back href={back?.href ?? '#/'} to={back?.href ? back.label : 'Home'} />
          ))}
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
        <h1 className="hidden truncate font-serif text-ink text-xl peer-empty:block">{last}</h1>
      </div>
      <div data-tauri-drag-region />
    </div>
  )
}

// Find (⌘K): every place in the window by its name; Return opens it.
export function Find({ modules, onClose }: { modules: ModuleSummary[]; onClose: () => void }) {
  const [words, setWords] = useState('')
  const [at, setAt] = useState(0)
  const input = useRef<HTMLInputElement>(null)
  useEffect(() => input.current?.focus(), [])
  const places = useMemo(
    () => [
      { label: 'Home', hint: '', href: '#/' },
      { label: 'Agents', hint: '', href: '#/conversation' },
      { label: 'Tasks', hint: '', href: '#/tasks' },
      { label: 'New task', hint: 'Tasks', href: '#/tasks?list=open' },
      { label: 'People', hint: 'Network', href: '#/people' },
      { label: 'Organizations', hint: 'Network', href: '#/people?companies' },
      { label: 'Activity', hint: '', href: '#/activity' },
      { label: 'Intelligence', hint: '', href: '#/intelligence' },
      { label: 'Second Brain', hint: 'Intelligence', href: BRAIN },
      { label: 'Settings', hint: '', href: '#/settings' },
      ...modules.map((m) => ({
        label: m.name,
        hint: modules.find((p) => p.id === m.parent)?.name ?? 'Module',
        href: `#/module/${m.id}`,
      })),
      ...modules.flatMap((m) =>
        m.tables.map((t) => ({ label: t.name, hint: m.name, href: `#/table/${t.id}` })),
      ),
    ],
    [modules],
  )
  const w = words.trim().toLowerCase()
  // rows whose words match, from the core, a moment after typing stops
  const [rows, setRows] = useState<FoundRow[]>([])
  useEffect(() => {
    if (w.length < 2) {
      setRows([])
      return
    }
    const t = setTimeout(() => {
      api
        .get<FoundRow[]>(`/api/find?words=${encodeURIComponent(w)}`)
        .then(setRows, () => setRows([]))
    }, 180)
    return () => clearTimeout(t)
  }, [w])
  // a name that starts with the words first, then one that holds them, then its module's
  const score = (p: { label: string; hint: string }) => {
    const l = p.label.toLowerCase()
    return l.startsWith(w) ? 0 : l.includes(w) ? 1 : p.hint.toLowerCase().includes(w) ? 2 : 3
  }
  const found = [
    ...(w ? places.filter((p) => score(p) < 3).sort((a, b) => score(a) - score(b)) : places),
    ...rows,
  ]
  const go = (href: string | undefined) => {
    if (href) window.location.hash = href
    onClose()
  }
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: the backdrop closes Find; Escape does too
    // biome-ignore lint/a11y/useKeyWithClickEvents: Escape is handled by the field
    <div className="fixed inset-0 z-20 flex justify-center bg-ink/20 pt-24" onClick={onClose}>
      {/* biome-ignore lint/a11y/noStaticElementInteractions: stops a click inside from closing it */}
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: the field takes the keys */}
      <div
        className="h-fit w-full max-w-140 overflow-hidden rounded-lg border border-line bg-surface shadow-pop"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-hair border-b px-3.5">
          <Search className="size-4 shrink-0 text-ink-3" />
          <input
            ref={input}
            value={words}
            placeholder="Find a screen, a table or a row"
            aria-label="Find"
            className="h-11 flex-1 bg-transparent text-base text-ink outline-none placeholder:text-ink-3"
            onChange={(e) => {
              setWords(e.target.value)
              setAt(0)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') onClose()
              if (e.key === 'ArrowDown') setAt((a) => Math.min(a + 1, found.length - 1))
              if (e.key === 'ArrowUp') setAt((a) => Math.max(a - 1, 0))
              if (e.key === 'Enter') go(found[at]?.href)
            }}
          />
        </div>
        <div className="max-h-80 overflow-y-auto p-1.5">
          {found.length === 0 && (
            <div className="px-2.5 py-2 text-ink-3 text-md">Nothing by that name.</div>
          )}
          {found.map((p, i) => (
            <button
              key={p.href}
              type="button"
              onMouseEnter={() => setAt(i)}
              onClick={() => go(p.href)}
              className={cn(
                'flex h-8 w-full items-center gap-2 rounded-md px-2.5 text-left text-ink text-md',
                i === at && 'bg-hover',
              )}
            >
              <span className="flex-1 truncate">{p.label}</span>
              {p.hint && <span className="text-ink-3 text-sm">{p.hint}</span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
