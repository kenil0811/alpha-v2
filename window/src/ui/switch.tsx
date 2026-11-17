// A switch for something that is on or off (a schedule, connection tables in the rail). Its label
// is read aloud; it shows as a tip too, unless the same name sits beside it (named).
import { cn } from './cn.ts'

export function Switch({
  checked,
  onChange,
  label,
  named,
  disabled,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
  named?: boolean
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      data-tip={named ? undefined : label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative h-5 w-8 shrink-0 rounded-full transition-colors disabled:opacity-50',
        checked ? 'bg-good' : 'bg-line',
      )}
    >
      <span
        className={cn(
          'absolute top-0.5 size-4 rounded-full bg-surface shadow-btn transition-all',
          checked ? 'left-3.5' : 'left-0.5',
        )}
      />
    </button>
  )
}
