// The window's one yes and no: a tick and a cross, side by side. Each grows a little under the
// pointer and names itself in the window's tooltip, just under the icon (Approve, Decline, or the
// screen's own words); the one picked fills in green or red. Every place a person says yes or no
// to one thing (a line Alpha learned, a guess, a proposal) uses this, never two worded buttons.
import { Check, X } from 'lucide-react'
import { cn } from './cn.ts'

export type Answer = 'yes' | 'no' | null

export function YesNo({
  value,
  onChange,
  yes = 'Approve',
  no = 'Decline',
  disabled,
  className,
}: {
  value: Answer
  onChange: (answer: 'yes' | 'no') => void
  yes?: string
  no?: string
  disabled?: boolean
  className?: string
}) {
  const one = (answer: 'yes' | 'no', label: string) => {
    const picked = value === answer
    return (
      <button
        type="button"
        aria-label={label}
        aria-pressed={picked}
        data-tip={label}
        disabled={disabled}
        onClick={() => onChange(answer)}
        className={cn(
          'grid size-7 place-items-center rounded-md border transition-[transform,background-color,border-color,color] duration-150 ease-out hover:scale-110 active:scale-95 disabled:pointer-events-none disabled:opacity-50',
          picked
            ? answer === 'yes'
              ? 'border-good bg-good text-surface'
              : 'border-bad bg-bad text-surface'
            : answer === 'yes'
              ? 'border-line bg-surface text-ink-3 hover:border-good hover:bg-good-soft hover:text-good'
              : 'border-line bg-surface text-ink-3 hover:border-bad hover:bg-bad-soft hover:text-bad',
        )}
      >
        {answer === 'yes' ? <Check className="size-3.5" /> : <X className="size-3.5" />}
      </button>
    )
  }
  return (
    <span className={cn('inline-flex shrink-0 items-center gap-1', className)}>
      {one('yes', yes)}
      {one('no', no)}
    </span>
  )
}
