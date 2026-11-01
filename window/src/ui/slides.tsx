// A card's rows a page at a time (Vikas, 1 Nov: "so sections don't become long scroll"): as many
// as the card holds, then a dot per page with ‹ 2 of 10 › beside them; ← and → move when it has
// focus. One page shows no controls. Every card with more rows than it holds uses this, never a
// cut-off list or a scroll inside the card.
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { type ReactNode, useState } from 'react'
import { IconButton } from './button.tsx'
import { cn } from './cn.ts'

// past this many pages the dots would not fit a card; ‹ n of m › alone says where you are
const MOST_DOTS = 12

export function pagesOf(count: number, per: number) {
  return Math.max(1, Math.ceil(count / per))
}

export function Slides<T>({
  items,
  per = 5,
  label,
  children,
}: {
  items: T[]
  per?: number | undefined // rows a page; 1 is one large card at a time
  label: string // what the pages are of, for a screen reader: "Tasks"
  children: (shown: T[]) => ReactNode
}) {
  const pages = pagesOf(items.length, per)
  const [at, setAt] = useState(0)
  const page = Math.min(at, pages - 1) // an answered row can shorten the list under the person
  const go = (n: number) => setAt(Math.max(0, Math.min(pages - 1, n)))
  return (
    <div className="flex flex-col gap-2">
      {children(items.slice(page * per, page * per + per))}
      {pages > 1 && (
        // biome-ignore lint/a11y/useSemanticElements: a group of its own controls, moved by the arrows
        <div
          role="group"
          aria-label={`${label}, page ${page + 1} of ${pages}`}
          className="flex items-center justify-center gap-3 pt-1"
          onKeyDown={(e) => {
            if (e.key === 'ArrowLeft') go(page - 1)
            if (e.key === 'ArrowRight') go(page + 1)
          }}
        >
          {pages <= MOST_DOTS && (
            <div className="flex items-center gap-1.5">
              {Array.from({ length: pages }, (_, i) => (
                <button
                  key={i}
                  type="button"
                  aria-label={`Page ${i + 1}`}
                  aria-current={i === page ? 'page' : undefined}
                  onClick={() => go(i)}
                  className={cn(
                    'size-1.5 rounded-full transition-colors',
                    i === page ? 'bg-ink-2' : 'bg-line hover:bg-ink-3',
                  )}
                />
              ))}
            </div>
          )}
          <div className="flex items-center gap-0.5">
            <IconButton label="Previous" disabled={page === 0} onClick={() => go(page - 1)}>
              <ChevronLeft className="size-4" />
            </IconButton>
            <span className="min-w-12 text-center text-ink-3 text-sm tabular-nums">
              {page + 1} of {pages}
            </span>
            <IconButton label="Next" disabled={page === pages - 1} onClick={() => go(page + 1)}>
              <ChevronRight className="size-4" />
            </IconButton>
          </div>
        </div>
      )}
    </div>
  )
}
