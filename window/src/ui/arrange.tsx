// Cards the person moves and resizes (Vikas, 1 Nov): a page's cards in columns, each column rows
// of cards side by side. A card's handle shows on hover at its head; dragged onto another card's
// left or right edge it goes beside it, onto its top or bottom half above or below it, below a
// column's last card to that column's foot. The arrows on the focused handle move it too. Its
// bottom-right corner resizes it, nothing drawn there, only the pointer turning ("I don't want the
// arrow to appear on hover"); the arrows on the focused corner step it, a double-click gives its
// size back. A card is at least 256px wide, so two share a row when there is room ("ideally we
// can have two columns of card unless the cards demand prime real estate"); a card someone sized
// keeps its width. Menus and tips float against the window (S7), so a card's scroll never cuts
// them off.
// ponytail: kept in memory while the window is open; per person waits on the core (layout.ts).
import { GripVertical } from 'lucide-react'
import {
  Fragment,
  isValidElement,
  type ReactNode,
  type PointerEvent as ReactPointerEvent,
  useReducer,
  useRef,
  useState,
} from 'react'
import { cn } from './cn.ts'

export type Side = 'left' | 'right' | 'top' | 'bottom'
export type Columns = string[][][] // columns of rows of card ids
type Size = { w?: number; h?: number } // px

// What the page shows: what was kept (or the start), each card once, a card new to the page at
// the foot of the column it starts in. Cards not shown just now keep their places.
export function placed(saved: Columns | undefined, start: string[][], ids: string[]): Columns {
  const seen = new Set<string>()
  const cols = (saved ?? start.map((c) => c.map((id) => [id]))).map((c) =>
    c.map((r) => r.filter((id) => !seen.has(id) && seen.add(id))).filter((r) => r.length),
  )
  for (const id of ids)
    if (!seen.has(id))
      cols[
        Math.max(
          0,
          start.findIndex((c) => c.includes(id)),
        )
      ]?.push([id])
  return cols
}

// One card moved beside, above or below another; or, given a column's number, to its foot.
export function movedIn(cols: Columns, id: string, to: string | number, side: Side): Columns {
  if (id === to) return cols
  const out = cols.map((c) => c.map((r) => r.filter((k) => k !== id)).filter((r) => r.length))
  if (typeof to === 'number') {
    out[to]?.push([id])
    return out
  }
  const col = out.find((c) => c.some((r) => r.includes(to)))
  if (!col) return cols
  const at = col.findIndex((r) => r.includes(to))
  const row = col[at] as string[]
  if (side === 'left' || side === 'right')
    row.splice(row.indexOf(to) + (side === 'right' ? 1 : 0), 0, id)
  else col.splice(at + (side === 'bottom' ? 1 : 0), 0, [id])
  return out
}

// The arrows on a handle, over the rows shown in the order the columns stack: left and right
// within its row; up and down out of a shared row first, then past the next row, into the next
// column at its top or the one before at its foot.
export function nudged(cols: Columns, shown: Columns, id: string, key: string): Columns {
  const rows = shown.flatMap((c, i) => c.map((r) => ({ c: i, r })))
  const at = rows.findIndex((x) => x.r.includes(id))
  const here = rows[at]
  if (!here) return cols
  const i = here.r.indexOf(id)
  const alone = here.r.length === 1
  const near = rows[at + (key === 'ArrowUp' ? -1 : 1)]
  const to: [string | undefined, Side] =
    key === 'ArrowLeft'
      ? [here.r[i - 1], 'left']
      : key === 'ArrowRight'
        ? [here.r[i + 1], 'right']
        : !alone
          ? [here.r.find((k) => k !== id), key === 'ArrowUp' ? 'top' : 'bottom']
          : [near?.r[0], (near?.c === here.c) === (key === 'ArrowUp') ? 'top' : 'bottom']
  return to[0] ? movedIn(cols, id, to[0], to[1]) : cols
}

// each page's arrangement while the window is open
const kept = new Map<string, { cols?: Columns; size: Record<string, Size> }>()
const MIN_W = 256
const MIN_H = 80
const STEP = 16
const ARROWS: Record<string, [number, number]> = {
  ArrowRight: [STEP, 0],
  ArrowLeft: [-STEP, 0],
  ArrowDown: [0, STEP],
  ArrowUp: [0, -STEP],
}

export function Arranged({
  page,
  start,
  className,
  gap,
  children,
}: {
  page: string
  start: string[][] // each column's cards, top to bottom
  className?: string // the page's box: the columns' grid, or what holds its one column
  gap: string // between cards, down and across
  children: ReactNode
}) {
  const [, redraw] = useReducer((n: number) => n + 1, 0)
  const root = useRef<HTMLDivElement>(null)
  const [over, setOver] = useState<{ to: string | number; side: Side } | null>(null)
  const [moving, setMoving] = useState<string | null>(null)
  const [live, setLive] = useState<{ id: string; size: Size } | null>(null)
  const state = kept.get(page) ?? { size: {} }
  kept.set(page, state)

  // a card is a child whose key is one of start's, named by its title; the others come first
  const ids = new Set(start.flat())
  const blocks = new Map<string, { name: string; node: ReactNode }>()
  const lead: ReactNode[] = []
  for (const c of [children].flat(2) as ReactNode[])
    if (isValidElement<{ title?: string }>(c) && c.key !== null && ids.has(c.key))
      blocks.set(c.key, { name: c.props.title ?? '', node: c })
    else if (c != null && c !== false) lead.push(<Fragment key={lead.length}>{c}</Fragment>)
  const cols = placed(state.cols, start, [...blocks.keys()])
  const shown = cols.map((c) =>
    c.map((r) => r.filter((id) => blocks.has(id))).filter((r) => r.length),
  )

  const keep = (next: Columns, focus?: string) => {
    state.cols = next
    redraw()
    if (focus)
      requestAnimationFrame(() =>
        root.current?.querySelector<HTMLElement>(`[data-move="${focus}"]`)?.focus(),
      )
  }
  const sized = (id: string, size: Size | null) => {
    if (size) state.size[id] = size
    else delete state.size[id]
    redraw()
  }

  // where the pointer is, while a card is carried: beside, above or below a card, or a column's foot
  const target = (x: number, y: number, id: string) => {
    const el = document.elementFromPoint(x, y)
    const block = el?.closest<HTMLElement>('[data-block]')
    if (block && root.current?.contains(block)) {
      const to = block.dataset.block as string
      if (to === id) return null
      const r = block.getBoundingClientRect()
      const fx = (x - r.left) / r.width
      const side: Side =
        fx < 0.25 ? 'left' : fx > 0.75 ? 'right' : y - r.top < r.height / 2 ? 'top' : 'bottom'
      return { to, side }
    }
    const col = el?.closest<HTMLElement>('[data-col]')
    return col && root.current?.contains(col)
      ? { to: Number(col.dataset.col), side: 'bottom' as Side }
      : null
  }
  const carry = (e: ReactPointerEvent, id: string) => {
    if (e.button !== 0) return
    e.preventDefault()
    let to: typeof over = null
    let at: { x: number; y: number } | null = null // until the pointer moves, nothing rolls
    setMoving(id)
    const look = () => {
      if (!at) return
      to = target(at.x, at.y, id)
      setOver(to)
    }
    const move = (m: PointerEvent) => {
      at = { x: m.clientX, y: m.clientY }
      look()
    }
    // held near the page's top or foot, the page scrolls, to carry a card to one out of sight
    const box = root.current?.closest<HTMLElement>('.overflow-y-auto')
    let frame = 0
    const roll = () => {
      const r = box?.getBoundingClientRect()
      const by = !r || !at ? 0 : at.y < r.top + 48 ? -12 : at.y > r.bottom - 48 ? 12 : 0
      if (box && by) {
        box.scrollTop += by
        look()
      }
      frame = requestAnimationFrame(roll)
    }
    frame = requestAnimationFrame(roll)
    const end = (drop: boolean) => () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('keydown', esc)
      setMoving(null)
      setOver(null)
      if (drop && to) keep(movedIn(cols, id, to.to, to.side))
    }
    const up = end(true)
    const esc = (k: KeyboardEvent) => k.key === 'Escape' && end(false)()
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('keydown', esc)
  }
  const resize = (e: ReactPointerEvent<HTMLElement>, id: string) => {
    if (e.button !== 0) return
    e.preventDefault()
    const card = e.currentTarget.parentElement
    const row = card?.parentElement
    if (!card || !row) return
    const r = card.getBoundingClientRect()
    const most = row.getBoundingClientRect().width
    let size: Size | null = null
    const move = (m: PointerEvent) => {
      size = {
        w: Math.round(Math.min(most, Math.max(MIN_W, m.clientX - r.left))),
        h: Math.round(Math.max(MIN_H, m.clientY - r.top)),
      }
      setLive({ id, size })
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      setLive(null)
      if (size) sized(id, size)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }
  const line = (side: Side) => (
    <span
      aria-hidden="true"
      className={cn(
        'pointer-events-none absolute z-2 rounded-full bg-accent',
        side === 'left' && '-left-2 inset-y-0 w-1',
        side === 'right' && '-right-2 inset-y-0 w-1',
        side === 'top' && '-top-2 inset-x-0 h-1',
        side === 'bottom' && '-bottom-2 inset-x-0 h-1',
      )}
    />
  )

  const column = (col: string[][], c: number) => (
    <div
      key={c}
      data-col={c}
      className={cn('relative flex min-w-0 flex-col', gap, shown.length > 1 && 'min-h-24')}
    >
      {col.map((row) => (
        <div key={row.join('|')} className={cn('flex flex-wrap items-start', gap)}>
          {row.map((id) => {
            const b = blocks.get(id) as { name: string; node: ReactNode }
            const size = live?.id === id ? live.size : state.size[id]
            return (
              <div
                key={id}
                data-block={id}
                className={cn(
                  'group/block relative min-w-0',
                  size?.w ? 'max-w-full shrink-0 grow-0' : 'flex-1 basis-64',
                  moving === id && 'opacity-50',
                )}
                style={size?.w ? { flexBasis: size.w } : undefined}
              >
                <button
                  type="button"
                  data-move={id}
                  aria-label={`Move ${b.name}`}
                  data-tip={`Drag to move ${b.name}; the arrows move it too`}
                  onPointerDown={(e) => carry(e, id)}
                  onKeyDown={(e) => {
                    if (!e.key.startsWith('Arrow')) return
                    e.preventDefault()
                    keep(nudged(cols, shown, id, e.key), id)
                  }}
                  className={cn(
                    '-left-5 absolute top-0 z-1 grid h-6 w-4 cursor-grab touch-none place-items-center rounded-sm text-ink-3 opacity-0 hover:bg-hover hover:text-ink focus-visible:opacity-100 group-hover/block:opacity-100',
                    moving === id && 'cursor-grabbing opacity-100',
                  )}
                >
                  <GripVertical className="size-3.5" />
                </button>
                <div
                  className={size?.h ? 'overflow-y-auto' : undefined}
                  style={size?.h ? { height: size.h } : undefined}
                >
                  {b.node}
                </div>
                {/* biome-ignore lint/a11y/useSemanticElements: a resize corner, held by the pointer or the arrows */}
                <div
                  role="separator"
                  tabIndex={0}
                  aria-label={`Resize ${b.name}`}
                  aria-valuenow={size?.w ?? 0}
                  onPointerDown={(e) => resize(e, id)}
                  onDoubleClick={() => sized(id, null)}
                  onKeyDown={(e) => {
                    const d = ARROWS[e.key]
                    if (!d) return
                    e.preventDefault()
                    const card = e.currentTarget.parentElement?.getBoundingClientRect()
                    const most =
                      e.currentTarget.parentElement?.parentElement?.getBoundingClientRect().width ??
                      MIN_W
                    sized(id, {
                      w: Math.min(most, Math.max(MIN_W, (size?.w ?? card?.width ?? 0) + d[0])),
                      h: Math.max(MIN_H, (size?.h ?? card?.height ?? 0) + d[1]),
                    })
                  }}
                  className="absolute right-0 bottom-0 z-1 size-4 cursor-nwse-resize touch-none rounded-br-lg outline-none focus-visible:ring-2 focus-visible:ring-accent-line"
                />
                {over?.to === id && line(over.side)}
              </div>
            )
          })}
        </div>
      ))}
      {over?.to === c && line(col.length ? 'bottom' : 'top')}
    </div>
  )

  return (
    <div ref={root} className={className}>
      {lead}
      {shown.map(column)}
    </div>
  )
}
