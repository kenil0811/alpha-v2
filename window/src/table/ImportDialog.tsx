// ⋮ › Import: a CSV or spreadsheet into this table. One drop zone, then one row per header with
// the property it goes to (the one named the same, else Skip), then Import (rules T26).
import type { FieldView } from '@alpha/core/api'
import { useState } from 'react'
import { api } from '../api.ts'
import { Refusal, useAct } from '../ui/act.tsx'
import { Button } from '../ui/button.tsx'
import { Dialog } from '../ui/dialog.tsx'
import { DropZone } from '../ui/drop-zone.tsx'
import { Select } from '../ui/field.tsx'
import { canType } from './values.ts'

export function ImportDialog({
  tableId,
  fields,
  onClose,
}: {
  tableId: string
  fields: FieldView[]
  onClose: () => void
}) {
  const typeable = fields.filter(canType)
  const [file, setFile] = useState<{ hash: string; name: string } | null>(null)
  const [map, setMap] = useState<[string, string][]>([]) // header, property name ('' is Skip)
  // rows of this table that came from the file already: importing it again is the person's choice
  const [already, setAlready] = useState(0)
  const [again, setAgain] = useState(false)
  const { busy, problem, act } = useAct()
  const pick = (files: File[]) => {
    const f = files[0]
    if (f)
      void act(async () => {
        const up = await api.upload(f)
        const read = await api.get<{ headers: string[]; already: number }>(
          `/api/tables/${tableId}/import?file=${encodeURIComponent(up.hash)}`,
        )
        const headers = read.headers
        setAlready(read.already)
        setAgain(false)
        setFile({ hash: up.hash, name: up.name })
        setMap(
          headers.map((h) => [
            h,
            typeable.find((t) => t.name.toLowerCase() === h.toLowerCase())?.name ?? '',
          ]),
        )
      })
  }
  const columns = Object.fromEntries(map.filter(([, to]) => to))
  return (
    <Dialog
      open
      wide
      title="Import"
      onClose={onClose}
      actions={
        <>
          <Refusal words={problem} />
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            disabled={busy || !file || !Object.keys(columns).length || (already > 0 && !again)}
            onClick={() =>
              void act(async () => {
                await api.post(`/api/tables/${tableId}/import`, {
                  file: file?.hash,
                  columns,
                  again,
                })
                onClose()
              })
            }
          >
            Import
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <DropZone busy={busy && !file} onFiles={pick} />
        {file && (
          <div className="flex flex-col gap-1.5">
            <div className="text-ink-3 text-sm">{file.name}</div>
            {already > 0 && (
              <label className="flex items-center gap-2 text-ink-2 text-sm">
                <input
                  type="checkbox"
                  className="accent-accent"
                  checked={again}
                  onChange={(e) => setAgain(e.target.checked)}
                />
                {already.toLocaleString()} row{already === 1 ? '' : 's'} here came from this file
                already: import it again
              </label>
            )}
            {map.map(([header, to], i) => (
              <div key={header} className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-ink">{header}</span>
                <Select
                  aria-label={`Property for ${header}`}
                  value={to}
                  onChange={(e) =>
                    setMap((m) => m.map((x, j) => (j === i ? [x[0], e.target.value] : x)))
                  }
                >
                  <option value="">Skip</option>
                  {typeable.map((f) => (
                    <option key={f.id} value={f.name}>
                      {f.name}
                    </option>
                  ))}
                </Select>
              </div>
            ))}
          </div>
        )}
      </div>
    </Dialog>
  )
}
