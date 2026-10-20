// A switch for something that is on or off (an agent, connection tables in the rail).
import { cn } from './cn.ts'

export function Switch({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      title={label}
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
