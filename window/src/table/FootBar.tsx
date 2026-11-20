// A table's foot, under its rows in every view: New at the left, then, while the list on screen
// differs from what was saved, Cancel and Save ▾ (Save; Save as new list) at the right, before
// the pages. A list Alpha keeps itself saves nothing: Cancel alone.
import type { SavedView } from '@alpha/core/api'
import { ChevronDown, CopyPlus } from 'lucide-react'
import { type ReactNode, useRef, useState } from 'react'
import { Button } from '../ui/button.tsx'
import { MenuItem, Popover } from '../ui/popover.tsx'
import { NewButton } from './NewButton.tsx'
import { NameForm } from './ViewTabs.tsx'

export function FootBar({
  onNew,
  dirty,
  keeps,
  view,
  onReset,
  onSave,
  onSaveAs,
  children,
}: {
  onNew: (() => void) | string | null // null: no New here (the form adds by itself)
  dirty: boolean
  keeps: boolean // false on a list Alpha keeps itself: it holds no saved lists
  view: SavedView | undefined // the saved list on screen; none, All
  onReset: () => void
  onSave: () => void
  onSaveAs: (name: string) => void
  children?: ReactNode // what else sits at the right: who reads into it, the pages
}) {
  const [saving, setSaving] = useState(false) // Save ▾
  const [naming, setNaming] = useState(false)
  const saveAt = useRef<HTMLSpanElement>(null)
  return (
    <div className="flex min-h-11 shrink-0 items-center gap-2 px-7 pb-2 text-ink-3 text-sm">
      {onNew !== null && <NewButton onNew={onNew} />}
      <span className="ml-auto flex items-center gap-2">
        {dirty && (
          <>
            <Button
              size="sm"
              variant="ghost"
              onClick={onReset}
              data-tip="Go back to what was saved"
            >
              Cancel
            </Button>
            {keeps && (
              <span ref={saveAt} className="flex shrink-0">
                {view ? (
                  <>
                    <Button
                      size="sm"
                      variant="primary"
                      className="rounded-r-none"
                      onClick={onSave}
                      data-tip="Everyone sees the change"
                    >
                      Save
                    </Button>
                    <Button
                      size="sm"
                      variant="primary"
                      className="rounded-l-none border-l-accent-ink/30 px-1.25"
                      aria-haspopup="menu"
                      aria-expanded={saving}
                      aria-label="More ways to save"
                      data-tip="More ways to save"
                      onClick={() => setSaving((o) => !o)}
                    >
                      <ChevronDown className="size-3.5" />
                    </Button>
                  </>
                ) : (
                  <Button size="sm" variant="primary" onClick={() => setNaming(true)}>
                    Save as list
                  </Button>
                )}
              </span>
            )}
          </>
        )}
        {children}
      </span>
      <Popover anchor={saveAt} open={saving} onClose={() => setSaving(false)} align="end">
        <MenuItem
          onClick={() => {
            setSaving(false)
            setNaming(true)
          }}
        >
          <CopyPlus className="size-3.5 text-ink-3" />
          Save as new list
        </MenuItem>
      </Popover>
      <Popover anchor={saveAt} open={naming} onClose={() => setNaming(false)} align="end">
        <NameForm
          start=""
          label="Save"
          onSave={(name) => {
            setNaming(false)
            onSaveAs(name)
          }}
        />
      </Popover>
    </div>
  )
}
