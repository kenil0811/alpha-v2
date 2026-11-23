// A list: rows in one bordered box, each with what it is, a line under it, and its actions. A row
// that arrives after the list first drew fades and rises in once; the rows it opened with never move.
import { Children, createContext, type ReactNode, useContext, useEffect, useState } from 'react'
import { cn } from './cn.ts'
import { FRAME } from './frame.tsx'
import { Info } from './info.tsx'

const Drawn = createContext(false)

// Any list of things that arrive (rows, task lines, cards): drawn once it has shown some, so what
// loads into an empty list is not new; what comes after rises in (useArrived).
export function Arrivals({ children }: { children: ReactNode }) {
  const [drawn, setDrawn] = useState(false)
  const some = Children.toArray(children).length > 0
  useEffect(() => {
    if (some) setDrawn(true)
  }, [some])
  return <Drawn.Provider value={drawn}>{children}</Drawn.Provider>
}

// Whether this thing arrived after its list first drew, kept from its first render.
export function useArrived(): boolean {
  const [fresh] = useState(useContext(Drawn))
  return fresh
}

export function List({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn(FRAME, 'overflow-hidden', className)}>
      <Arrivals>{children}</Arrivals>
    </div>
  )
}

export function Row({
  title,
  about,
  sub,
  lead,
  actions,
  children,
  indent,
  wrap,
  className,
}: {
  title: ReactNode
  about?: string | undefined // what the row means, in an ⓘ beside its title
  sub?: ReactNode | undefined
  lead?: ReactNode | undefined // an icon tile or a time
  actions?: ReactNode | undefined
  children?: ReactNode | undefined // under the row: steps, a form
  indent?: boolean | undefined
  wrap?: boolean | undefined // a title that is a sentence: shown whole, never cut
  className?: string | undefined
}) {
  const name = cn('font-medium text-base text-ink', wrap ? 'break-words' : 'truncate')
  // new to a list already drawn: it rises in once
  const fresh = useArrived()
  return (
    <div
      className={cn(
        'group/row border-hair border-t first:border-t-0',
        fresh && 'rise-in',
        indent && 'bg-canvas',
        className,
      )}
    >
      <div className={cn('flex items-center gap-3 px-4 py-3', indent && 'pl-14')}>
        {lead}
        <div className="min-w-0 flex-1">
          {about ? (
            <div className="flex items-center gap-1.5">
              <div className={cn('min-w-0', name)}>{title}</div>
              <Info help={about} />
            </div>
          ) : (
            <div className={name}>{title}</div>
          )}
          {sub && <div className="text-ink-3 text-sm">{sub}</div>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
      {children}
    </div>
  )
}

// A square tile for a row's icon.
export function Tile({ children }: { children: ReactNode }) {
  return (
    <div className="grid size-8 shrink-0 place-items-center rounded-md bg-sunk text-ink-2">
      {children}
    </div>
  )
}
