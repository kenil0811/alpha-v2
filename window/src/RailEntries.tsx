// The rail's rows: Home, Agents and Tasks and each module as one list, a row's link, a pinned
// item's tile above Home, and Home, Agents or Tasks as a row with the same menu as a module's. Out
// of Shell.tsx, which holds the rail itself.
import type { ModuleSummary } from '@alpha/core/api'
import { House, ListChecks, MessageSquare } from 'lucide-react'
import type { ReactNode } from 'react'
import { api } from './api.ts'
import { type Hiding, ModuleMenu, shownTops } from './ModuleMenu.tsx'
import { ModuleIcon } from './moduleIcon.tsx'
import type { Place } from './place.ts'
import { landingOf } from './tree.ts'
import { cn } from './ui/cn.ts'
import { useContextMenu } from './ui/popover.tsx'
import { Renamable } from './ui/rename.tsx'
import { Roll } from './ui/roll.tsx'

export function Nav({
  href,
  icon,
  label,
  current,
  extra,
  small,
  onDoubleClick,
}: {
  href: string
  icon: ReactNode
  label: string
  current: boolean
  extra?: ReactNode
  small?: boolean
  onDoubleClick?: (() => void) | undefined
}) {
  return (
    <a
      href={href}
      onDoubleClick={onDoubleClick}
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

// What the rail lists: Home, Agents and Tasks, then each module, one list. Pinned ones come first,
// above Home, in the order pinned, whichever they are; the rest keep their places.
export type Entry = {
  id: string
  label: string
  href: string
  icon: ReactNode
  tip?: string // the strip's name for it, when it says more than the label
  badge?: number
  dot?: boolean // the strip's dot for what waits
  on?: boolean // for Home, Agents and Tasks: its screen is open
  m?: ModuleSummary // a module; none: Home, Agents or Tasks
}

export function entriesOf(
  modules: ModuleSummary[],
  place: Place,
  waiting: number,
  tasksDue: number,
  hidden: string[],
  pinned: string[],
): Entry[] {
  const all: Entry[] = [
    {
      id: 'home',
      label: 'Home',
      href: '#/',
      icon: <House className="size-4" />,
      tip: waiting ? `Home, ${waiting} waiting for you` : 'Home',
      badge: waiting,
      dot: waiting > 0,
      on: place.at === 'home',
    },
    {
      id: 'agents',
      label: 'Agents',
      href: '#/conversation',
      icon: <MessageSquare className="size-4" />,
      on: place.at === 'conversation' || place.at === 'agent',
    },
    {
      id: 'tasks',
      label: 'Tasks',
      href: '#/tasks',
      icon: <ListChecks className="size-4" />,
      tip: tasksDue ? `Tasks, ${tasksDue} due` : 'Tasks',
      badge: tasksDue,
      on: place.at === 'tasks',
    },
    ...shownTops(modules, hidden).map((m) => ({
      id: m.id,
      label: m.name,
      href: landingOf(modules, m),
      icon: <ModuleIcon name={m.name} className="size-4" />,
      m,
    })),
  ]
  return [
    ...pinned.flatMap((id) => all.filter((e) => e.id === id)),
    ...all.filter((e) => !pinned.includes(e.id)),
  ]
}

// Home, Agents and Tasks have no module behind them, so the menu greys what a module alone can do.
const stub = (e: Entry) => e.m ?? ({ id: e.id, name: e.label, parent: null } as ModuleSummary)

// A pinned item: a small square tile, its icon only, its name in the hover; right-click gives the
// same menu as its row, and Rename edits the name in the tile's place.
export function PinnedTile({
  e,
  modules,
  here,
  hiding,
}: {
  e: Entry
  modules: ModuleSummary[]
  here: string | null
  hiding: Hiding
}) {
  const menu = useContextMenu()
  const on = e.m ? here === e.id : e.on
  return (
    <div {...menu.on}>
      <Renamable
        name={e.label}
        className="w-36"
        rename={e.m ? (to) => api.post(`/api/modules/${e.id}/name`, { name: to }) : null}
      >
        {(start) => (
          <>
            <a
              href={e.href}
              aria-label={e.label}
              data-tip={e.label}
              aria-current={on ? 'page' : undefined}
              className="grid size-8 place-items-center rounded-md bg-rail-hover/60 text-rail-ink-2 transition-colors hover:bg-rail-hover hover:text-rail-ink aria-[current=page]:bg-rail-sel aria-[current=page]:text-rail-ink"
            >
              {e.icon}
            </a>
            {/* its ⋮ is the row's; a tile opens the menu by a right-click only */}
            <span className="hidden">
              <ModuleMenu
                m={stub(e)}
                modules={modules}
                hiding={hiding}
                point={menu.point}
                onShut={menu.close}
                onRename={start}
                fixed={!e.m}
              />
            </span>
          </>
        )}
      </Renamable>
    </div>
  )
}

// Home, Agents or Tasks in the list: the same row as a module, with the same menu.
export function FixedItem({
  e,
  modules,
  hiding,
}: {
  e: Entry
  modules: ModuleSummary[]
  hiding: Hiding
}) {
  const menu = useContextMenu()
  return (
    <div {...menu.on} className="group/item relative flex items-center rounded-md">
      <Nav
        href={e.href}
        icon={e.icon}
        label={e.label}
        current={!!e.on}
        extra={
          <>
            {!!e.badge && <Badge n={e.badge} />}
            <span className="w-11 shrink-0" />
          </>
        }
      />
      <span className="absolute right-0.5 flex items-center">
        <ModuleMenu
          m={stub(e)}
          modules={modules}
          hiding={hiding}
          point={menu.point}
          onShut={menu.close}
          onRename={undefined}
          fixed
        />
        <span className="size-6 shrink-0" />
      </span>
    </div>
  )
}

export function Badge({ n }: { n: number }) {
  return (
    <span className="grid h-4.5 min-w-4.5 place-items-center rounded-full bg-accent px-1.25 font-semibold text-accent-ink text-xs">
      <Roll value={n} />
    </span>
  )
}
