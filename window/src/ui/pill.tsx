// Pills say a state; green, amber and red only ever mean done or fits, waits on you or unsure,
// and didn't finish. A topic chip names a module and, as a button, filters to it.
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from './cn.ts'

export type Tone = 'neutral' | 'good' | 'warn' | 'bad' | 'accent' | 'faint'

const TONES: Record<Tone, string> = {
  neutral: 'bg-sunk text-ink-2',
  good: 'bg-good-soft text-good',
  warn: 'bg-warn-soft text-warn',
  bad: 'bg-bad-soft text-bad',
  accent: 'bg-accent-soft text-accent',
  faint: 'border border-line text-ink-3',
}

export function Pill({
  tone = 'neutral',
  children,
  className,
}: {
  tone?: Tone
  children: ReactNode
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex h-6 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2 font-medium text-sm',
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}

export function Topic({ className, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={cn(
        'inline-flex h-6 items-center rounded-sm border border-line bg-surface px-1.75 font-medium text-ink-2 text-xs transition-colors hover:border-accent-line hover:text-accent',
        className,
      )}
      {...props}
    />
  )
}

// A small label, in sentence case like everything else.
export function Label({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn('font-semibold text-ink-3 text-xs', className)}>{children}</span>
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="rounded-xs border border-line px-1 font-mono text-ink-3 text-xs">
      {children}
    </kbd>
  )
}
