// Update now (Vikas, 30 Oct: "the date should be next to the button… replace Look again with
// Update now"): the one button wherever something can be run again now (an agent's line, Insights,
// a table's readers, an agent's page), with when it last updated just before it, and busy while
// it runs. The full date and time are on the words' hover.
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

// "just now", "12 min ago" within the hour, "12:42" today, else "30 Oct, 12:42"
export function updatedWords(at: string, now = Date.now()): string {
  const d = new Date(at)
  const min = Math.round((now - d.getTime()) / 60_000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min} min ago`
  if (d.toDateString() === new Date(now).toDateString())
    return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
  return full(d)
}

export function UpdateNow({
  at,
  busy,
  onClick,
  tip,
  disabled,
}: {
  at: string | null | undefined
  busy: boolean
  onClick: () => void
  tip?: string
  disabled?: boolean
}) {
  return (
    <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
      <span
        className="whitespace-nowrap text-ink-3 text-sm"
        data-tip={at && !busy ? full(new Date(at)) : undefined}
      >
        {busy ? 'Updating…' : at ? `Updated ${updatedWords(at)}` : 'Not updated yet'}
      </span>
      <Button
        size="sm"
        disabled={busy || disabled}
        aria-busy={busy}
        data-tip={tip}
        onClick={onClick}
      >
        <RefreshCw className={cn('size-3.5', busy && 'animate-spin')} />
        Update now
      </Button>
    </span>
  )
}
