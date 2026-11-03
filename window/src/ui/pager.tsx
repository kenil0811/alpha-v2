// The one way through pages (Vikas, 30 Oct: "next to the buttons I need page numbers and arrows"):
// ‹ and ›, and between them each page's number while there are few, else "3 of 12". A table's
// pages and a slideshow of cards both go by it. `at` counts from 0; one page shows nothing. Where
// two pagers could meet it says what it counts (Vikas, 1 Nov: "why was there 1 of 4 twice?").
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { IconButton } from './button.tsx'
import { cn } from './cn.ts'

const FEW = 7

// The words between the arrows with a noun: "Approval 2 of 4", or, given the items and how many a
// page, the ones shown: "Agents 4–6 of 16".
export function pagerWords(at: number, count: number, noun: string, items?: Paged): string {
  if (!items) return `${noun} ${at + 1} of ${count}`
  const first = at * items.per + 1
  const last = Math.min(items.total, first + items.per - 1)
  return `${noun} ${first === last ? first : `${first}–${last}`} of ${items.total}`
}
export interface Paged {
  per: number
  total: number
}

export function Pager({
  at,
  count,
  onAt,
  noun,
  items,
  className,
}: {
  at: number
  count: number
  onAt: (i: number) => void
  noun?: string | undefined // what it counts, said in place of the numbers: "Approval"
  items?: Paged | undefined // with a noun, count the items, not the pages: "Agents 1–3 of 16"
  className?: string
}) {
  if (count < 2) return null
  return (
    <nav
      aria-label="Pages"
      className={cn('flex items-center gap-0.5 text-ink-3 text-sm tabular-nums', className)}
    >
      <IconButton label="Previous" disabled={at <= 0} onClick={() => onAt(at - 1)}>
        <ChevronLeft className="size-3.5" />
      </IconButton>
      {noun ? (
        <span className="whitespace-nowrap px-1.5">{pagerWords(at, count, noun, items)}</span>
      ) : count <= FEW ? (
        Array.from({ length: count }, (_, i) => (
          <button
            key={i}
            type="button"
            aria-current={i === at ? 'page' : undefined}
            onClick={() => onAt(i)}
            className={cn(
              'h-7 min-w-7 rounded-sm px-1.5 hover:bg-hover hover:text-ink',
              i === at && 'bg-accent-soft font-medium text-accent',
            )}
          >
            {i + 1}
          </button>
        ))
      ) : (
        <span className="px-1.5">
          {at + 1} of {count}
        </span>
      )}
      <IconButton label="Next" disabled={at >= count - 1} onClick={() => onAt(at + 1)}>
        <ChevronRight className="size-3.5" />
      </IconButton>
    </nav>
  )
}
