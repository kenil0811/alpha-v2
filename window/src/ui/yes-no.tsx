// A yes or a no as ✓ and ✕, the word sliding out on hover or focus: a card's Approve and Decline,
// an edit's Save and Cancel (Vikas, 23 Nov). The yes wears the accent.
import { Check, X } from 'lucide-react'
import type { MouseEvent } from 'react'
import { cn } from './cn.ts'

export function YesNo({
  yes,
  words,
  busy,
  onClick,
}: {
  yes: boolean
  words: string
  busy?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-label={words}
      disabled={busy}
      // the edit it ends keeps its focus until the click lands
      onMouseDown={(e: MouseEvent) => e.preventDefault()}
      onClick={onClick}
      className={cn(
        'group/act inline-flex h-7 shrink-0 items-center rounded-full px-1.5 font-medium text-sm disabled:opacity-40',
        yes
          ? 'bg-accent text-accent-ink'
          : 'border border-line bg-surface text-ink-2 hover:text-ink',
      )}
    >
      {yes ? <Check className="size-4" /> : <X className="size-4" />}
      <span className="max-w-0 overflow-hidden whitespace-nowrap transition-[max-width,margin] duration-150 group-hover/act:ml-1 group-hover/act:max-w-40 group-focus-visible/act:ml-1 group-focus-visible/act:max-w-40">
        {words}
      </span>
    </button>
  )
}
