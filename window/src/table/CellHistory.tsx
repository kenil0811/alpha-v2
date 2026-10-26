import type { FieldView, HistoryView } from '@alpha/core/api'
import { useEffect, useState } from 'react'
import { api } from '../api.ts'
import { Button } from '../ui/button.tsx'
import { Dialog } from '../ui/dialog.tsx'
import { show } from './values.ts'

// One value's history, newest first: what it was before and after, who or what changed it, when.
export function CellHistory({
  tableId,
  row,
  field,
  rowName,
  names,
  onClose,
}: {
  tableId: string
  row: string
  field: FieldView
  rowName: string
  names: Record<string, string>
  onClose: () => void
}) {
  const [steps, setSteps] = useState<HistoryView[] | null>(null)
  useEffect(() => {
    api
      .get<HistoryView[]>(`/api/tables/${tableId}/rows/${row}/history?field=${field.slug}`)
      .then(setSteps, () => setSteps([]))
  }, [tableId, row, field.slug])
  const text = (v: unknown) => show(field, v, names) || 'Empty'
  return (
    <Dialog
      open
      title={`${field.name} of ${rowName}`}
      onClose={onClose}
      actions={<Button onClick={onClose}>Close</Button>}
    >
      {steps === null ? (
        <p className="text-ink-3">Loading…</p>
      ) : steps.length === 0 ? (
        <p className="text-ink-3">No changes kept.</p>
      ) : (
        <ol className="-mt-1 max-h-96 overflow-auto">
          {steps.map((h, i) => (
            <li
              key={i}
              className="flex flex-col gap-0.5 border-hair border-t py-2 first:border-t-0"
            >
              <span className="text-ink tabular-nums">
                {i + 1 < steps.length && (
                  <span className="text-ink-3">{text(steps[i + 1]?.value)} → </span>
                )}
                <span className="font-medium">{text(h.value)}</span>
              </span>
              <span className="text-ink-3 text-sm tabular-nums">
                {h.source
                  ? `${h.source.words} · ${new Date(h.source.at).toLocaleString(undefined, {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}`
                  : 'Not kept'}
              </span>
            </li>
          ))}
        </ol>
      )}
    </Dialog>
  )
}
