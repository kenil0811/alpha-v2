// The pill switch in the bar: a screen's own pages (a module's tables and pages, Network's People
// and Organizations, Intelligence's parts, Tasks' lists) as pills, every label in full, the chosen
// one raised; a row too long scrolls sideways. Cuts of one list are cut buttons (ui/cut.tsx),
// never pills. A module's table pills (`keeping`) are dragged to reorder, and a right-click holds
// Move left, Move right and Hide from header, with the hidden ones to show again.
import { ArrowLeft, ArrowRight, Eye, EyeOff } from 'lucide-react'
import { type MouseEvent, type ReactNode, useState } from 'react'
import { cn } from './cn.ts'
import { MenuHeading, MenuItem, MenuLine, Popover, useContextMenu } from './popover.tsx'
import type { TabKeeping } from './tab-order.ts'
import type { Tab } from './tabs.tsx'

const mine = (t: Tab) => t.key.startsWith('t:')
const DRAG = 'text/x-alpha-tab'

export function PillSwitch({
  label,
  tabs,
  keeping,
}: {
  label: string
  tabs: Tab[]
  keeping?: TabKeeping | undefined
}) {
  const strip = useContextMenu()
  return (
    <nav
      aria-label={label}
      {...(keeping?.hidden.length ? { onContextMenu: strip.on.onContextMenu } : {})}
      className="scroll-quiet flex min-w-0 items-center gap-0.5 overflow-x-auto rounded-full bg-sunk p-0.75"
    >
      {tabs.map((t) => (
        <SwitchPill key={t.key} tab={t} keeping={keeping && mine(t) ? keeping : undefined} />
      ))}
      {keeping && (
        <Popover point={strip.point} open={strip.open} onClose={strip.close}>
          <ShowHidden keeping={keeping} onDone={strip.close} />
        </Popover>
      )}
    </nav>
  )
}

function ShowHidden({ keeping, onDone }: { keeping: TabKeeping; onDone: () => void }) {
  if (!keeping.hidden.length) return null
  return (
    <>
      <MenuHeading>Hidden tabs</MenuHeading>
      {keeping.hidden.map((h) => (
        <MenuItem
          key={h.key}
          onClick={() => {
            onDone()
            keeping.show(h.key)
          }}
        >
          <Eye className="size-3.5 text-ink-3" />
          Show {h.label}
        </MenuItem>
      ))}
    </>
  )
}

function SwitchPill({ tab: t, keeping }: { tab: Tab; keeping: TabKeeping | undefined }): ReactNode {
  const menu = useContextMenu()
  const [over, setOver] = useState(false)
  const link = (
    <a
      href={t.href}
      aria-current={t.sel ? 'page' : undefined}
      draggable={keeping ? true : undefined}
      onDragStart={(e) => {
        e.dataTransfer.setData(DRAG, t.key)
        e.dataTransfer.effectAllowed = 'move'
      }}
      onDragOver={(e) => {
        if (!keeping || !e.dataTransfer.types.includes(DRAG)) return
        e.preventDefault()
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        setOver(false)
        const from = e.dataTransfer.getData(DRAG)
        if (keeping && from && from !== t.key) {
          e.preventDefault()
          keeping.move(from, t.key)
        }
      }}
      {...(keeping
        ? {
            onKeyDown: menu.on.onKeyDown,
            onContextMenu: (e: MouseEvent) => {
              e.stopPropagation() // the strip's own menu is for its empty places
              menu.on.onContextMenu(e)
            },
          }
        : {})}
      className={cn(
        'flex h-6.5 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 text-ink-2 text-md hover:text-ink',
        t.sel && 'bg-surface font-medium text-ink shadow-btn',
        over && 'ring-2 ring-accent',
      )}
    >
      {t.icon && <span className="text-ink-3">{t.icon}</span>}
      {t.label}
      {t.count !== undefined && (
        <span className="font-normal text-ink-3 text-sm tabular-nums">
          {t.count.toLocaleString()}
        </span>
      )}
    </a>
  )
  if (!keeping) return link
  const done = (then: () => void) => () => {
    menu.close()
    then()
  }
  return (
    <>
      {link}
      <Popover point={menu.point} open={menu.open} onClose={menu.close}>
        <MenuItem onClick={done(() => keeping.step(t.key, -1))}>
          <ArrowLeft className="size-3.5 text-ink-3" />
          Move left
        </MenuItem>
        <MenuItem onClick={done(() => keeping.step(t.key, 1))}>
          <ArrowRight className="size-3.5 text-ink-3" />
          Move right
        </MenuItem>
        <MenuItem
          reason={t.sel ? 'Open another tab to hide this one.' : undefined}
          onClick={done(() => keeping.hide(t.key))}
        >
          <EyeOff className="size-3.5 text-ink-3" />
          Hide from header
        </MenuItem>
        {keeping.hidden.length > 0 && <MenuLine />}
        <ShowHidden keeping={keeping} onDone={menu.close} />
      </Popover>
    </>
  )
}
