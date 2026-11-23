// Anything a person is asked to paste somewhere else (a command for Terminal, an address for a
// provider's page, a permission's name) sits in one monospace box with its copy button at the
// right, so it is copied with one click and never selected by hand.

import { cn } from './cn.ts'
import { CopyButton } from './copy.tsx'

export function CodeLine({ text, className }: { text: string; className?: string }) {
  return (
    <span
      className={cn(
        'flex min-w-0 max-w-full items-center gap-1 rounded-md border border-line bg-hover py-0.5 pr-0.5 pl-2.5 font-mono text-sm text-ink',
        className,
      )}
    >
      <span className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap">{text}</span>
      <CopyButton text={() => text} />
    </span>
  )
}
