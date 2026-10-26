// ⋮: what else a row can do, Delete among it, so nothing that destroys sits on the screen as one
// click. It shows on the row's hover or the keyboard's focus (the row is a group/row); `shown`
// keeps it in sight where there is no row, like a record's title.
import { EllipsisVertical } from 'lucide-react'
import { type ReactNode, useRef, useState } from 'react'
import { cn } from './cn.ts'
import { Popover } from './popover.tsx'

export function More({
  label,
  shown,
  disabled,
  children,
}: {
  label: string
  shown?: boolean
  disabled?: boolean
  children: (close: () => void) => ReactNode // the menu's lines; each closes it first
}) {
  const anchor = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  const close = () => setOpen(false)
  return (
    <>
      <button
        ref={anchor}
        type="button"
        aria-label={label}
        title={label}
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'grid size-7 shrink-0 place-items-center rounded-sm text-ink-3 hover:bg-hover hover:text-ink focus-visible:opacity-100 disabled:opacity-50',
          !shown && !open && 'opacity-0 group-hover/row:opacity-100',
        )}
      >
        <EllipsisVertical className="size-4" />
      </button>
      <Popover anchor={anchor} open={open} onClose={close} align="end">
        {children(close)}
      </Popover>
    </>
  )
}
