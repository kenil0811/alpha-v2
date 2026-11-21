// PROTOTYPE (Vikas, 20 Nov): a record page's properties end in a + in the next free cell, that adds
// one to its table; under them, how many are hidden, with a way to see them again (a hidden one's
// right-click shows it on every page once more).
import { Plus } from 'lucide-react'
import { useRef, useState } from 'react'
import { AddFieldForm } from './table/AddFieldForm.tsx'
import { Popover } from './ui/popover.tsx'

export function AddCell({ tableId }: { tableId: string }) {
  const [adding, setAdding] = useState(false)
  const anchor = useRef<HTMLButtonElement>(null)
  return (
    <div className="flex items-center border-hair border-b px-4.5 py-2.5">
      <button
        ref={anchor}
        type="button"
        aria-label="Add a property"
        data-tip="Add a property"
        onClick={() => setAdding(!adding)}
        className="grid size-7 place-items-center rounded-md text-ink-3 hover:bg-hover hover:text-ink"
      >
        <Plus className="size-4" />
      </button>
      <Popover anchor={anchor} open={adding} onClose={() => setAdding(false)}>
        <AddFieldForm tableId={tableId} title="Add a property" onAdded={() => setAdding(false)} />
      </Popover>
    </div>
  )
}

export function HiddenToggle({
  hidden,
  shown,
  onShow,
}: {
  hidden: number
  shown: boolean // the hidden ones are showing for now
  onShow: () => void
}) {
  return (
    <div className="border-hair border-t px-4.5 py-2 text-sm">
      <button type="button" onClick={onShow} className="text-ink-3 hover:text-ink">
        {shown ? 'Hide the hidden ones' : `${hidden} hidden`}
      </button>
    </div>
  )
}
