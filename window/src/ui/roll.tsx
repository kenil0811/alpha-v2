// A number that rolls to its new value, each digit sliding into place (motion, 23 Nov), so a
// change is noticed: counts in the rail and on tabs, a dashboard's figures. Read aloud as written.
import { cn } from './cn.ts'

const DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']

export function Roll({ value, className }: { value: number | string; className?: string }) {
  const text = typeof value === 'number' ? value.toLocaleString() : value
  const chars = [...text]
  return (
    <span className={cn('relative inline-flex whitespace-pre tabular-nums', className)}>
      <span className="sr-only">{text}</span>
      {chars.map((c, i) => {
        // counted from the right, so the units stay the units as a number grows
        const at = chars.length - i
        return /\d/.test(c) ? (
          <span key={at} aria-hidden="true" className="inline-block h-lh overflow-hidden">
            <span
              className="flex flex-col transition-transform duration-320 ease-spring"
              style={{ transform: `translateY(${-Number(c)}lh)` }}
            >
              {DIGITS.map((d) => (
                <span key={d} className="h-lh">
                  {d}
                </span>
              ))}
            </span>
          </span>
        ) : (
          <span key={at} aria-hidden="true">
            {c}
          </span>
        )
      })}
    </span>
  )
}
