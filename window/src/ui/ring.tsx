// How far along something is, as a ring that fills step by step (motion, 23 Nov): people finish
// what they can see they are close to. Full, it turns green and gives a small bounce.
import { cn } from './cn.ts'

const R = 42
const ROUND = 2 * Math.PI * R

export function Ring({ done, of, className }: { done: number; of: number; className?: string }) {
  const full = of > 0 && done >= of
  return (
    <svg
      viewBox="0 0 100 100"
      role="img"
      aria-label={`${done} of ${of}`}
      className={cn(
        'size-10 shrink-0 transition-transform duration-320 ease-spring',
        full && 'animate-[pop_320ms_var(--ease-spring)]',
        className,
      )}
    >
      <circle cx="50" cy="50" r={R} fill="none" strokeWidth="10" className="stroke-line" />
      <circle
        cx="50"
        cy="50"
        r={R}
        fill="none"
        strokeWidth="10"
        strokeLinecap="round"
        strokeDasharray={ROUND}
        strokeDashoffset={ROUND * (1 - (of ? Math.min(done, of) / of : 0))}
        className={cn(
          '-rotate-90 origin-center transition-[stroke-dashoffset,stroke] duration-320 ease-soft',
          full ? 'stroke-good' : 'stroke-accent',
        )}
      />
    </svg>
  )
}
