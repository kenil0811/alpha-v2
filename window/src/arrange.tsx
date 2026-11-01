// Blocks the person arranges (Vikas, 29 Oct: "allow user to drag and drop a block to reorganize…
// two blocks next to each other, or one above or below the other"): a page's blocks in rows, each
// row its blocks side by side. A block's handle shows on hover; dropped on the left or right edge
// of another block it goes beside it, on its top or bottom half above or below it. The arrows on
// the handle do the same from the keyboard. Kept while the window is open, never in the browser's
// storage, until the core keeps it per person (design §14); a block new to the page goes at the
// foot. Every card is a block (Vikas,
// 30 Oct), resized from its bottom-right corner alone, which shows only as the cursor (Vikas,
// 30 Oct: "just hovering on the corner of the card, a double-sided arrow can come"): its width, a
// share of its row, and its height are kept with its key as "key@40x320" (40 per cent, 320px;
// "key@40" before heights), so the core keeps rows of strings as before.
import { GripVertical } from 'lucide-react'
import { type DragEvent, type ReactNode, useRef, useState } from 'react'
import { cn } from './ui/cn.ts'

export type Side = 'left' | 'right' | 'top' | 'bottom'
export interface Block {
  key: string
  name: string // said by the handle: "Move Goals"
  node: ReactNode
}

// a kept entry's block, and its width and height when the person set them
export interface Size {
  w: number | null // per cent of its row
  h: number | null // pixels
}
export const keyOf = (entry: string) => entry.replace(/@\d*(x\d+)?$/, '')
export const sizeOf = (entry: string): Size => {
  const m = /@(\d*)(?:x(\d+))?$/.exec(entry)
  return { w: m?.[1] ? Number(m[1]) : null, h: m?.[2] ? Number(m[2]) : null }
}

// The columns a page shows, each rows (Vikas, 30 Oct: "I want cross column moves"): the
// person's, with what is gone left out and what is new at the foot of the column it starts in.
// Each column is kept as its own page, so a page of one column keeps its rows as before.
export function columnsOf(
  saved: (string[][] | undefined)[],
  start: string[][][],
  keys: string[],
): string[][][] {
  const here = new Set(keys)
  const placed = new Set<string>()
  const cols = start.map((s, i) =>
    (saved[i] ?? s)
      .map((r) =>
        r.filter((k) => {
          const key = keyOf(k)
          if (!here.has(key) || placed.has(key)) return false
          placed.add(key)
          return true
        }),
      )
      .filter((r) => r.length),
  )
  for (const k of keys)
    if (!placed.has(k))
      (
        cols[
          Math.max(
            0,
            start.findIndex((c) => c.flat().includes(k)),
          )
        ] as string[][]
      ).push([k])
  return cols
}
export const rowsOf = (saved: string[][] | undefined, start: string[][], keys: string[]) =>
  columnsOf([saved], [start], keys)[0] as string[][]

// On a narrow page the columns stack, the first on top: their rows in that order.
export const stacked = (cols: string[][][]) => cols.flat(1)

// One block moved beside, above or below another, in its column or another; or, given a
// column's number, to that column's foot.
export function movedIn(
  cols: string[][][],
  key: string,
  to: string | number,
  side: Side = 'bottom',
): string[][][] {
  if (key === to) return cols
  const entry = cols.flat(2).find((k) => keyOf(k) === key) ?? key
  const out = cols.map((c) =>
    c.map((r) => r.filter((k) => keyOf(k) !== key)).filter((r) => r.length),
  )
  if (typeof to === 'number') {
    if (!out[to]) return cols
    out[to].push([entry])
    return out
  }
  const col = out.find((c) => c.some((r) => r.some((k) => keyOf(k) === to)))
  if (!col) return cols
  const at = col.findIndex((r) => r.some((k) => keyOf(k) === to))
  const row = col[at] as string[]
  if (side === 'left' || side === 'right')
    row.splice(row.findIndex((k) => keyOf(k) === to) + (side === 'right' ? 1 : 0), 0, entry)
  else col.splice(at + (side === 'bottom' ? 1 : 0), 0, [entry])
  return out
}
export const moved = (rows: string[][], key: string, to: string, side: Side) =>
  movedIn([rows], key, to, side)[0] as string[][]

// One block's size set: its width a share of its row from 20 to 100 per cent, its height at least
// 80px; null gives it back.
export function sized(rows: string[][], key: string, size: Size | null): string[][] {
  const w = size?.w == null ? '' : Math.round(Math.min(100, Math.max(20, size.w)))
  const h = size?.h == null ? '' : `x${Math.round(Math.max(80, size.h))}`
  const entry = w === '' && h === '' ? key : `${key}@${w}${h}`
  return rows.map((r) => r.map((k) => (keyOf(k) === key ? entry : k)))
}

// The default rows: the blocks two to a row, a wide one alone.
export function pairs(keys: string[], wide: (k: string) => boolean = () => false): string[][] {
  const rows: string[][] = []
  for (const k of keys) {
    const last = rows.at(-1)
    if (!wide(k) && last && last.length < 2 && !wide(last[0] as string)) last.push(k)
    else rows.push([k])
  }
  return rows
}

// each page's arrangement, while the window is open
const kept: Record<string, string[][]> = {}

// the arrows on a focused corner: width in fives of a per cent, height in 20px
const NUDGE: Record<string, [number, number]> = {
  ArrowRight: [5, 0],
  ArrowLeft: [-5, 0],
  ArrowDown: [0, 20],
  ArrowUp: [0, -20],
}

// A page's blocks in rows, or in columns of rows ("columns", each kept as its own page, laid out
// by "className"; on a narrow page they stack in their order). A block moves within or across
// the columns; dropped below a column's last block it goes to that column's foot.
export function Arranged({
  blocks,
  className,
  ...one
}: { blocks: Block[]; className?: string } & (
  | { page: string; start: string[][] }
  | { columns: { page: string; start: string[][] }[] }
)) {
  const [, redraw] = useState(0)
  const dragging = useRef<string | null>(null)
  // a block's key and side, or a column's number for its foot
  const [over, setOver] = useState<{ key: string | number; side: Side } | null>(null)
  const columns = 'columns' in one ? one.columns : [one]
  const byKey = new Map(blocks.map((b) => [b.key, b]))
  const saved = columns.map((c) => kept[c.page])
  const start = columns.map((c) => c.start)
  const here = blocks.map((b) => b.key)
  const cols = columnsOf(saved, start, here)
  const rows = stacked(cols)
  // what is kept holds the blocks not shown just now (a list with nothing in it) in their places
  const ever = columns.flatMap((c, i) => (saved[i] ?? c.start).flat().map(keyOf))
  const all = columnsOf(saved, start, [...new Set([...ever, ...here])])
  const keep = (next: string[][][]) => {
    columns.forEach((c, i) => {
      kept[c.page] = next[i] ?? []
    })
    redraw((n) => n + 1)
  }
  const sideOf = (e: DragEvent, el: HTMLElement): Side => {
    const r = el.getBoundingClientRect()
    const x = (e.clientX - r.left) / r.width
    if (x < 0.25) return 'left'
    if (x > 0.75) return 'right'
    return e.clientY - r.top < r.height / 2 ? 'top' : 'bottom'
  }
  // the arrows on a handle: up and down past the next row, in the order the columns stack (into
  // the next column at its top, the one before at its foot), left and right within its row
  const colOf = cols.flatMap((c, i) => c.map(() => i))
  const nudge = (key: string, k: string) => {
    const at = rows.findIndex((r) => r.some((e) => keyOf(e) === key))
    const row = (rows[at] as string[]).map(keyOf)
    const i = row.indexOf(key)
    const crosses = (n: number) => colOf[n] !== colOf[at]
    const to: [string | undefined, Side] | null =
      k === 'ArrowLeft'
        ? [row[i - 1], 'left']
        : k === 'ArrowRight'
          ? [row[i + 1], 'right']
          : k === 'ArrowUp'
            ? [keyOf(rows[at - 1]?.[0] ?? ''), crosses(at - 1) ? 'bottom' : 'top']
            : k === 'ArrowDown'
              ? [keyOf(rows[at + 1]?.[0] ?? ''), crosses(at + 1) ? 'top' : 'bottom']
              : null
    if (!to?.[0]) return
    keep(movedIn(all, key, to[0], to[1]))
  }
  const line = (side: Side) => (
    <span
      aria-hidden="true"
      className={cn(
        'pointer-events-none absolute z-1 rounded-full bg-accent',
        side === 'left' && '-left-2.5 inset-y-0 w-1',
        side === 'right' && '-right-2.5 inset-y-0 w-1',
        side === 'top' && '-top-2.5 inset-x-0 h-1',
        side === 'bottom' && '-bottom-2.5 inset-x-0 h-1',
      )}
    />
  )
  const column = (col: string[][], c: number) => (
    <div
      key={columns[c]?.page}
      className="relative flex min-w-0 flex-col gap-4"
      {...(columns.length > 1 && {
        onDragOver: (e: DragEvent) => {
          if (!dragging.current) return
          e.preventDefault()
          if (over?.key !== c) setOver({ key: c, side: col.length ? 'bottom' : 'top' })
        },
        onDragLeave: (e: DragEvent<HTMLElement>) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver(null)
        },
        onDrop: (e: DragEvent) => {
          e.preventDefault()
          const from = dragging.current
          dragging.current = null
          setOver(null)
          if (from) keep(movedIn(all, from, c))
        },
      })}
    >
      {!col.length && over?.key === c && line('top')}
      {col.map((row, r) => (
        <div
          key={row.map(keyOf).join('|')}
          className={cn(
            'flex flex-wrap items-start gap-4',
            r === col.length - 1 && over?.key === c && 'relative',
          )}
        >
          {r === col.length - 1 && over?.key === c && line('bottom')}
          {row.map((entry) => {
            const key = keyOf(entry)
            const { w: width, h: height } = sizeOf(entry)
            const b = byKey.get(key) as Block
            const side = over?.key === key ? over.side : null
            return (
              // biome-ignore lint/a11y/noStaticElementInteractions: a drop target; the handles are the controls
              <div
                key={key}
                data-block={key}
                className={cn(
                  'group/block relative min-w-0',
                  width ? 'shrink grow-0' : 'flex-1 basis-80',
                )}
                style={{
                  flexBasis: width ? `calc(${width}% - 1rem)` : undefined,
                  minWidth: width ? '16rem' : undefined,
                }}
                onDragOver={(e) => {
                  if (!dragging.current) return
                  e.stopPropagation()
                  if (dragging.current === key) return
                  e.preventDefault()
                  const s = sideOf(e, e.currentTarget)
                  if (over?.key !== key || over.side !== s) setOver({ key, side: s })
                }}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver(null)
                }}
                onDrop={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  const from = dragging.current
                  dragging.current = null
                  setOver(null)
                  if (from) keep(movedIn(all, from, key, sideOf(e, e.currentTarget)))
                }}
              >
                <button
                  type="button"
                  draggable
                  aria-label={`Move ${b.name}`}
                  data-tip={`Drag to move ${b.name}; arrows move it too`}
                  onDragStart={(e) => {
                    dragging.current = key
                    e.dataTransfer.effectAllowed = 'move'
                    e.dataTransfer.setData('text/plain', b.name)
                    const el = e.currentTarget.parentElement
                    if (el) e.dataTransfer.setDragImage(el, 16, 16)
                  }}
                  onDragEnd={() => {
                    dragging.current = null
                    setOver(null)
                  }}
                  onKeyDown={(e) => {
                    if (!e.key.startsWith('Arrow')) return
                    e.preventDefault()
                    nudge(key, e.key)
                  }}
                  className="absolute top-3 -left-4 z-1 grid h-6 w-4 cursor-grab place-items-center rounded-sm text-ink-3 opacity-0 hover:bg-hover hover:text-ink focus-visible:opacity-100 group-hover/block:opacity-100"
                >
                  <GripVertical className="size-3.5" />
                </button>
                <div
                  data-body
                  // sized smaller than it is, its body scrolls under its header, which stays in
                  // sight (Vikas, 30 Oct: the Agents and Governance heads "omnipresent")
                  className={
                    height
                      ? 'flex flex-col overflow-y-auto *:flex-1 [&_[data-head]]:sticky [&_[data-head]]:top-0 [&_[data-head]]:z-1 [&_[data-head]]:bg-surface'
                      : undefined
                  }
                  style={{ height: height ?? undefined }}
                >
                  {b.node}
                </div>
                {/* its size: drag the corner, arrows nudge it, a double-click gives it back */}
                {/* biome-ignore lint/a11y/useSemanticElements: a resize grip, held by the pointer or the arrows */}
                <div
                  role="separator"
                  tabIndex={0}
                  aria-label={`Resize ${b.name}`}
                  aria-valuenow={width ?? 0}
                  onPointerDown={(e) => {
                    e.preventDefault()
                    const el = e.currentTarget.parentElement
                    const body = el?.querySelector<HTMLElement>(':scope > [data-body]')
                    const rowEl = el?.parentElement
                    if (!el || !body || !rowEl) return
                    const r = el.getBoundingClientRect()
                    const whole = rowEl.getBoundingClientRect().width
                    const was = [el.style.cssText, body.style.cssText] as const
                    let last: Size | null = null
                    const move = (m: PointerEvent) => {
                      const w = ((m.clientX - r.left) / whole) * 100
                      const h = m.clientY - r.top
                      last = { w, h }
                      el.style.flex = `0 1 calc(${w}% - 1rem)`
                      body.style.height = `${Math.max(80, h)}px`
                      body.style.overflowY = 'auto'
                    }
                    const up = () => {
                      window.removeEventListener('pointermove', move)
                      window.removeEventListener('pointerup', up)
                      if (!last) return
                      el.style.cssText = was[0]
                      body.style.cssText = was[1]
                      keep(all.map((c) => sized(c, key, last)))
                    }
                    window.addEventListener('pointermove', move)
                    window.addEventListener('pointerup', up)
                  }}
                  onDoubleClick={() => keep(all.map((c) => sized(c, key, null)))}
                  onKeyDown={(e) => {
                    const d = NUDGE[e.key]
                    if (!d) return
                    e.preventDefault()
                    const el = e.currentTarget.parentElement
                    const r = el?.getBoundingClientRect()
                    const whole = el?.parentElement?.getBoundingClientRect().width ?? 1
                    const w = width ?? ((r?.width ?? 0) / whole) * 100
                    const h = height ?? r?.height ?? 0
                    keep(all.map((c) => sized(c, key, { w: w + d[0], h: h + d[1] })))
                  }}
                  className="absolute right-0 bottom-0 z-1 size-4 cursor-nwse-resize rounded-br-lg outline-none focus-visible:ring-2 focus-visible:ring-accent-line"
                />
                {side && line(side)}
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
  return columns.length > 1 ? (
    <div className={className}>{cols.map(column)}</div>
  ) : (
    column(cols[0] ?? [], 0)
  )
}
