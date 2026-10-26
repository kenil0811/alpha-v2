// An ⓘ beside a label: its help shows on hover and on keyboard focus, never as a line of text on
// the page. Screens explain themselves through this, not through sentences under headings.
import { Info as InfoIcon } from 'lucide-react'
import { useId, useRef, useState } from 'react'
import { Popover } from './popover.tsx'

export function Info({ help }: { help: string }) {
  const [open, setOpen] = useState(false)
  const anchor = useRef<HTMLButtonElement>(null)
  const id = useId()
  return (
    <>
      <button
        ref={anchor}
        type="button"
        aria-label="More about this"
        aria-describedby={open ? id : undefined}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        className="inline-grid size-4 shrink-0 place-items-center self-center rounded-full text-ink-3 hover:text-ink"
      >
        <InfoIcon className="size-3.5" />
      </button>
      <Popover anchor={anchor} open={open} onClose={() => setOpen(false)} className="max-w-72">
        <div id={id} role="tooltip" className="px-2 py-1.5 text-ink-2 text-sm">
          {help}
        </div>
      </Popover>
    </>
  )
}
