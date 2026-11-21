// PROTOTYPE (Vikas, 20 Nov): under a record page's properties, a + that adds one to its table (the
// grid's own form), and how many are hidden, with a way to see them again (a hidden one's
// right-click shows it on every page once more).
import { Plus } from 'lucide-react'
import { useRef, useState } from 'react'
import { AddFieldForm } from './table/Grid.tsx'
import { Popover } from './ui/popover.tsx'

export function FieldsFoot({
  tableId,
  hidden,
  shown,
  onShow,
}: {
  tableId: string
  hidden: number
  shown: boolean // the hidden ones are showing for now
  onShow: () => void
}) {
  const [adding, setAdding] = useState(false)
  const anchor = useRef<HTMLButtonElement>(null)
  return (
    <div className="flex items-center gap-4 border-hair border-t px-4.5 py-2 text-sm">
      <button
        ref={anchor}
        type="button"
        onClick={() => setAdding(!adding)}
        className="flex items-center gap-1.5 text-ink-3 hover:text-ink"
      >
        <Plus className="size-3.5" />
        Add a property
      </button>
      {hidden > 0 && (
        <button type="button" onClick={onShow} className="text-ink-3 hover:text-ink">
          {shown ? 'Hide the hidden ones' : `${hidden} hidden`}
        </button>
      )}
      <Popover anchor={anchor} open={adding} onClose={() => setAdding(false)}>
        <AddFieldForm tableId={tableId} title="Add a property" onAdded={() => setAdding(false)} />
      </Popover>
    </div>
  )
}
