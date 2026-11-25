// A record's page, the same for a row, a person and an organization: its head (its mark, a line
// naming what it is, its title, a line under it, Ask about this), then a row of tabs under the
// head, then Summary: the properties across the width and the blocks' starts.
// Every block has a place, kept per person for every record of its table (Vikas, 25 Nov): on
// Summary, as a tab, both, or nowhere, chosen from its right-click (a tab's, or a block's heading)
// with Move left and Move right; tabs, Summary among them, drag into an order, and the blocks on
// Summary keep the same order. A block that holds nothing shows nowhere.
import type { RecordKept } from '@alpha/core/api'
import { Sparkles } from 'lucide-react'
import { type ReactNode, useState } from 'react'
import { startAsk } from './ask.ts'
import { NO_RECORD, useLayout } from './layout.ts'
import { InBar } from './ui/bar-slot.tsx'
import { Button } from './ui/button.tsx'
import { cn } from './ui/cn.ts'
import { List } from './ui/list.tsx'
import { MenuHeading, MenuItem, MenuLine, Popover } from './ui/popover.tsx'
import { Section } from './ui/section.tsx'
import { Tabs } from './ui/tabs.tsx'

// One block: what every block of every record keeps to
export interface Block {
  key: string
  title: string
  about?: string
  count?: number // how many it holds; 0 is nothing, and the block shows nowhere
  short?: ReactNode // its start, on Summary; none: it starts as a tab (a module's page)
  full?: ReactNode // the whole of it, on its tab; none: its start is all of it
  wide?: boolean // the whole width on Summary (the note)
}

// Where a block shows, as a number kept per block: 0 nowhere, 1 Summary, 2 a tab, 3 both
export const SUMMARY = 1
export const TAB = 2
const SUMMARY_KEY = 'summary'

// A block's place until the person moves it: a page of its own (no start) is a tab; one pinned to
// the tabs before this was both; any other starts on Summary, with All opening it whole.
export function placeOf(b: Block, kept: RecordKept): number {
  const given = kept.places?.[b.key]
  if (given !== undefined) return given
  if (!b.short) return TAB
  return kept.tabs.includes(b.key) ? SUMMARY | TAB : SUMMARY
}

// Every key in the person's order: as they dragged or moved it, the rest in the page's own order
// with Summary first.
export function orderOf(keys: string[], kept: RecordKept): string[] {
  const own = [SUMMARY_KEY, ...keys]
  const rank = (k: string) => {
    const i = kept.tabs.indexOf(k)
    return i < 0 ? kept.tabs.length + own.indexOf(k) : i
  }
  return own.slice().sort((a, b) => rank(a) - rank(b))
}

// The order with one key moved next to another: before it going left, after it going right.
export function moved(order: string[], key: string, next: string, left: boolean): string[] {
  const out = order.filter((k) => k !== key)
  const at = out.indexOf(next)
  out.splice(left ? at : at + 1, 0, key)
  return out
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
  scope: string // whose places it keeps: the row's table id, or person or company
  name: string // its name, for Ask about this
  mark?: ReactNode
  title: ReactNode
  under?: ReactNode
  head?: ReactNode // what stays under the head on every tab (a refusal, This is you)
  properties: ReactNode
  blocks: Block[]
}) {
  const [tab, setTab] = useState(SUMMARY_KEY)
  const [menu, setMenu] = useState<{
    key: string
    on: 'tab' | 'card'
    x: number
    y: number
  } | null>(null)
  // the person's own for every record of its table (or of People's, Organizations'), kept by the
  // core per person and table
  const { layout, change } = useLayout()
  const kept = layout.records[scope] ?? NO_RECORD
  const keep = (next: Partial<RecordKept>) =>
    change({ records: { ...layout.records, [scope]: { ...kept, ...next } } })
  const held = blocks.filter((b) => b.count !== 0)
  const order = orderOf(
    blocks.map((b) => b.key),
    kept,
  )
  const ranked = (list: Block[]) =>
    list.slice().sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key))
  const place = (b: Block) => placeOf(b, kept)
  const asTabs = ranked(held.filter((b) => place(b) & TAB))
  const onSummary = ranked(held.filter((b) => place(b) & SUMMARY))
  const hidden = held.filter((b) => place(b) === 0)
  // the tab open: one of the tabs, or a Summary block opened whole from its All while it is open
  const open = held.find((b) => b.key === tab && (place(b) & TAB || b.full))
  const bar = [
    SUMMARY_KEY,
    ...asTabs.map((b) => b.key),
    ...(open && !(place(open) & TAB) ? [open.key] : []),
  ].sort((a, b) => order.indexOf(a) - order.indexOf(b))
  const setPlace = (key: string, to: number) => {
    keep({ places: { ...kept.places, [key]: to } })
    if (!(to & TAB) && tab === key) setTab(SUMMARY_KEY)
  }
  // moving a block left or right among those beside it: the tabs, or the blocks on Summary
  const neighbours = (on: 'tab' | 'card') =>
    on === 'tab' ? bar : onSummary.filter((b) => b.short ?? b.full).map((b) => b.key)
  const step = (key: string, on: 'tab' | 'card', left: boolean) => {
    const list = neighbours(on)
    const next = list[list.indexOf(key) + (left ? -1 : 1)]
    if (next) keep({ tabs: moved(order, key, next, left) })
  }
  const menuOf = (key: string, on: 'tab' | 'card') => (at: { x: number; y: number }) =>
    setMenu({ key, on, ...at })
  const here = window.location.hash
  const block = (key: string) => blocks.find((b) => b.key === key)
  const menuBlock = menu && block(menu.key)
  const menuList = menu ? neighbours(menu.on) : []
  const menuAt = menu ? menuList.indexOf(menu.key) : -1
  return (
    <div className="@container h-full overflow-y-auto">
      {/* its name is the bar's title, where a double-click renames it; the bar's way back has the
          path under it */}
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
            onMove={(from, to) =>
              keep({ tabs: moved(order, from, to, order.indexOf(from) > order.indexOf(to)) })
            }
            tabs={bar.map((key) => {
              const b = block(key)
              return {
                key,
                href: here,
                label: b ? b.title : 'Summary',
                ...(b ? { count: b.count } : {}),
                sel: b ? open?.key === key : !open,
                drag: true,
                onPick: () => setTab(key),
                onMenu: menuOf(key, 'tab'),
              }
            })}
          />
          <Button size="sm" onClick={() => startAsk(`About ${name}: `)}>
            <Sparkles className="size-3.5" />
            Ask about this
          </Button>
        </div>
        {open ? (
          <Section title={open.title} {...(open.about ? { about: open.about } : {})}>
            {open.full ?? open.short}
          </Section>
        ) : (
          <>
            {properties}
            <div className="grid items-start gap-x-8 gap-y-7 @3xl:grid-cols-2">
              {onSummary.map((b) => (
                // biome-ignore lint/a11y/noStaticElementInteractions: a block's heading right-click places it; its tab's menu does too
                <div
                  key={b.key}
                  className={cn('min-w-0', b.wide && '@3xl:col-span-2')}
                  onContextMenu={(e) => {
                    if ((e.target as HTMLElement).closest('h2,h3') === null) return
                    e.preventDefault()
                    menuOf(b.key, 'card')({ x: e.clientX, y: e.clientY })
                  }}
                >
                  <Section
                    small
                    title={b.title}
                    {...(b.about ? { about: b.about } : {})}
                    action={
                      b.full && b.short ? (
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
                    {b.short ?? b.full}
                  </Section>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
      <Popover point={menu && { x: menu.x, y: menu.y }} open={!!menu} onClose={() => setMenu(null)}>
        {menu && (
          <div role="menu" className="flex min-w-48 flex-col p-1">
            {menuBlock && (
              <>
                <MenuHeading>Show {menuBlock.title}</MenuHeading>
                <MenuItem
                  checked={!!(place(menuBlock) & SUMMARY)}
                  onClick={() => {
                    setPlace(menuBlock.key, place(menuBlock) ^ SUMMARY)
                    setMenu(null)
                  }}
                >
                  On Summary
                </MenuItem>
                <MenuItem
                  checked={!!(place(menuBlock) & TAB)}
                  onClick={() => {
                    setPlace(menuBlock.key, place(menuBlock) ^ TAB)
                    setMenu(null)
                  }}
                >
                  As a tab
                </MenuItem>
                <MenuItem
                  onClick={() => {
                    setPlace(menuBlock.key, 0)
                    setMenu(null)
                  }}
                >
                  Hide
                </MenuItem>
                <MenuLine />
              </>
            )}
            <MenuItem
              disabled={menuAt <= 0}
              onClick={() => {
                step(menu.key, menu.on, true)
                setMenu(null)
              }}
            >
              Move left
            </MenuItem>
            <MenuItem
              disabled={menuAt < 0 || menuAt >= menuList.length - 1}
              onClick={() => {
                step(menu.key, menu.on, false)
                setMenu(null)
              }}
            >
              Move right
            </MenuItem>
            {hidden.length > 0 && (
              <>
                <MenuLine />
                <MenuHeading>Show again</MenuHeading>
                {hidden.map((b) => (
                  <MenuItem
                    key={b.key}
                    onClick={() => {
                      setPlace(b.key, b.short ? SUMMARY : TAB)
                      setMenu(null)
                    }}
                  >
                    {b.title}
                  </MenuItem>
                ))}
              </>
            )}
          </div>
        )}
      </Popover>
    </div>
  )
}

// The frame a block's contents sit in: one border, never a card in a card
export function Framed({ children }: { children: ReactNode }) {
  return <List>{children}</List>
}
