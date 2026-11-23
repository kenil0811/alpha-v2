// A label on a tab, a toggle, a tag or a button is as wide as its words, 15 characters at most
// (Vikas, 23 Nov; 10.5ch is about 15 letters of the sans): longer words fade out at the edge and
// slide along under the pointer or focus, so a long name never takes a row's room and a cut one
// still reads as cut. The control it sits in carries `group/fit`.
import { type ReactNode, useLayoutEffect, useRef, useState } from 'react'
import { cn } from './cn.ts'

export function Fit({ children }: { children: ReactNode }) {
  const box = useRef<HTMLSpanElement>(null)
  const [cut, setCut] = useState(false)
  useLayoutEffect(() => {
    const b = box.current
    setCut(!!b && b.scrollWidth > b.clientWidth + 1)
  })
  return (
    <span
      ref={box}
      className={cn(
        'inline-block min-w-0 max-w-[10.5ch] overflow-hidden whitespace-nowrap align-bottom',
        cut &&
          '[mask-image:linear-gradient(to_right,black_70%,transparent)] group-hover/fit:[mask-image:none] group-focus-visible/fit:[mask-image:none]',
      )}
    >
      <span className="inline-block transition-transform duration-[2s] ease-linear group-hover/fit:translate-x-[min(0px,calc(10.5ch_-_100%))] group-focus-visible/fit:translate-x-[min(0px,calc(10.5ch_-_100%))]">
        {children}
      </span>
    </span>
  )
}

// Words among a control's children are fitted; icons and counts stay as they are.
export const fitWords = (children: ReactNode): ReactNode =>
  typeof children === 'string' ? (
    <Fit>{children}</Fit>
  ) : Array.isArray(children) ? (
    children.map((c) => (typeof c === 'string' && c.trim() ? <Fit key={c}>{c}</Fit> : c))
  ) : (
    children
  )
