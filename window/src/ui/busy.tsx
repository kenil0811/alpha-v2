// What an agent or Alpha is doing, said in words with a soft light running across them, in place
// of a spinner: a spinner says only "busy", and reads as stalled.
import type { ReactNode } from 'react'
import { cn } from './cn.ts'

export function Busy({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span aria-busy="true" className={cn('shimmer', className)}>
      {children}
    </span>
  )
}
