// New: adds a row in the page's own panel, or says on hover why one can't be added here. At the
// right of a table's toolbar, beside the ⋮, on every layout but the form (which adds by itself).
import { Plus } from 'lucide-react'
import { Button } from '../ui/button.tsx'

export function NewButton({
  onNew,
}: {
  onNew: (() => void) | string // what New does, or why it can't
}) {
  const why = typeof onNew === 'string' ? onNew : undefined
  return (
    <span data-tip={why}>
      <Button size="sm" disabled={!!why} onClick={typeof onNew === 'string' ? undefined : onNew}>
        <Plus className="size-3.5" />
        New
      </Button>
    </span>
  )
}
