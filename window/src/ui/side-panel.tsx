// The side panel: detail on the right, 320px, pushing the content rather than covering it.
import { X } from 'lucide-react'
import type { ReactNode } from 'react'
import { IconButton } from './button.tsx'

export function SidePanel({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: ReactNode
}) {
  return (
    <aside className="flex min-h-0 w-80 shrink-0 flex-col border-line border-l bg-surface">
      <div className="flex h-11.5 shrink-0 items-center gap-2 border-hair border-b pr-2 pl-4.5 font-semibold text-ink text-md">
        <span className="flex-1 truncate">{title}</span>
        <IconButton label="Close" onClick={onClose}>
          <X className="size-4" />
        </IconButton>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">{children}</div>
    </aside>
  )
}
