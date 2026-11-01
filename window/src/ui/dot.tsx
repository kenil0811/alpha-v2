// The one signal, used as a bullet everywhere (proposal S1, 27 Oct): pulsing, it needs the person
// now; filled, it waits for their yes; hollow, it is optional; green, it runs as it should. It
// says so on hover. No other colour stands for a state.
import { cn } from './cn.ts'

export type Signal = 'now' | 'yes' | 'opt' | 'done'

export const SIGNAL_WORDS: Record<Signal, string> = {
  now: 'Needs you now',
  yes: 'Needs approval',
  opt: 'Optional, for your information',
  done: 'Running as it should',
}

// The strongest of several: what a rail line or a tile shows for all it holds.
export const strongest = (all: Signal[]): Signal | null =>
  (['now', 'yes', 'opt', 'done'] as const).find((s) => all.includes(s)) ?? null

export function Dot({ s, tip, className }: { s: Signal; tip?: string; className?: string }) {
  const words = tip ?? SIGNAL_WORDS[s]
  return (
    <span
      role="img"
      aria-label={words}
      data-tip={words}
      className={cn('relative inline-grid size-2.25 shrink-0 cursor-help', className)}
    >
      {s === 'now' && (
        <span className="absolute inset-0 animate-ping rounded-full bg-warn opacity-50 motion-reduce:animate-none" />
      )}
      <span
        className={cn(
          'relative rounded-full',
          s === 'now' && 'bg-warn',
          s === 'yes' && 'bg-accent',
          s === 'opt' && 'border border-ink-3',
          s === 'done' && 'bg-good',
        )}
      />
    </span>
  )
}
