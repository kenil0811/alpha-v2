// The window's one yes and no: a tick and a cross, side by side. Each grows a little under the
// pointer and names itself in the window's tooltip, just under the icon (Approve, Decline, or the
// screen's own words); the one picked fills in green or red. Every place a person says yes or no
// to one thing (a line Alpha learned, a guess, a proposal) uses this, never two worded buttons.
import { Check, X } from 'lucide-react'
import type { MouseEvent } from 'react'
import { cn } from './cn.ts'

export type Answer = 'yes' | 'no' | null

export function YesNo({
  value,
  onChange,
  yes = 'Approve',
  no = 'Decline',
  disabled,
  autoFocus,
  className,
}: {
  value: Answer
  onChange: (answer: 'yes' | 'no') => void
  yes?: string
  no?: string
  disabled?: boolean
  autoFocus?: boolean // on the tick, for a choice opened by the keyboard or a double-click
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
        // biome-ignore lint/a11y/noAutofocus: asked for where the choice opens from a double-click
        autoFocus={autoFocus && answer === 'yes'}
        onClick={() => onChange(answer)}
        className={cn(
          'press swell grid size-7 place-items-center rounded-md border disabled:pointer-events-none disabled:opacity-50',
          picked
            ? answer === 'yes'
              ? 'border-good bg-good text-surface'
              : 'border-bad bg-bad text-surface'
            : answer === 'yes'
              ? 'border-line bg-surface text-ink-3 hover:border-good hover:bg-good-soft hover:text-good'
              : 'border-line bg-surface text-ink-3 hover:border-bad hover:bg-bad-soft hover:text-bad',
        )}
      >
        {answer === 'yes' ? (
          <Check className={cn('size-3.5', picked && 'pop')} />
        ) : (
          <X className={cn('size-3.5', picked && 'pop')} />
        )}
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

// Whether a card's answers are a plain yes and no, drawn as the tick and the cross; any other
// answers ("Yes, and also", three of them) keep their words.
export const isYesNo = (options: readonly string[]) =>
  options.length === 2 && options[0] === 'Yes' && options[1] === 'No'

// One tick or one cross on its own, the word sliding out on hover or focus: an edit's Save and
// Cancel, a card's Approve and Decline (Vikas, 23 Nov). The tick wears the accent.

export function TickOrCross({
  yes,
  words,
  busy,
  onClick,
}: {
  yes: boolean
  words: string
  busy?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-label={words}
      disabled={busy}
      // the edit it ends keeps its focus until the click lands
      onMouseDown={(e: MouseEvent) => e.preventDefault()}
      onClick={onClick}
      className={cn(
        'group/act inline-flex h-7 shrink-0 items-center rounded-full px-1.5 font-medium text-sm disabled:opacity-40',
        yes
          ? 'bg-accent text-accent-ink'
          : 'border border-line bg-surface text-ink-2 hover:text-ink',
      )}
    >
      {yes ? <Check className="size-4" /> : <X className="size-4" />}
      <span className="max-w-0 overflow-hidden whitespace-nowrap transition-[max-width,margin] duration-150 group-hover/act:ml-1 group-hover/act:max-w-40 group-focus-visible/act:ml-1 group-focus-visible/act:max-w-40">
        {words}
      </span>
    </button>
  )
}
