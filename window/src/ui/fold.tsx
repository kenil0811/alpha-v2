// A long reply folded to its first lines with More (item 63 of the problems list, 25 Oct): the
// conversation stays short, and More opens a reply whole, for good. How many lines is the core's
// (core/config/limits.yaml reply_fold_lines), read once at start. A table is never cut through: a
// reply folds above its first table, so its opening words show and More opens the table; one that
// starts with a table shows whole.
import { type ReactNode, useLayoutEffect, useRef, useState } from 'react'
import { Button } from './button.tsx'

let lines = 4
export function setFoldLines(n: number): void {
  if (Number.isInteger(n) && n > 0) lines = n
}
const opened = new Set<string>() // the replies opened with More, kept while the window is open

export function Fold({
  id,
  whole,
  children,
}: {
  id: string
  whole?: boolean
  children: ReactNode
}) {
  const box = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(() => opened.has(id))
  const [cut, setCut] = useState<number | null>(null) // the folded height, when the reply is long
  useLayoutEffect(() => {
    const el = box.current
    if (!el || open || whole) return setCut(null)
    const lh = Number.parseFloat(getComputedStyle(el).lineHeight) || 24
    const table = el.querySelector('table')
    const top = table
      ? table.getBoundingClientRect().top - el.getBoundingClientRect().top
      : Number.POSITIVE_INFINITY
    // a reply that opens with its table is the table: shown whole
    if (top < lh) return setCut(null)
    const height = Math.min(lines * lh, top - 4)
    // a line or so over is shown whole: folding it would hide almost nothing
    setCut(el.scrollHeight > height + lh ? height : null)
  })
  return (
    <div className="flex flex-col gap-1.5">
      <div
        ref={box}
        className={cut !== null ? 'overflow-hidden' : undefined}
        style={cut !== null ? { maxHeight: cut } : undefined}
      >
        {children}
      </div>
      {cut !== null && (
        <Button
          size="sm"
          variant="ghost"
          className="self-start"
          onClick={() => {
            opened.add(id)
            setOpen(true)
          }}
        >
          More
        </Button>
      )}
    </div>
  )
}
