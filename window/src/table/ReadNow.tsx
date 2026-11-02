// Read now on a table a connection fills (Batch B, pick 15, Kenil's yes 1 Nov): in its ⋮ menu, one
// press reads every connection that fills it and can be read now (Mail: Gmail and Outlook); one
// waiting on a sign-in or the customer stays greyed with its reason (W3). Under the table, a line
// says what reads into it and when it last did. Each connection's own Read now stays in
// Intelligence › Connections.
import type { ReadByView } from '@alpha/core/api'
import { RefreshCw } from 'lucide-react'
import { api } from '../api.ts'
import { useAct } from '../ui/act.tsx'
import { MenuItem } from '../ui/popover.tsx'
import { updatedWords } from '../ui/update-now.tsx'

// "Gmail and Outlook": each connector once, in the order they fill it.
export function titles(by: ReadByView[]): string {
  const names = [...new Set(by.map((r) => r.title))]
  return names.length > 1
    ? `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`
    : (names[0] ?? '')
}

// When it was last read, in the words every Read now and Run now uses (Batch D, 66.25): "12 min
// ago", the time today, else the day and time, in the person's own day (W7).
export function lastRead(by: ReadByView[], now: Date = new Date()): string | null {
  const at = by
    .map((r) => r.lastReadAt)
    .filter((x): x is string => !!x)
    .sort()
    .at(-1)
  return at ? updatedWords(at, now.getTime()) : null
}

// The line under the table: "Read by Gmail and Outlook, 10:42".
export function readByWords(by: ReadByView[], now: Date = new Date()): string | null {
  if (!by.length) return null
  const at = lastRead(by, now)
  return `Read by ${titles(by)}${at ? `, ${at}` : ', not yet'}`
}

export function ReadNowItems({
  tableId,
  readBy,
  onDone,
}: {
  tableId: string
  readBy: ReadByView[]
  onDone: () => void // the menu closes once the read is done
}) {
  const { busy, problem, act } = useAct()
  if (!readBy.length) return null
  const can = readBy.filter((r) => !r.reason)
  const waiting = readBy.filter((r) => r.reason)
  return (
    <>
      <MenuItem
        reason={can.length ? undefined : (waiting[0]?.reason ?? undefined)}
        disabled={busy}
        hint={busy ? 'Reading…' : titles(can.length ? can : readBy)}
        onClick={() =>
          void act(() => api.post(`/api/tables/${tableId}/read`)).then((ok) => ok && onDone())
        }
      >
        <RefreshCw className="size-3.5 text-ink-3" />
        Read now
      </MenuItem>
      {can.length > 0 &&
        waiting.map((r) => (
          <MenuItem key={r.connection} reason={r.reason ?? undefined} onClick={() => undefined}>
            <span className="w-3.5 shrink-0" />
            Read now from {r.title}
          </MenuItem>
        ))}
      {problem && <p className="max-w-64 px-2.5 py-1.5 text-sm text-warn">{problem}</p>}
    </>
  )
}
