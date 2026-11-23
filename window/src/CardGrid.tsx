// Cards on a grid of 48 columns, each the whole row, a half, a third or a quarter, or a square of an
// eighth or a sixteenth that shows only an icon and a number. A card is dragged by its right edge
// (or moved with ← →) to the nearest width, kept per person by the core (Vikas, 22 Nov). On a narrow
// page a card takes the row and a square a quarter of it.
// Until the person sets one, a card is as wide as its main words need to sit in two lines, or three
// when nothing sits under them (Vikas, 23 Nov): the narrowest of a quarter, a third, a half or the
// row that holds them; words longer than the row's three lines take the row.
import type { CardWidth } from '@alpha/core/api'
import { type CSSProperties, type ReactNode, useLayoutEffect, useRef, useState } from 'react'
import { useLayout } from './layout.ts'
import { cn } from './ui/cn.ts'
import { FRAME, Frame } from './ui/frame.tsx'

const WIDTHS: CardWidth[] = ['1/16', '1/8', '1/4', '1/3', '1/2', '1'] // narrowest first
const span = (w: CardWidth) => 48 / Number(w.split('/')[1] ?? 1)

// The width nearest a share of the row (0 to 1).
export const nearestWidth = (share: number): CardWidth =>
  WIDTHS.reduce((best, w) =>
    Math.abs(span(w) / 48 - share) < Math.abs(span(best) / 48 - share) ? w : best,
  )

// px around a card's words: the cell's gutter (px-3) and the frame's padding (p-4), both sides
const AROUND = 56

// The narrowest width whose lines hold `words` (px wide on one line), in a row `row` px wide.
export const fitWidth = (words: number, lines: number, row: number): CardWidth =>
  (['1/4', '1/3', '1/2'] as CardWidth[]).find(
    // ponytail: words wrap whole, so a line holds about 90% of its width; measure the DOM if it misleads
    (w) => words <= lines * 0.9 * ((row * span(w)) / 48 - AROUND),
  ) ?? '1'

let pen: CanvasRenderingContext2D | null | undefined
// The width of words on one line as a card's main words are drawn: medium, at the text-lg size.
const measure = (words: string, el: Element) => {
  pen ??= document.createElement('canvas').getContext('2d')
  if (!pen) return 0
  const css = getComputedStyle(el)
  pen.font = `500 ${css.getPropertyValue('--fs-lg') || '16px'} ${css.fontFamily}`
  return pen.measureText(words).width
}

export interface GridCard {
  key: string // what the core keeps its width under
  width: CardWidth // its own when it has no main words, until the person drags it
  main?: { words: string; under: boolean } | undefined // its main words, and whether anything sits under them
  node: ReactNode
  small: { icon: ReactNode; value: string; label: string } // what it shows as a square
}

export function CardGrid({ cards }: { cards: GridCard[] }) {
  const { layout, change } = useLayout()
  const grid = useRef<HTMLDivElement>(null)
  const [drag, setDrag] = useState<{ key: string; width: CardWidth; left: number } | null>(null)
  const [row, setRow] = useState(0)
  useLayoutEffect(() => {
    const el = grid.current
    if (!el) return
    const seen = new ResizeObserver(() => setRow(el.clientWidth))
    seen.observe(el)
    return () => seen.disconnect()
  }, [])
  const own = (c: GridCard): CardWidth =>
    c.main && row && grid.current
      ? fitWidth(measure(c.main.words, grid.current), c.main.under ? 2 : 3, row)
      : c.width
  return (
    // the space between cards is inside each cell: 47 gaps of their own would outgrow the row
    <div ref={grid} className="-mx-3 grid grid-cols-4 gap-y-6 @3xl:grid-cols-48">
      {cards.map((c) => {
        const w = drag?.key === c.key ? drag.width : (layout.cardWidth[c.key] ?? own(c))
        const square = w === '1/8' || w === '1/16'
        const keep = (to: CardWidth) => change({ cardWidth: { [c.key]: to } })
        const at = (x: number, left: number) =>
          nearestWidth((x - left) / (grid.current?.getBoundingClientRect().width || 1))
        return (
          <div
            key={c.key}
            style={{ '--span': span(w) } as CSSProperties}
            className={cn(
              'group/card relative min-w-0 px-3 @3xl:[grid-column:span_var(--span)/span_var(--span)]',
              square ? 'col-span-1' : 'col-span-4',
            )}
          >
            {square ? (
              <button
                type="button"
                aria-label={`${c.small.label}: ${c.small.value}`}
                data-tip={`${c.small.label}: open at its own size`}
                onClick={() => keep(own(c))}
                className={cn(
                  FRAME,
                  'flex aspect-square w-full flex-col items-center justify-center gap-1 overflow-hidden p-1 text-ink-2 hover:bg-hover',
                )}
              >
                {c.small.icon}
                <span className="font-semibold text-ink text-lg tabular-nums leading-none">
                  {c.small.value}
                </span>
                {w === '1/8' && (
                  <span className="max-w-full truncate text-ink-3 text-xs">{c.small.label}</span>
                )}
              </button>
            ) : (
              <Frame className="h-full">{c.node}</Frame>
            )}
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
