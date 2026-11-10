// Deleting a module: keep its data, or delete all of it. Neither can be undone, so the button
// names what happens, and the journal keeps a line saying what went.
import type { ModuleSummary } from '@alpha/core/api'
import { useState } from 'react'
import { api } from './api.ts'
import { Refusal, useAct } from './ui/act.tsx'
import { Button } from './ui/button.tsx'
import { cn } from './ui/cn.ts'
import { Dialog } from './ui/dialog.tsx'

const WAYS = [
  {
    keep: true,
    label: 'Keep its data',
    words:
      'Its schedules, scripts and pages are deleted, so nothing in it runs. Its tables and rows stay where they are.',
  },
  {
    keep: false,
    label: 'Delete everything',
    words:
      'The module and any modules inside it, with their tables, rows, schedules and runs. Your files stay.',
  },
] as const

export function DeleteModule({
  module,
  open,
  onClose,
}: {
  module: ModuleSummary
  open: boolean
  onClose: () => void
}) {
  const [keep, setKeep] = useState(true)
  const { busy, problem, act } = useAct()
  return (
    <Dialog
      open={open}
      title={`Delete ${module.name}?`}
      onClose={onClose}
      actions={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="danger"
            disabled={busy}
            onClick={() =>
              void act(async () => {
                await api.post(`/api/modules/${module.id}/delete`, { keepData: keep })
                onClose()
                // Home after it goes: whatever was open may have gone with it
                window.location.hash = '#/'
              })
            }
          >
            {keep ? 'Delete what runs' : 'Delete everything'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-2">
        {WAYS.map((w) => (
          <label
            key={w.label}
            className={cn(
              'flex cursor-pointer gap-2.5 rounded-md border p-3',
              keep === w.keep ? 'border-accent bg-accent-soft' : 'border-line hover:bg-hover',
            )}
          >
            <input
              type="radio"
              name={`delete-${module.id}`}
              checked={keep === w.keep}
              onChange={() => setKeep(w.keep)}
              className="mt-1 accent-(--accent)"
            />
            <span className="flex flex-col gap-0.5">
              <span className="font-medium text-ink">{w.label}</span>
              <span className="text-ink-3 text-sm">{w.words}</span>
            </span>
          </label>
        ))}
        <p className="text-ink-3 text-sm">This can't be undone.</p>
        <Refusal words={problem} />
      </div>
    </Dialog>
  )
}
