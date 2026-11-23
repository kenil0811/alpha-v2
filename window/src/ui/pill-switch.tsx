// The pill switch in the bar: a screen's own pages (a module's tables and pages, Network's People
// and Organizations, Tasks' lists) as pills, each label 15 characters at most (ui/fit.tsx), the chosen
// one raised; a row too long scrolls sideways. Cuts of one list are cut buttons (ui/cut.tsx),
// never pills. A module's table pills (`keeping`) are dragged to reorder, and a right-click holds
// Move left and Move right after the table's own menu (TableTab), with the hidden ones to show again.
import { ArrowLeft, ArrowRight, Eye } from 'lucide-react'
import { type MouseEvent, type ReactNode, useState } from 'react'
import { openLink } from '../opened.ts'
import { cn } from './cn.ts'
import { Fit } from './fit.tsx'
import { MenuHeading, MenuItem, MenuLine, Popover, useContextMenu } from './popover.tsx'
import type { TabKeeping } from './tab-order.ts'
import { Maybe, type Tab } from './tabs.tsx'

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
  const [over, setOver] = useState(false)
  // the table's one menu (TableTab) takes these lines after its own
  const extra = keeping
    ? (close: () => void) => (
        <>
          <MenuLine />
          <MenuItem
            onClick={() => {
              close()
              keeping.step(t.key, -1)
            }}
          >
            <ArrowLeft className="size-3.5 text-ink-3" />
            Move left
          </MenuItem>
          <MenuItem
            onClick={() => {
              close()
              keeping.step(t.key, 1)
            }}
          >
            <ArrowRight className="size-3.5 text-ink-3" />
            Move right
          </MenuItem>
          {keeping.hidden.length > 0 && <MenuLine />}
          <ShowHidden keeping={keeping} onDone={close} />
        </>
      )
    : undefined
  return (
    <Maybe tab={t} extra={extra}>
      {(on) => (
        <button
          type="button"
          {...on}
          {...(keeping
            ? {
                onContextMenu: (e: MouseEvent) => {
                  e.stopPropagation() // the strip's own menu is for its empty places
                  ;(on as { onContextMenu?: (e: MouseEvent) => void }).onContextMenu?.(e)
                },
              }
            : {})}
          data-href={t.href}
          onClick={(e) => (t.onPick ? t.onPick() : openLink(t.href, e))}
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
          className={cn(
            'group/fit flex h-6.5 shrink-0 select-none items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 text-ink-2 text-md hover:text-ink',
            t.sel && 'bg-surface font-medium text-ink shadow-btn',
            over && 'ring-2 ring-accent',
          )}
        >
          {t.icon && <span className="text-ink-3">{t.icon}</span>}
          <Fit>{t.label}</Fit>
          {t.count !== undefined && (
            <span className="font-normal text-ink-3 text-sm tabular-nums">
              {t.count.toLocaleString()}
            </span>
          )}
        </button>
      )}
    </Maybe>
  )
}
