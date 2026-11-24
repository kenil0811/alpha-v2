// The card shell: a sunk head that names what it is (a gate, a question) and what it waits on,
// then its body. Cards sit in the stream; the shell is the same for every kind. In a list a card
// has a way to its own page, where it shows whole.
import { ArrowUpRight } from 'lucide-react'
import { createContext, type ReactNode, useContext } from 'react'
import { cn } from './cn.ts'
import { FRAME } from './frame.tsx'
import { Label } from './pill.tsx'

// Where a card shows: in a list, with the address of its own page; or on that page, whole. Bare:
// inside a card of its own (Home's Needs you), its body with ↗ to its own page at its top right
// (R9), and the page numbers under it.
export const CardPlace = createContext<{
  open: string | null
  whole: boolean
  bare?: boolean
  pager?: ReactNode
}>({ open: null, whole: false })

export function Card({
  label,
  waits,
  children,
}: {
  label: string
  waits?: string
  children: ReactNode
}) {
  const { open, bare, pager } = useContext(CardPlace)
  if (bare)
    return (
      <div className={cn('relative flex flex-col gap-3', open && 'pr-7')}>
        {open && <OwnPage href={open} className="absolute top-0 right-0" />}
        {children}
        {pager}
      </div>
    )
  return (
    <div className={`${FRAME} overflow-hidden shadow-pop`}>
      <div className="flex items-center gap-2 border-line border-b bg-sunk px-3.5 py-2">
        <Label className="text-ink-2">{label}</Label>
        {waits && (
          <span className="ml-auto flex items-center gap-1.5 font-medium text-sm text-warn">
            <span className="size-1.5 rounded-full bg-warn" />
            {waits}
          </span>
        )}
        {open && <OwnPage href={open} className={waits ? '' : 'ml-auto'} />}
      </div>
      <div className="flex flex-col gap-3 p-3.5">{children}</div>
    </div>
  )
}

// ↗ to a card's own page, where it shows whole.
function OwnPage({ href, className }: { href: string; className?: string }) {
  return (
    <a
      href={href}
      aria-label="Open on its own page"
      data-tip="Open on its own page"
      className={cn(
        'grid size-5 place-items-center rounded-sm text-ink-3 hover:bg-hover hover:text-ink',
        className,
      )}
    >
      <ArrowUpRight className="size-3.5" />
    </a>
  )
}

// A card's row of buttons at its right, the main act (written first) at the right edge: every
// card's buttons sit the same way.
export function Actions({ children }: { children: ReactNode }) {
  return <div className="flex flex-row-reverse flex-wrap items-center gap-2">{children}</div>
}
