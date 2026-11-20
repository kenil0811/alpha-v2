// A table's foot, under its rows in every view: New at the left and, while the list on screen
// differs from what was saved, Save ▾ (Save; Save as new list) and Cancel beside it, as they act
// together; the rows to a page and the pages at the right corner. A list Alpha keeps itself saves
// nothing: Cancel alone.
import type { SavedView } from '@alpha/core/api'
import { ChevronDown, ChevronLeft, ChevronRight, CopyPlus } from 'lucide-react'
import { type ReactNode, useRef, useState } from 'react'
import { Button } from '../ui/button.tsx'
import { cn } from '../ui/cn.ts'
import { MenuItem, Popover } from '../ui/popover.tsx'
import { NewButton } from './NewButton.tsx'
import { NameForm } from './ViewTabs.tsx'

export function FootBar({
  onNew,
  dirty,
  keeps,
  view,
  onReset,
  onSave,
  onSaveAs,
  children,
}: {
  onNew: (() => void) | string | null // null: no New here (the form adds by itself)
  dirty: boolean
  keeps: boolean // false on a list Alpha keeps itself: it holds no saved lists
  view: SavedView | undefined // the saved list on screen; none, All
  onReset: () => void
  onSave: () => void
  onSaveAs: (name: string) => void
  children?: ReactNode // what else sits at the right: who reads into it, the pages
}) {
  const [saving, setSaving] = useState(false) // Save ▾
  const [naming, setNaming] = useState(false)
  const saveAt = useRef<HTMLSpanElement>(null)
  return (
    <div className="flex min-h-11 shrink-0 items-center gap-2 border-hair border-t px-3 text-ink-3 text-sm">
      {onNew !== null && <NewButton onNew={onNew} />}
      {dirty && (
        <>
          {keeps && (
            <span ref={saveAt} className="flex shrink-0">
              {view ? (
                <>
                  <Button
                    size="sm"
                    variant="primary"
                    className="rounded-r-none"
                    onClick={onSave}
                    data-tip="Everyone sees the change"
                  >
                    Save
                  </Button>
                  <Button
                    size="sm"
                    variant="primary"
                    className="rounded-l-none border-l-accent-ink/30 px-1.25"
                    aria-haspopup="menu"
                    aria-expanded={saving}
                    aria-label="More ways to save"
                    data-tip="More ways to save"
                    onClick={() => setSaving((o) => !o)}
                  >
                    <ChevronDown className="size-3.5" />
                  </Button>
                </>
              ) : (
                <Button size="sm" variant="primary" onClick={() => setNaming(true)}>
                  Save as list
                </Button>
              )}
            </span>
          )}
          <Button size="sm" variant="ghost" onClick={onReset} data-tip="Go back to what was saved">
            Cancel
          </Button>
        </>
      )}
      <span className="ml-auto flex items-center gap-2">{children}</span>
      <Popover anchor={saveAt} open={saving} onClose={() => setSaving(false)}>
        <MenuItem
          onClick={() => {
            setSaving(false)
            setNaming(true)
          }}
        >
          <CopyPlus className="size-3.5 text-ink-3" />
          Save as new list
        </MenuItem>
      </Popover>
      <Popover anchor={saveAt} open={naming} onClose={() => setNaming(false)}>
        <NameForm
          start=""
          label="Save"
          onSave={(name) => {
            setNaming(false)
            onSaveAs(name)
          }}
        />
      </Popover>
    </div>
  )
}

// The pages as numbers, ‹ 1 2 … 21 ›: the first, the last, and the ones either side of this one.
export function Pages({
  at,
  pages,
  onPage,
}: {
  at: number // from 0
  pages: number
  onPage: (n: number) => void
}) {
  const shown = pageNumbers(at, pages)
  const step = 'grid h-6 min-w-6 place-items-center rounded-md px-1.5 tabular-nums'
  return (
    <nav aria-label="Pages" className="flex items-center gap-0.5">
      <button
        type="button"
        aria-label="Previous page"
        disabled={at === 0}
        onClick={() => onPage(at - 1)}
        className={cn(step, 'hover:bg-hover hover:text-ink disabled:opacity-40')}
      >
        <ChevronLeft className="size-3.5" />
      </button>
      {shown.map((n, i) =>
        n === null ? (
          <span key={`gap${i}`} className={step}>
            …
          </span>
        ) : (
          <button
            key={n}
            type="button"
            aria-current={n === at ? 'page' : undefined}
            onClick={() => onPage(n)}
            className={cn(
              step,
              n === at ? 'bg-accent-soft font-medium text-ink' : 'hover:bg-hover hover:text-ink',
            )}
          >
            {n + 1}
          </button>
        ),
      )}
      <button
        type="button"
        aria-label="Next page"
        disabled={at >= pages - 1}
        onClick={() => onPage(at + 1)}
        className={cn(step, 'hover:bg-hover hover:text-ink disabled:opacity-40')}
      >
        <ChevronRight className="size-3.5" />
      </button>
    </nav>
  )
}

// Which page numbers show, from 0, with null for a gap: 0 1 … 20, or 0 … 7 8 9 … 20.
export function pageNumbers(at: number, pages: number): (number | null)[] {
  const keep = new Set([0, pages - 1, at - 1, at, at + 1].filter((n) => n >= 0 && n < pages))
  if (at <= 1) keep.add(2)
  if (at >= pages - 2) keep.add(pages - 3)
  const sorted = [...keep].filter((n) => n >= 0 && n < pages).sort((a, b) => a - b)
  const out: (number | null)[] = []
  for (const n of sorted) {
    const last = out[out.length - 1]
    if (typeof last === 'number' && n - last === 2) out.push(n - 1)
    else if (typeof last === 'number' && n - last > 2) out.push(null)
    out.push(n)
  }
  return out
}
