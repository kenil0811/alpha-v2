// The one card: every box that holds something on a page is this frame, and a pop-up is the same
// card lifted. Rows edge to edge are a List (ui/list.tsx), the same frame unpadded.
import type { ReactNode } from 'react'
import { cn } from './cn.ts'

export const FRAME = 'rounded-lg border border-line bg-surface'

export function Frame({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn(FRAME, 'p-4', className)}>{children}</div>
}
