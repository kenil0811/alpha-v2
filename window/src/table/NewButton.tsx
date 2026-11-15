// New: adds a row in the page's own panel, or says on hover why one can't be added here. Under
// a table and under a board alike.
import { Plus } from 'lucide-react'
import { Button } from '../ui/button.tsx'

export function NewButton({
  onNew,
  className,
}: {
  onNew: (() => void) | string // what New does, or why it can't
  className?: string
}) {
  const why = typeof onNew === 'string' ? onNew : undefined
  return (
    <span data-tip={why} className={className}>
      <Button size="sm" disabled={!!why} onClick={typeof onNew === 'string' ? undefined : onNew}>
        <Plus className="size-3.5" />
        New
      </Button>
    </span>
  )
}
