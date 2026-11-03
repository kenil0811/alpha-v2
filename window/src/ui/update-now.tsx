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
  words = true,
}: {
  at: string | null | undefined
  busy: boolean
  onClick: () => void
  tip?: string
  disabled?: boolean
  words?: boolean // false where room is short (beside a switch): the time is on the button's hover
}) {
  return (
    // kept at the right; in a narrow card's head (a container) the words go, and their time
    // moves to the button's hover
    <span className="flex min-w-0 flex-wrap items-center justify-end gap-x-2 gap-y-1">
      <span
        className={cn(
          'whitespace-nowrap text-ink-3 text-sm @max-[22rem]:hidden',
          !words && 'hidden',
        )}
        data-tip={at && !busy ? full(new Date(at)) : undefined}
      >
        {busy ? 'Updating…' : at ? `Updated ${updatedWords(at)}` : 'Not updated yet'}
      </span>
      <Button
        size="sm"
        disabled={busy || disabled}
        aria-busy={busy}
        data-tip={[tip, at && !busy && `Updated ${full(new Date(at))}`].filter(Boolean).join('. ')}
        onClick={onClick}
      >
        <RefreshCw className={cn('size-3.5', busy && 'animate-spin')} />
        Update now
      </Button>
    </span>
  )
}
