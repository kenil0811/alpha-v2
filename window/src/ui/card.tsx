// The card shell: a sunk head that names what it is (a gate, a question) and what it waits on,
// then its body. Cards sit in the stream; the shell is the same for every kind.
import type { ReactNode } from 'react'
import { Label } from './pill.tsx'

export function Card({
  label,
  waits,
  children,
}: {
  label: string
  waits?: string
  children: ReactNode
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-line bg-surface shadow-pop">
      <div className="flex items-center gap-2 border-line border-b bg-sunk px-3.5 py-2">
        <Label className="text-ink-2">{label}</Label>
        {waits && (
          <span className="ml-auto flex items-center gap-1.5 font-medium text-sm text-warn">
            <span className="size-1.5 rounded-full bg-warn" />
            {waits}
          </span>
        )}
      </div>
      <div className="flex flex-col gap-3 p-3.5">{children}</div>
    </div>
  )
}
