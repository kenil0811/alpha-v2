// Cards on a grid of 48 columns, each the whole row, a half, a third or a quarter, aligned at their
// tops, each as tall as what it holds. A card is dragged by its right edge (or moved with ← →) to
// the nearest width, kept per person by the core; a width is only ever the person's pick or the
// card's own, never fitted to its words. On a narrow page a card takes the row. No card is ever a
// count on its own (O1).
import type { CardWidth } from '@alpha/core/api'
import { type CSSProperties, type ReactNode, useRef, useState } from 'react'
import { useLayout } from './layout.ts'
import { Frame } from './ui/frame.tsx'

const WIDTHS: CardWidth[] = ['1/4', '1/3', '1/2', '1'] // narrowest first
const span = (w: CardWidth) => 48 / Number(w.split('/')[1] ?? 1)

// The width nearest a share of the row (0 to 1).
export const nearestWidth = (share: number): CardWidth =>
  WIDTHS.reduce((best, w) =>
    Math.abs(span(w) / 48 - share) < Math.abs(span(best) / 48 - share) ? w : best,
  )

export interface GridCard {
  key: string // what the core keeps its width under
  width: CardWidth // its own, until the person drags it
  node: ReactNode
}

export function CardGrid({ cards }: { cards: GridCard[] }) {
  const { layout, change } = useLayout()
  const grid = useRef<HTMLDivElement>(null)
  const [drag, setDrag] = useState<{ key: string; width: CardWidth; left: number } | null>(null)
  return (
    // the space between cards is inside each cell: 47 gaps of their own would outgrow the row
    <div ref={grid} className="-mx-3 grid grid-cols-4 items-start gap-y-6 @3xl:grid-cols-48">
      {cards.map((c) => {
        const kept = layout.cardWidth[c.key]
        // a width kept from before squares went is the narrowest a card now takes
        const own = kept && WIDTHS.includes(kept) ? kept : kept ? '1/4' : c.width
        const w = drag?.key === c.key ? drag.width : own
        const keep = (to: CardWidth) => change({ cardWidth: { [c.key]: to } })
        const at = (x: number, left: number) =>
          nearestWidth((x - left) / (grid.current?.getBoundingClientRect().width || 1))
        return (
          <div
            key={c.key}
            style={{ '--span': span(w) } as CSSProperties}
            className="group/card relative col-span-4 min-w-0 px-3 @3xl:[grid-column:span_var(--span)/span_var(--span)]"
          >
            <Frame>{c.node}</Frame>
            <button
              type="button"
              aria-label="Width (← →)"
              data-tip="Drag to resize"
              className="absolute inset-y-0 right-0 hidden w-2 cursor-col-resize rounded-full outline-none focus-visible:bg-accent-line group-hover/card:bg-line-strong @3xl:block"
              onKeyDown={(e) => {
                const by = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
                const to = WIDTHS[WIDTHS.indexOf(w) + by]
                if (!by || !to) return
                e.preventDefault()
                keep(to)
              }}
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId)
                const left = e.currentTarget.parentElement?.getBoundingClientRect().left ?? 0
                setDrag({ key: c.key, width: at(e.clientX, left), left })
              }}
              onPointerMove={(e) => {
                if (drag?.key === c.key) setDrag({ ...drag, width: at(e.clientX, drag.left) })
              }}
              onPointerUp={(e) => {
                if (drag?.key !== c.key) return
                keep(at(e.clientX, drag.left))
                setDrag(null)
              }}
            />
          </div>
        )
      })}
    </div>
  )
}
