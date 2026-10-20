// A segmented control: one of a few views (Table · Board, All · Didn't finish).
import { cn } from './cn.ts'

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
  label: string
}) {
  return (
    <fieldset
      aria-label={label}
      className="m-0 inline-flex min-w-0 gap-0.5 rounded-md border border-line bg-sunk p-0.5"
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'h-6 rounded-sm px-2.5 text-ink-2 text-sm transition-colors hover:text-ink',
            value === o.value && 'bg-surface font-medium text-ink shadow-btn',
          )}
        >
          {o.label}
        </button>
      ))}
    </fieldset>
  )
}
