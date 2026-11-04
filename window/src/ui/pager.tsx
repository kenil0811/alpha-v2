// A card's list five rows at a time, then the pager under it (Vikas, 2 Nov: cards grew long, their
// borders ran off the bottom): never Show more or a long scroll. The pager reads as a table's page
// row does: what shows, Previous and Next. The rows are already in the window; nothing more is asked
// of the core.
import { type ReactNode, useState } from 'react'

export const FIVE = 5

// "6–10 of 12", the page clamped to what is there now (an answered card can empty the last page).
export function pageOf(total: number, at: number, per = FIVE) {
  const pages = Math.max(1, Math.ceil(total / per))
  const page = Math.min(Math.max(0, at), pages - 1)
  const from = page * per
  const to = Math.min(total, from + per)
  return { page, pages, from, to, words: `${from + 1}–${to} of ${total}` }
}

export function usePaged<T>(items: T[], per = FIVE): { shown: T[]; pager: ReactNode } {
  const [at, setAt] = useState(0)
  const p = pageOf(items.length, at, per)
  return {
    shown: items.slice(p.from, p.to),
    pager: p.pages > 1 && (
      <nav
        aria-label="Pages"
        className="flex items-center justify-end gap-0.5 text-ink-3 text-sm tabular-nums"
      >
        <span className="mr-2">{p.words}</span>
        {(
          [
            ['Previous', p.page - 1, p.page === 0],
            ['Next', p.page + 1, p.page >= p.pages - 1],
          ] as const
        ).map(([label, to, off]) => (
          <button
            key={label}
            type="button"
            disabled={off}
            onClick={() => setAt(to)}
            className="rounded-md px-2 py-1 hover:bg-hover hover:text-ink disabled:opacity-50"
          >
            {label}
          </button>
        ))}
      </nav>
    ),
  }
}
