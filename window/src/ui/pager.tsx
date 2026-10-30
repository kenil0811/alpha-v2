// The one way through pages (Vikas, 30 Oct: "next to the buttons I need page numbers and arrows"):
// ‹ and ›, and between them each page's number while there are few, else "3 of 12". A table's
// pages and a slideshow of cards both go by it. `at` counts from 0; one page shows nothing.
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { IconButton } from './button.tsx'
import { cn } from './cn.ts'

const FEW = 7

export function Pager({
  at,
  count,
  onAt,
  className,
}: {
  at: number
  count: number
  onAt: (i: number) => void
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
      {count <= FEW ? (
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
