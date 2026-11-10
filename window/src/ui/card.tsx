// The card shell: a sunk head that names what it is (a gate, a question) and what it waits on,
// then its body. Cards sit in the stream; the shell is the same for every kind. In a list a card
// has a way to its own page, where it shows whole.
import { ArrowUpRight } from 'lucide-react'
import { createContext, type ReactNode, useContext } from 'react'
import { Label } from './pill.tsx'

// Where a card shows: in a list, with the address of its own page; or on that page, whole.
export const CardPlace = createContext<{ open: string | null; whole: boolean }>({
  open: null,
  whole: false,
})

export function Card({
  label,
  waits,
  children,
}: {
  label: string
  waits?: string
  children: ReactNode
}) {
  const { open } = useContext(CardPlace)
  return (
    <div className="overflow-hidden rounded-lg border border-line bg-surface shadow-pop">
      <div className="flex items-center gap-2 border-line border-b bg-sunk px-3.5 py-2">
        <Label className="text-ink-2">{label}</Label>
        {waits && (
          <span className="ml-auto flex items-center gap-1.5 font-medium text-sm text-warn">
            <span className="size-1.5 rounded-full bg-warn" />
            {waits}
          </span>
        )}
        {open && (
          <a
            href={open}
            aria-label="Open on its own page"
            data-tip="Open on its own page"
            className={`${waits ? '' : 'ml-auto '}grid size-5 place-items-center rounded-sm text-ink-3 hover:bg-hover hover:text-ink`}
          >
            <ArrowUpRight className="size-3.5" />
          </a>
        )}
      </div>
      <div className="flex flex-col gap-3 p-3.5">{children}</div>
    </div>
  )
}

// A card's row of buttons at its right, the main act (written first) at the right edge: every
// card's buttons sit the same way.
export function Actions({ children }: { children: ReactNode }) {
  return <div className="flex flex-row-reverse flex-wrap items-center gap-2">{children}</div>
}
