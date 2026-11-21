// PROTOTYPE (Vikas, 20 Nov). A record's page, the
// same for a row, a person and an organization: its head (its mark, a line naming what it is, its
// title, a line under it, Ask about this), then a row of tabs under the head: Summary first, then a
// tab for each block the person pinned there, kept per person for every record of its table (a
// tab's or a block heading's right-click: Pin to the tabs or Unpin, as the rail's Pin to top).
// Summary has the properties across the width, then each block's start; a block's All opens it
// whole, as a tab while it is open. A block that holds nothing shows nowhere.
import { Pin, PinOff, Sparkles } from 'lucide-react'
import { type ReactNode, useState } from 'react'
import { startAsk } from './ask.ts'
import { useLayout } from './layout.ts'
import { InBar } from './ui/bar-slot.tsx'
import { Button } from './ui/button.tsx'
import { cn } from './ui/cn.ts'
import { MenuItem, Popover } from './ui/popover.tsx'
import { Section } from './ui/section.tsx'
import { Tabs } from './ui/tabs.tsx'

// One block: what every block of every record keeps to
export interface Block {
  key: string
  title: string
  about?: string
  count?: number // how many it holds; 0 is nothing, and the block shows nowhere
  short: ReactNode // its start, on Summary
  full?: ReactNode // the whole of it, on its tab; none: Summary shows all of it, and it has no tab
  wide?: boolean // the whole width on Summary (the note)
}

export function RecordPage({
  scope,
  name,
  mark,
  title,
  under,
  head,
  properties,
  blocks,
}: {
  scope: string // whose pins it keeps: the row's table id, or person or company
  name: string // its name, for Ask about this
  mark?: ReactNode
  title: ReactNode
  under?: ReactNode
  head?: ReactNode // what stays under the head on every tab (a refusal, This is you)
  properties: ReactNode
  blocks: Block[]
}) {
  const [tab, setTab] = useState('summary')
  const [menu, setMenu] = useState<{ key: string; x: number; y: number } | null>(null)
  const { layout, change } = useLayout()
  const pinKey = (key: string) => `${scope}:${key}`
  const pinned = (key: string) => layout.recordTabs.includes(pinKey(key))
  const shown = blocks.filter((b) => b.count !== 0)
  const open = shown.find((b) => b.key === tab && b.full)
  // in the order pinned; one opened from its All shows as a tab while it is open
  const tabs = [
    ...layout.recordTabs.flatMap((k) => shown.filter((b) => b.full && pinKey(b.key) === k)),
    ...(open && !pinned(open.key) ? [open] : []),
  ]
  const toggle = (key: string) =>
    change({
      recordTabs: pinned(key)
        ? layout.recordTabs.filter((k) => k !== pinKey(key))
        : [...layout.recordTabs, pinKey(key)],
    })
  const menuOf = (key: string) => (at: { x: number; y: number }) => setMenu({ key, ...at })
  const here = window.location.hash
  return (
    <div className="@container h-full overflow-y-auto">
      {/* its name is the bar's title, where a double-click renames it; the bar's way back has the
          path under it (Vikas, 20 Nov) */}
      <InBar>{title}</InBar>
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-8 pt-5 pb-12">
        {(mark || under) && (
          <div className="flex items-center gap-4">
            {mark}
            {under && <div className="min-w-0 flex-1 text-ink-2 text-md">{under}</div>}
          </div>
        )}
        {head}
        {/* the tabs, and Ask about this at the right of their line */}
        <div className="-mx-5 flex items-center gap-3 border-line border-b pr-5 [&>[role=tablist]]:flex-1 [&>[role=tablist]]:border-b-0">
          <Tabs
            under
            label={name}
            tabs={[
              {
                key: 'summary',
                href: here,
                label: 'Summary',
                sel: !open,
                onPick: () => setTab('summary'),
              },
              ...tabs.map((b) => ({
                key: b.key,
                href: here,
                label: b.title,
                count: b.count,
                sel: open?.key === b.key,
                onPick: () => setTab(b.key),
                onMenu: menuOf(b.key),
              })),
            ]}
          />
          <Button size="sm" onClick={() => startAsk(`About ${name}: `)}>
            <Sparkles className="size-3.5" />
            Ask about this
          </Button>
        </div>
        {open ? (
          <Section title={open.title} {...(open.about ? { about: open.about } : {})}>
            {open.full}
          </Section>
        ) : (
          <>
            {properties}
            <div className="grid items-start gap-x-8 gap-y-7 @3xl:grid-cols-2">
              {shown.map((b) => (
                // biome-ignore lint/a11y/noStaticElementInteractions: a block's right-click pins it; its tab's menu does too
                <div
                  key={b.key}
                  className={cn('min-w-0', b.wide && '@3xl:col-span-2')}
                  onContextMenu={
                    b.full
                      ? (e) => {
                          if ((e.target as HTMLElement).closest('h3') === null) return
                          e.preventDefault()
                          menuOf(b.key)({ x: e.clientX, y: e.clientY })
                        }
                      : undefined
                  }
                >
                  <Section
                    small
                    title={b.title}
                    {...(b.about ? { about: b.about } : {})}
                    action={
                      b.full ? (
                        <button
                          type="button"
                          onClick={() => setTab(b.key)}
                          className="text-accent text-sm hover:underline"
                        >
                          {b.count ? `All ${b.count}` : 'All'}
                        </button>
                      ) : undefined
                    }
                  >
                    {b.short}
                  </Section>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
      <Popover point={menu && { x: menu.x, y: menu.y }} open={!!menu} onClose={() => setMenu(null)}>
        {menu && (
          <MenuItem
            onClick={() => {
              toggle(menu.key)
              setMenu(null)
            }}
          >
            {pinned(menu.key) ? (
              <PinOff className="size-3.5 text-ink-3" />
            ) : (
              <Pin className="size-3.5 text-ink-3" />
            )}
            {pinned(menu.key) ? 'Unpin from the tabs' : 'Pin to the tabs'}
          </MenuItem>
        )}
      </Popover>
    </div>
  )
}

// The frame a block's contents sit in: one border, never a card in a card
export function Framed({ children }: { children: ReactNode }) {
  return <div className="overflow-hidden rounded-lg border border-line bg-surface">{children}</div>
}
