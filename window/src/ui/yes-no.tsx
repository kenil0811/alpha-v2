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

// An edit in place ends on the same pair: the tick keeps it, the cross puts it back, each naming
// itself in the tooltip. Pressing one never takes the focus from the box first, so the box's own
// leaving (a save) does not run before the cross.
export function SaveCancel({ onSave, onCancel }: { onSave: () => void; onCancel: () => void }) {
  const one = (save: boolean) => (
    <button
      type="button"
      aria-label={save ? 'Save' : 'Cancel'}
      data-tip={save ? 'Save' : 'Cancel'}
      onMouseDown={(e) => e.preventDefault()}
      onClick={save ? onSave : onCancel}
      className={cn(
        'press swell grid size-7 shrink-0 place-items-center rounded-md border border-line bg-surface text-ink-3',
        save
          ? 'hover:border-good hover:bg-good-soft hover:text-good'
          : 'hover:border-bad hover:bg-bad-soft hover:text-bad',
      )}
    >
      {save ? <Check className="size-3.5" /> : <X className="size-3.5" />}
    </button>
  )
  return (
    <span className="inline-flex shrink-0 items-center gap-1">
      {one(true)}
      {one(false)}
    </span>
  )
}
