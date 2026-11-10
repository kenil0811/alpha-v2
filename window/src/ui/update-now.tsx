// Read now and Run now, one part, keeping those words: when it last happened just before the
// button ("Updated 12 min ago"), the full date and time on hover, busy while it runs. Times are the
// person's own day (W7).
import { RefreshCw } from 'lucide-react'
import { Button } from './button.tsx'
import { cn } from './cn.ts'

const full = (d: Date) =>
  d.toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })

// "just now", "12 min ago" within the hour, the time today, else the day and time.
export function updatedWords(at: string, now = Date.now()): string {
  const d = new Date(at)
  const min = Math.round((now - d.getTime()) / 60_000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min} min ago`
  if (d.toDateString() === new Date(now).toDateString())
    return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  return full(d)
}

export function UpdateNow({
  label,
  at,
  busy,
  onClick,
  disabled,
}: {
  label: string // Read now, Run now
  at: string | null | undefined
  busy: boolean
  onClick: () => void
  disabled?: boolean | undefined
}) {
  return (
    <span className="inline-flex items-center gap-2">
      <span
        className="whitespace-nowrap text-ink-3 text-sm"
        data-tip={at && !busy ? full(new Date(at)) : undefined}
      >
        {busy ? 'Updating…' : at ? `Updated ${updatedWords(at)}` : 'Not yet'}
      </span>
      <Button size="sm" disabled={busy || disabled} aria-busy={busy} onClick={onClick}>
        <RefreshCw className={cn('size-3.5', busy && 'animate-spin')} />
        {label}
      </Button>
    </span>
  )
}
