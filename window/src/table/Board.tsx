import type { FieldView, RowView, TableView as TableData } from '@alpha/core/api'
import { useState } from 'react'
import { api } from '../api.ts'
import { Select } from '../ui/field.tsx'
import { show } from './values.ts'

// The board: a column per choice, each row a card with its name and a few of its values, moved
// by setting its choice (the person's own word).
export function Board({ data, by }: { data: TableData; by: FieldView }) {
  const [busy, setBusy] = useState<string | null>(null)
  const name = data.fields.find((f) => f.kind === 'text')
  // on a card: up to two amounts, then up to two other choices, each only when it has a value
  const others = data.fields.filter((f) => f !== name && f !== by)
  const cardFields = (r: RowView) => [
    ...others.filter((f) => f.kind === 'money' && r.values[f.slug] != null).slice(0, 2),
    ...others.filter((f) => f.kind === 'choice' && r.values[f.slug] != null).slice(0, 2),
  ]
  const move = async (row: string, value: string) => {
    setBusy(row)
    await api
      .post(`/api/tables/${data.id}/rows/${row}`, { field: by.name, value })
      .catch(() => undefined)
    setBusy(null)
  }
  const columns = [...by.choices, '']
  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {columns.map((choice) => {
        const rows = data.rows.filter((r) => (r.values[by.slug] ?? '') === choice)
        if (choice === '' && rows.length === 0) return null
        return (
          <div key={choice || 'none'} className="flex w-56 shrink-0 flex-col gap-2">
            <div className="flex justify-between px-1 text-sm text-ink-2">
              <span>{choice || `No ${by.name.toLowerCase()}`}</span>
              <span className="text-ink-3">{rows.length}</span>
            </div>
            {rows.map((r) => (
              <div
                key={r.id}
                id={`row-${r.id}`}
                className="flex flex-col gap-1 rounded-lg border border-line px-3 py-2 text-base"
              >
                <div className="text-ink">
                  {name ? show(name, r.values[name.slug]) || 'Untitled' : 'Untitled'}
                </div>
                {cardFields(r).map((f) => {
                  const v = show(f, r.values[f.slug], data.names)
                  return v ? (
                    <div key={f.id} className="text-sm text-ink-2">
                      {f.name}: {v}
                    </div>
                  ) : null
                })}
                <Select
                  className="mt-1 h-6.5 text-sm"
                  value={choice}
                  disabled={busy === r.id}
                  aria-label={`Move to another ${by.name.toLowerCase()}`}
                  onChange={(e) => move(r.id, e.target.value)}
                >
                  {choice === '' && <option value="">Move to…</option>}
                  {by.choices.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </Select>
              </div>
            ))}
          </div>
        )
      })}
    </div>
  )
}
