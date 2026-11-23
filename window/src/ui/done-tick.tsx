// A done tick: drawn while something is done, and popping once only when it becomes done here
// (a step, a task, a connection), never for what was done already when the screen opened.
import { Check } from 'lucide-react'
import { useRef } from 'react'
import { cn } from './cn.ts'

export function DoneTick({ done, className }: { done: boolean; className?: string }) {
  const already = useRef(done)
  if (!done) return null
  return <Check className={cn(!already.current && 'pop', className)} />
}
