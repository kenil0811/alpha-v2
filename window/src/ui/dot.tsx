// The signal dot: one bullet for what a place holds. Pulsing, it needs the person now; filled, it
// waits for their yes; hollow, it is there to read; green, it is running as it should. Its words
// show on hover.
import { cn } from './cn.ts'

export type Signal = 'now' | 'yes' | 'read' | 'running'

export const SIGNAL_WORDS: Record<Signal, string> = {
  now: 'Needs you now',
  yes: 'Waits for your yes',
  read: 'Something to read',
  running: 'Running as it should',
}

// The strongest of several: what one place shows for all it holds.
export const strongest = (all: Signal[]): Signal | null =>
  (['now', 'yes', 'read', 'running'] as const).find((s) => all.includes(s)) ?? null

export function Dot({ s, tip, className }: { s: Signal; tip?: string; className?: string }) {
  const words = tip ?? SIGNAL_WORDS[s]
  return (
    <span
      role="img"
      aria-label={words}
      data-tip={words}
      className={cn('relative inline-grid size-2.25 shrink-0', className)}
    >
      {s === 'now' && (
        <span className="absolute inset-0 animate-ping rounded-full bg-warn opacity-50 motion-reduce:animate-none" />
      )}
      <span
        className={cn(
          'relative rounded-full',
          s === 'now' && 'bg-warn',
          s === 'yes' && 'bg-accent',
          s === 'read' && 'border border-ink-3',
          s === 'running' && 'bg-good',
        )}
      />
    </span>
  )
}
