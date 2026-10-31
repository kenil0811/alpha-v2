// Blocks the person arranges (Vikas, 29 Oct: "allow user to drag and drop a block to reorganize…
// two blocks next to each other, or one above or below the other"): a page's blocks in rows, each
// row its blocks side by side. A block's handle shows on hover; dropped on the left or right edge
// of another block it goes beside it, on its top or bottom half above or below it. The arrows on
// the handle do the same from the keyboard. Kept per person by the core (design §14), never in
// the browser, once the core keeps it: until then it lasts while the window is open (below); a
// block that is new to the page goes at the foot. Every card is a block (Vikas,
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

// The rows a page shows: the person's, with what is gone left out and what is new at the foot.
export function rowsOf(saved: string[][] | undefined, start: string[][], keys: string[]) {
  const here = new Set(keys)
  const rows = (saved ?? start)
    .map((r) => r.filter((k) => here.has(keyOf(k))))
    .filter((r) => r.length)
  const placed = new Set(rows.flat().map(keyOf))
  for (const k of keys) if (!placed.has(k)) rows.push([k])
  return rows
}

// One block moved beside, above or below another.
export function moved(rows: string[][], key: string, to: string, side: Side): string[][] {
  if (key === to) return rows
  const entry = rows.flat().find((k) => keyOf(k) === key) ?? key
  const out = rows.map((r) => r.filter((k) => keyOf(k) !== key)).filter((r) => r.length)
  const at = out.findIndex((r) => r.some((k) => keyOf(k) === to))
  if (at < 0) return rows
  const row = out[at] as string[]
  if (side === 'left' || side === 'right')
    row.splice(row.findIndex((k) => keyOf(k) === to) + (side === 'right' ? 1 : 0), 0, entry)
  else out.splice(at + (side === 'bottom' ? 1 : 0), 0, [entry])
  return out
}

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

// the arrows on a focused corner: width in fives of a per cent, height in 20px
const NUDGE: Record<string, [number, number]> = {
  ArrowRight: [5, 0],
  ArrowLeft: [-5, 0],
  ArrowDown: [0, 20],
  ArrowUp: [0, -20],
}

// ponytail: the arrangements live while the window is open; the core's Layout keeps them per
// person once it has an arrange field (design §14), and this map goes.
const kept = new Map<string, string[][]>()

export function Arranged({
  page,
  blocks,
  start,
}: {
  page: string
  blocks: Block[]
  start: string[][]
}) {
  const [, redraw] = useState(0)
  const dragging = useRef<string | null>(null)
  const [over, setOver] = useState<{ key: string; side: Side } | null>(null)
  const byKey = new Map(blocks.map((b) => [b.key, b]))
  const saved = kept.get(page)
  const here = blocks.map((b) => b.key)
  const rows = rowsOf(saved, start, here)
  // what is kept holds the blocks not shown just now (a list with nothing in it) in their places
  const all = rowsOf(saved, start, [...new Set([...(saved ?? start).flat().map(keyOf), ...here])])
  const keep = (next: string[][]) => {
    kept.set(page, next)
    redraw((n) => n + 1)
  }
  const sideOf = (e: DragEvent, el: HTMLElement): Side => {
    const r = el.getBoundingClientRect()
    const x = (e.clientX - r.left) / r.width
    if (x < 0.25) return 'left'
    if (x > 0.75) return 'right'
    return e.clientY - r.top < r.height / 2 ? 'top' : 'bottom'
  }
  // the arrows on a handle: up and down past the next row, left and right within its row
  const nudge = (key: string, k: string) => {
    const at = rows.findIndex((r) => r.some((e) => keyOf(e) === key))
    const row = (rows[at] as string[]).map(keyOf)
    const i = row.indexOf(key)
    const to: [string | undefined, Side] | null =
      k === 'ArrowLeft'
        ? [row[i - 1], 'left']
        : k === 'ArrowRight'
          ? [row[i + 1], 'right']
          : k === 'ArrowUp'
            ? [keyOf(rows[at - 1]?.[0] ?? ''), 'top']
            : k === 'ArrowDown'
              ? [keyOf(rows[at + 1]?.[0] ?? ''), 'bottom']
              : null
    if (!to?.[0]) return
    keep(moved(all, key, to[0], to[1]))
  }
  return (
    <div className="flex flex-col gap-4">
      {rows.map((row) => (
        <div key={row.map(keyOf).join('|')} className="flex flex-wrap items-start gap-4">
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
                  if (!dragging.current || dragging.current === key) return
                  e.preventDefault()
                  const s = sideOf(e, e.currentTarget)
                  if (over?.key !== key || over.side !== s) setOver({ key, side: s })
                }}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver(null)
                }}
                onDrop={(e) => {
                  e.preventDefault()
                  const from = dragging.current
                  dragging.current = null
                  setOver(null)
                  if (from) keep(moved(all, from, key, sideOf(e, e.currentTarget)))
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
                  className={height ? 'flex flex-col overflow-y-auto *:flex-1' : undefined}
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
                      keep(sized(all, key, last))
                    }
                    window.addEventListener('pointermove', move)
                    window.addEventListener('pointerup', up)
                  }}
                  onDoubleClick={() => keep(sized(all, key, null))}
                  onKeyDown={(e) => {
                    const d = NUDGE[e.key]
                    if (!d) return
                    e.preventDefault()
                    const el = e.currentTarget.parentElement
                    const r = el?.getBoundingClientRect()
                    const whole = el?.parentElement?.getBoundingClientRect().width ?? 1
                    const w = width ?? ((r?.width ?? 0) / whole) * 100
                    const h = height ?? r?.height ?? 0
                    keep(sized(all, key, { w: w + d[0], h: h + d[1] }))
                  }}
                  className="absolute right-0 bottom-0 z-1 size-4 cursor-nwse-resize rounded-br-lg outline-none focus-visible:ring-2 focus-visible:ring-accent-line"
                />
                {side && (
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
                )}
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}
