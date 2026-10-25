// The shell, in the shape Bridge and Alpha Brain share (Vikas, 25 Oct; reverses design §14's rail
// until Kenil says yes): the rail on the left, a 48px bar over every screen and the assistant on
// the right, their headers on one line. The rail has the workspace at its top, Home with a badge
// for what waits on the person, Tasks, People, the modules by name with the modules inside them,
// New module last in the list, and Settings at its foot; no headings and no status lines. It
// folds to a strip of icons. In Alpha's own Mac window its top row leaves room for the window
// buttons.
import type { FoundRow, Layout, ModuleSummary } from '@alpha/core/api'
import {
  Briefcase,
  ChevronDown,
  ChevronRight,
  Ellipsis,
  House,
  ListChecks,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Search,
  SlidersHorizontal,
  Sparkles,
  Users,
  X,
} from 'lucide-react'
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import { api } from './api.ts'
import type { FilePlace } from './FileView.tsx'
import { inMacApp } from './macApp.ts'
import { ancestors, childrenOf, flat, inside, tops } from './tree.ts'
import { cn } from './ui/cn.ts'
import { Kbd } from './ui/pill.tsx'
import { MenuItem, MenuLine, Popover } from './ui/popover.tsx'

export type Place =
  | { at: 'home' }
  | { at: 'conversation' }
  | { at: 'activity' }
  | { at: 'parts' }
  | { at: 'item'; kind: 'agent' | 'run' | 'permission'; id: string }
  | { at: 'table'; id: string; row: string | null; only: string[] | null; field: string | null }
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
  onNew: () => void // New module: the assistant makes one from what the person says
}) {
  if (layout.railFolded)
    return (
      <Strip
        modules={modules}
        place={place}
        here={here}
        name={name}
        waiting={waiting}
        tasksDue={tasksDue}
        onNew={onNew}
        onOpen={() => onLayout({ railFolded: false })}
      />
    )
  const fold = (id: string) =>
    onLayout({
      folded: layout.folded.includes(id)
        ? layout.folded.filter((x) => x !== id)
        : [...layout.folded, id],
    })
  return (
    <nav className="flex w-54 shrink-0 flex-col overflow-hidden border-rail-line border-r bg-rail px-2.5 pb-2.5 text-rail-ink">
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
          title={'Fold the rail (⌘\\)'}
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
        href="#/tasks"
        icon={<ListChecks className="size-4" />}
        label="Tasks"
        current={place.at === 'tasks'}
        extra={tasksDue > 0 && <Badge n={tasksDue} />}
      />
      <Nav
        href="#/people"
        icon={<Users className="size-4" />}
        label="People"
        current={place.at === 'people'}
      />
      <div className="mt-3 min-h-0 flex-1 overflow-y-auto">
        {modules.length === 0 && online && (
          <div className="px-2 py-1 text-rail-ink-3 text-sm">
            Modules appear here as you ask for them.
          </div>
        )}
        {tops(modules).map((m) => (
          <ModuleItem
            key={m.id}
            m={m}
            modules={modules}
            here={here}
            folded={layout.folded}
            onFold={fold}
          />
        ))}
        <button
          type="button"
          onClick={onNew}
          className="flex h-7.5 w-full items-center gap-2.25 rounded-md px-2 text-md text-rail-ink-3 transition-colors hover:bg-rail-hover hover:text-rail-ink"
        >
          <Plus className="size-4 shrink-0" />
          New module
        </button>
      </div>
      <div className="flex flex-col gap-0.5 pt-2">
        <Nav
          href="#/intelligence"
          icon={<Sparkles className="size-4" />}
          label="Intelligence"
          current={
            place.at === 'intelligence' || (place.at === 'item' && place.kind === 'permission')
          }
        />
        <Nav
          href="#/settings"
          icon={<SlidersHorizontal className="size-4" />}
          label="Settings"
          current={place.at === 'settings'}
        />
      </div>
    </nav>
  )
}

// The workspace at the rail's top: its initial on an accent tile and its name. It opens Settings,
// where the workspace is kept.
function Workspace({ name, tileOnly }: { name: string; tileOnly?: boolean }) {
  const label = name ? `${name}'s workspace` : 'Your workspace'
  return (
    <a
      href="#/settings"
      title={label}
      aria-label={tileOnly ? label : undefined}
      className="flex min-w-0 flex-1 items-center gap-2 rounded-md p-1 hover:bg-rail-hover"
    >
      <span className="grid size-6.5 shrink-0 place-items-center rounded-md bg-accent font-semibold text-accent-ink text-md leading-none">
        {(name.trim()[0] ?? 'A').toUpperCase()}
      </span>
      {!tileOnly && <span className="truncate font-semibold text-md">{label}</span>}
    </a>
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
// inside it under it, and a menu to move it into another.
function ModuleItem({
  m,
  modules,
  here,
  folded,
  onFold,
}: {
  m: ModuleSummary
  modules: ModuleSummary[]
  here: string | null
  folded: string[]
  onFold: (id: string) => void
}) {
  const kids = childrenOf(modules, m.id)
  const open = !folded.includes(m.id)
  return (
    <div>
      <div className="group/item relative flex items-center">
        <Nav
          href={`#/module/${m.id}`}
          icon={<Briefcase className="size-4" />}
          label={m.name}
          current={here === m.id}
          extra={<span className="w-11 shrink-0" />}
        />
        <span className="absolute right-0.5 flex items-center">
          <MoveMenu m={m} modules={modules} />
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
            />
          ))}
        </div>
      )}
    </div>
  )
}

// Move into…: every other module it may sit inside (never itself or one of its own), or the top.
function MoveMenu({ m, modules }: { m: ModuleSummary; modules: ModuleSummary[] }) {
  const [open, setOpen] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const anchor = useRef<HTMLButtonElement>(null)
  const own = new Set(inside(modules, m.id))
  const move = async (within: string | null) => {
    try {
      await api.post(`/api/modules/${m.id}/place`, { within })
      setOpen(false)
    } catch (err) {
      setProblem(err instanceof Error ? err.message : 'That did not move.')
    }
  }
  return (
    <>
      <button
        ref={anchor}
        type="button"
        aria-label={`Move ${m.name}`}
        title={`Move ${m.name}`}
        onClick={() => {
          setProblem(null)
          setOpen((o) => !o)
        }}
        className={cn(
          'grid size-6 shrink-0 place-items-center rounded-md text-rail-ink-3 opacity-0 hover:text-rail-ink focus-visible:opacity-100 group-hover/item:opacity-100',
          open && 'opacity-100',
        )}
      >
        <Ellipsis className="size-3.5" />
      </button>
      <Popover anchor={anchor} open={open} onClose={() => setOpen(false)}>
        <div className="px-2.5 pt-1 pb-1.5 font-semibold text-ink-3 text-xs uppercase tracking-label">
          Move {m.name} into
        </div>
        {flat(modules)
          .filter(({ module }) => !own.has(module.id))
          .map(({ module, depth }) => (
            <MenuItem
              key={module.id}
              checked={m.parent === module.id}
              onClick={() => move(module.id)}
            >
              <span className={cn(depth === 1 && 'pl-3', depth > 1 && 'pl-6')}>{module.name}</span>
            </MenuItem>
          ))}
        <MenuLine />
        <MenuItem checked={!m.parent} onClick={() => move(null)}>
          Top level
        </MenuItem>
        {problem && <p className="max-w-60 px-2.5 py-1.5 text-bad text-sm">{problem}</p>}
      </Popover>
    </>
  )
}

// A module's two letters in the folded rail: the first of its first two words, else its first two.
function initials(name: string): string {
  const words = name.trim().split(/\s+/)
  return words.length > 1
    ? `${words[0]?.[0] ?? ''}${words[1]?.[0] ?? ''}`.toUpperCase()
    : `${name.slice(0, 1).toUpperCase()}${name.slice(1, 2)}`
}

// The rail folded to a strip of icons: the same places, each named when hovered.
function Strip({
  modules,
  place,
  here,
  name,
  waiting,
  tasksDue,
  onNew,
  onOpen,
}: {
  modules: ModuleSummary[]
  place: Place
  here: string | null
  name: string
  waiting: number
  tasksDue: number
  onNew: () => void
  onOpen: () => void
}) {
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
      title={label}
      aria-current={current ? 'page' : undefined}
      className={cn(
        'relative grid size-8.5 shrink-0 place-items-center rounded-md text-rail-ink-3 transition-colors hover:bg-rail-hover hover:text-rail-ink',
        current && 'bg-accent-soft text-accent',
      )}
    >
      {child}
      {extra}
    </a>
  )
  return (
    <nav className="flex w-14 shrink-0 flex-col items-center gap-1 overflow-hidden border-rail-line border-r bg-rail pb-2.5 text-rail-ink">
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
        title={'Open the rail (⌘\\)'}
        onClick={onOpen}
        className="mt-1 mb-2 grid size-8.5 shrink-0 place-items-center rounded-md text-rail-ink-3 hover:bg-rail-hover hover:text-rail-ink"
      >
        <PanelLeftOpen className="size-4" />
      </button>
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
        '#/tasks',
        tasksDue ? `Tasks, ${tasksDue} due` : 'Tasks',
        place.at === 'tasks',
        <ListChecks className="size-4" />,
      )}
      {icon('#/people', 'People', place.at === 'people', <Users className="size-4" />)}
      <div className="my-1.5 h-px w-6 shrink-0 bg-rail-line" />
      <div className="flex min-h-0 flex-1 flex-col items-center gap-1 overflow-y-auto">
        {tops(modules).map((m) =>
          icon(
            `#/module/${m.id}`,
            m.name,
            top === m.id,
            <span className="grid h-6 min-w-6 place-items-center rounded-sm bg-rail-hover px-0.5 font-semibold text-rail-ink-2 text-xs">
              {initials(m.name)}
            </span>,
          ),
        )}
        <button
          type="button"
          aria-label="New module"
          title="New module"
          onClick={onNew}
          className="grid size-8.5 shrink-0 place-items-center rounded-md text-rail-ink-3 hover:bg-rail-hover hover:text-rail-ink"
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

// Where a screen sits, for the bar: a few words, the last in bold; each before it opens its place.
export interface Crumb {
  icon?: ReactNode
  parts: { label: string; href?: string | undefined }[]
}

export function Bar({
  crumb,
  onFind,
  lens,
  onClearLens,
}: {
  crumb: Crumb
  onFind: () => void
  lens: { id: string; name: string } | null
  onClearLens: () => void
}) {
  const last = crumb.parts.at(-1)?.label ?? ''
  return (
    <div
      data-tauri-drag-region
      className="flex h-12 shrink-0 items-center gap-2.5 border-hair border-b bg-canvas pr-3.5 pl-6"
    >
      <div className="flex min-w-0 items-center gap-1.5 whitespace-nowrap text-ink-3 text-md">
        {crumb.icon && <span className="shrink-0">{crumb.icon}</span>}
        {crumb.parts.slice(0, -1).map((p) => (
          <span key={`${p.label}${p.href ?? ''}`} className="flex items-center gap-1.5">
            {p.href ? (
              <a href={p.href} className="rounded-sm hover:text-ink hover:underline">
                {p.label}
              </a>
            ) : (
              <span>{p.label}</span>
            )}
            <ChevronRight className="size-3.25" />
          </span>
        ))}
        <b className="truncate font-semibold text-ink">{last}</b>
      </div>
      {lens && (
        <span className="inline-flex h-6 items-center gap-1 rounded-full bg-accent-soft pr-0.75 pl-2.25 font-medium text-accent text-sm">
          Only {lens.name}
          <button
            type="button"
            aria-label={`Show all, not only ${lens.name}`}
            title="Show all"
            onClick={onClearLens}
            className="grid size-5 place-items-center rounded-full hover:bg-accent-line/40"
          >
            <X className="size-3.25" />
          </button>
        </span>
      )}
      <span className="flex-1" data-tauri-drag-region />
      <button
        type="button"
        onClick={onFind}
        className="flex h-7.5 w-52.5 items-center gap-2 rounded-md border border-line bg-surface pr-2 pl-2.5 text-ink-3 text-md transition-colors hover:border-accent-line"
      >
        <Search className="size-3.25 shrink-0" />
        <span className="flex-1 text-left">Find anything</span>
        <Kbd>⌘K</Kbd>
      </button>
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
      { label: 'Conversation', hint: '', href: '#/conversation' },
      { label: 'Tasks', hint: '', href: '#/tasks' },
      { label: 'New task', hint: 'Tasks', href: '#/tasks?list=open' },
      { label: 'People', hint: '', href: '#/people' },
      { label: 'Organizations', hint: 'People', href: '#/people?companies' },
      { label: 'Activity', hint: '', href: '#/activity' },
      { label: 'Intelligence', hint: '', href: '#/intelligence' },
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
