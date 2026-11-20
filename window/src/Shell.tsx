// The shell: the rail on the left, a 48px bar over every screen and the assistant on the right,
// their headers on one line. The rail has the person's name at its top, Home with a badge for what
// waits on the person, Agents, Tasks, the modules by name with the modules inside them, New module
// last in the list, and Intelligence and Settings at its foot; no headings and no status lines. It
// folds to a strip of icons. In Alpha's own Mac window its top row leaves room for the window
// buttons.
import type { Layout, ModuleSummary } from '@alpha/core/api'
import {
  Activity,
  ChevronDown,
  ChevronRight,
  House,
  Image,
  ListChecks,
  LogOut,
  MessageSquare,
  PanelLeft,
  Pencil,
  Pin,
  Plus,
  SlidersHorizontal,
  Sparkles,
} from 'lucide-react'
import { createContext, type ReactNode, useContext, useRef, useState } from 'react'
import { api, forgetToken } from './api.ts'
import { HiddenMenu, type Hiding, ModuleMenu, shownTops } from './ModuleMenu.tsx'
import { inMacApp } from './macApp.ts'
import { ModuleIcon } from './moduleIcon.tsx'
import { inIntelligence, type Place } from './place.ts'
import { MOD } from './time.ts'
import { ancestors, childrenOf, inside, landingOf } from './tree.ts'
import { BarMiddle, InBar } from './ui/bar-slot.tsx'
import { cn } from './ui/cn.ts'
import { Dot, type Signal, strongest } from './ui/dot.tsx'
import { Edge, Opening, SIDE_MIN, STRIP, stripItem } from './ui/edge.tsx'
import { Field } from './ui/field.tsx'
import { MenuItem, Popover, useContextMenu } from './ui/popover.tsx'
import { Renamable } from './ui/rename.tsx'
import { SlideWidth } from './ui/slide.tsx'

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
        current && 'bg-rail-sel font-medium text-rail-ink',
      )}
    >
      <span className={cn('shrink-0 text-rail-ink-3', current && 'text-rail-ink')}>{icon}</span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {extra}
    </a>
  )
}

// Each module's signal, for its dot in the rail.
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
  news = 0,
  signals = {},
}: {
  modules: ModuleSummary[]
  place: Place
  signals?: Record<string, Signal> // each module's dot
  here: string | null // the module whose screen or table is open
  name: string
  waiting: number
  tasksDue: number // tasks due today or overdue
  online: boolean
  layout: Layout
  onLayout: (change: Partial<Layout>) => void
  onNew: () => void // New module: a conversation with the Module builder
  news?: number // what Alpha did since this person last opened Activity
}) {
  // the rail's width, dragged by its edge, kept by Alpha per person
  const width = layout.railWidth ?? 216
  const [dragged, setDragged] = useState<number | null>(null)
  // hiding a pinned module unpins it
  const hiding: Hiding = {
    hidden: layout.hidden,
    set: (ids) => onLayout({ hidden: ids, pinned: layout.pinned.filter((p) => !ids.includes(p)) }),
    pinned: layout.pinned,
    pin: (ids) => onLayout({ pinned: ids }),
  }
  const empty = useContextMenu()
  const keepWidth = (w: number) => onLayout({ railWidth: w })
  // open and folded alike sit in one slide, so a fold or an open eases
  if (layout.railFolded)
    return (
      <SlideWidth width={STRIP}>
        <Strip
          modules={modules}
          place={place}
          here={here}
          name={name}
          news={news}
          layout={layout}
          onLayout={onLayout}
          waiting={waiting}
          tasksDue={tasksDue}
          hidden={hiding.hidden}
          pinned={hiding.pinned}
          onNew={onNew}
          onOpen={() => onLayout({ railFolded: false })}
          onOpenAt={(w) => onLayout({ railFolded: false, railWidth: w })}
        />
      </SlideWidth>
    )
  const fold = (id: string) =>
    onLayout({
      folded: layout.folded.includes(id)
        ? layout.folded.filter((x) => x !== id)
        : [...layout.folded, id],
    })
  return (
    <SlideWidth width={dragged ?? width} still={dragged !== null}>
      <nav
        data-no-status
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
          {/* the sidebar button first, at the corner, as Claude Code's */}
          <button
            type="button"
            aria-label="Hide the sidebar"
            data-tip={`Hide the sidebar (${MOD}\\)`}
            onClick={() => onLayout({ railFolded: true })}
            className="grid size-7 shrink-0 place-items-center rounded-md text-rail-ink-3 hover:bg-rail-hover hover:text-rail-ink"
          >
            <PanelLeft className="size-4" />
          </button>
          <Workspace name={name} news={news} layout={layout} onLayout={onLayout} />
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
          label="Agents"
          current={place.at === 'conversation'}
        />
        <Nav
          href="#/tasks"
          icon={<ListChecks className="size-4" />}
          label="Tasks"
          current={place.at === 'tasks'}
          extra={tasksDue > 0 && <Badge n={tasksDue} />}
        />
        {/* every row 30px, the modules straight after Tasks */}
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
            {shownTops(modules, hiding.hidden, hiding.pinned).map((m) => (
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
        {/* Intelligence and Settings at the foot, each its own place */}
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
    </SlideWidth>
  )
}

// The rail's head: the workspace tile (the person's picture or initial on an accent tile) and its
// name. It opens a menu: Activity, Rename, Change picture, Log out. A count on the tile says how
// much Alpha did since the person last opened Activity.
function Workspace({
  name,
  tileOnly,
  news,
  layout,
  onLayout,
}: {
  name: string
  tileOnly?: boolean
  news: number
  layout: Layout
  onLayout: (change: Partial<Layout>) => void
}) {
  const label = layout.workspaceName ?? (name ? `${name}'s workspace` : 'Your workspace')
  const anchor = useRef<HTMLButtonElement>(null)
  const file = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [renaming, setRenaming] = useState<string | null>(null)
  const close = () => {
    setOpen(false)
    setRenaming(null)
  }
  const picked = (f: File | undefined) => {
    if (!f) return
    // drawn to a 96px square, so what the core keeps is small
    const img = new window.Image()
    img.onload = () => {
      const c = document.createElement('canvas')
      c.width = c.height = 96
      const side = Math.min(img.width, img.height)
      c.getContext('2d')?.drawImage(
        img,
        (img.width - side) / 2,
        (img.height - side) / 2,
        side,
        side,
        0,
        0,
        96,
        96,
      )
      onLayout({ workspacePicture: c.toDataURL('image/png') })
      URL.revokeObjectURL(img.src)
    }
    img.src = URL.createObjectURL(f)
  }
  const logOut = async () => {
    const s = await api.get<{ signIn: boolean }>('/api/session').catch(() => null)
    if (s?.signIn) {
      await api.post('/api/session/out').catch(() => undefined)
      window.location.replace('/')
    } else forgetToken()
  }
  const initial = (name.trim()[0] ?? 'A').toUpperCase()
  return (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      <button
        ref={anchor}
        type="button"
        aria-label={news ? `${label}, ${news} new in Activity` : label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="relative flex min-w-0 flex-1 items-center gap-2 rounded-md p-1 text-left hover:bg-rail-hover"
      >
        <span className="relative grid size-6.5 shrink-0 place-items-center overflow-hidden rounded-md bg-accent font-semibold text-accent-ink text-md leading-none">
          {layout.workspacePicture ? (
            <img src={layout.workspacePicture} alt="" className="size-full object-cover" />
          ) : (
            initial
          )}
        </span>
        {news > 0 && (
          <span className="absolute -top-0.5 left-4.5 grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 font-semibold text-accent-ink text-xs">
            {news > 99 ? '99+' : news}
          </span>
        )}
        <span className={tileOnly ? 'sr-only' : 'min-w-0 flex-1 truncate font-semibold text-md'}>
          {label}
        </span>
      </button>
      <input
        ref={file}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          picked(e.target.files?.[0])
          e.target.value = ''
        }}
      />
      <Popover anchor={anchor} open={open} onClose={close}>
        {renaming === null ? (
          <>
            <MenuItem
              hint={news > 0 ? `${news} new` : undefined}
              onClick={() => {
                window.location.hash = '#/settings/activity'
                close()
              }}
            >
              <Activity className="size-3.5 text-ink-3" />
              Activity
            </MenuItem>
            <MenuItem onClick={() => setRenaming(label)}>
              <Pencil className="size-3.5 text-ink-3" />
              Rename
            </MenuItem>
            <MenuItem
              onClick={() => {
                file.current?.click()
                close()
              }}
            >
              <Image className="size-3.5 text-ink-3" />
              Change picture
            </MenuItem>
            <MenuItem onClick={() => void logOut()}>
              <LogOut className="size-3.5 text-ink-3" />
              Log out
            </MenuItem>
          </>
        ) : (
          <form
            className="flex w-60 flex-col gap-1.5 p-2"
            onSubmit={(e) => {
              e.preventDefault()
              if (!renaming.trim()) return
              onLayout({ workspaceName: renaming.trim().slice(0, 80) })
              close()
            }}
          >
            <Field
              autoFocus
              aria-label="Workspace name"
              value={renaming}
              onChange={(e) => setRenaming(e.target.value)}
            />
          </form>
        )}
      </Popover>
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
                href={landingOf(modules, m)}
                icon={<ModuleIcon name={m.name} className="size-4" />}
                label={m.name}
                current={here === m.id}
                extra={
                  <>
                    {!m.parent && hiding.pinned.includes(m.id) && (
                      <Pin aria-label="Pinned" className="size-3 shrink-0 text-rail-ink-3" />
                    )}
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

// The rail folded to a strip of icons: the same places, each named when hovered.
function Strip({
  modules,
  place,
  here,
  name,
  news,
  layout,
  onLayout,
  waiting,
  tasksDue,
  hidden,
  pinned,
  onNew,
  onOpen,
  onOpenAt,
}: {
  modules: ModuleSummary[]
  place: Place
  here: string | null
  name: string
  news: number
  layout: Layout
  onLayout: (change: Partial<Layout>) => void
  waiting: number
  tasksDue: number
  hidden: string[]
  pinned: string[]
  onNew: () => void
  onOpen: () => void
  onOpenAt: (width: number) => void // dragged out from its edge to this width
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
      className={stripItem(current)}
    >
      {child}
      {extra}
    </a>
  )
  return (
    <nav
      data-no-status
      className="relative flex w-13 shrink-0 flex-col items-center gap-1 overflow-hidden border-rail-line border-r bg-rail px-1 pb-2.5 text-rail-ink"
    >
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
        <button
          type="button"
          aria-label="Show the sidebar"
          data-tip={`Show the sidebar (${MOD}\\)`}
          onClick={onOpen}
          className={stripItem()}
        >
          <PanelLeft className="size-4" />
        </button>
      </div>
      <div className="mt-1 mb-2">
        <Workspace name={name} news={news} layout={layout} onLayout={onLayout} tileOnly />
      </div>
      {icon(
        '#/',
        waiting ? `Home, ${waiting} waiting for you` : 'Home',
        place.at === 'home',
        <House className="size-4" />,
        waiting > 0 && (
          <span
            className="absolute top-1 right-1 size-2 rounded-full bg-accent"
            aria-hidden="true"
          />
        ),
      )}
      {icon(
        '#/conversation',
        'Agents',
        place.at === 'conversation',
        <MessageSquare className="size-4" />,
      )}
      {icon(
        '#/tasks',
        tasksDue ? `Tasks, ${tasksDue} due` : 'Tasks',
        place.at === 'tasks',
        <ListChecks className="size-4" />,
      )}
      <div className="my-1.5 h-px w-6 shrink-0 bg-rail-line" />
      <div className="scroll-quiet flex min-h-0 w-full flex-1 flex-col items-center gap-1 overflow-y-auto">
        {shownTops(modules, hidden, pinned).map((m) =>
          icon(
            landingOf(modules, m),
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
          className={stripItem()}
        >
          <Plus className="size-4" />
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
const RAIL = [SIDE_MIN, 360] as const // narrowest at the panels' 200px

// The module People and Organizations live in, as its module.yaml says (people: true); none, and
// they show nowhere.
export const network = (modules: ModuleSummary[]) => modules.find((m) => m.people) ?? null

// What a screen puts in the middle of the bar lives in ui/bar-slot.tsx, where a part reaches it.
export { BarMiddle, InBar }
