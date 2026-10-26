// The form: one row at a time, every field the person can type in, stepping through the view's
// rows; or a new row. Saving makes each changed value the person's word.
import type { FieldView, RowView } from '@alpha/core/api'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { type FormEvent, useEffect, useState } from 'react'
import { askForNew } from '../../ask.ts'
import { Button, IconButton } from '../../ui/button.tsx'
import { Field, Select } from '../../ui/field.tsx'
import { CORRECTABLE, readValue, show, titleOf, typedOf } from '../values.ts'

export function FormView({
  table,
  rows,
  fields,
  names,
  onSave,
}: {
  table: string // its name, for Add new…
  rows: RowView[]
  fields: FieldView[]
  names: Record<string, string>
  onSave: (row: RowView | null, values: Record<string, unknown>) => Promise<boolean>
}) {
  const [at, setAt] = useState(0)
  const [adding, setAdding] = useState(rows.length === 0)
  const row = adding ? null : (rows[Math.min(at, rows.length - 1)] ?? null)
  const start = (r: RowView | null) =>
    Object.fromEntries(fields.map((f) => [f.slug, r ? typedOf(f, r.values[f.slug]) : '']))
  const [typed, setTyped] = useState<Record<string, string>>(() => start(row))
  const [problem, setProblem] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  // a new row, or the same row changed elsewhere, starts the form again
  useEffect(() => {
    setTyped(start(row))
    setProblem(null)
  }, [row?.id, row?.values, adding])
  const changed = fields.filter(
    (f) =>
      CORRECTABLE.has(f.kind) &&
      (typed[f.slug] ?? '') !== (row ? typedOf(f, row.values[f.slug]) : ''),
  )
  const save = async (e: FormEvent) => {
    e.preventDefault()
    const values: Record<string, unknown> = {}
    for (const f of changed) {
      const read = readValue(f, typed[f.slug] ?? '', row?.values[f.slug])
      if ('problem' in read) return setProblem(read.problem)
      values[f.name] = read.value
    }
    if (!Object.keys(values).length) return
    if (await onSave(row, values)) {
      setSaved(true)
      setTimeout(() => setSaved(false), 1600)
      if (adding) setTyped(start(null))
    }
  }
  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-7 pb-6">
      <form
        onSubmit={save}
        className="flex max-w-stream flex-col gap-4 rounded-lg border border-line bg-surface p-5"
      >
        <div className="flex items-center gap-2">
          <h2 className="min-w-0 flex-1 truncate font-medium font-serif text-ink text-xl">
            {adding ? 'A new row' : row ? titleOf(fields, row) : ''}
          </h2>
          {!adding && rows.length > 0 && (
            <>
              <span className="text-ink-3 text-sm tabular-nums">
                {Math.min(at, rows.length - 1) + 1} of {rows.length}
              </span>
              <IconButton label="The row before" disabled={at <= 0} onClick={() => setAt(at - 1)}>
                <ChevronLeft className="size-4" />
              </IconButton>
              <IconButton
                label="The row after"
                disabled={at >= rows.length - 1}
                onClick={() => setAt(at + 1)}
              >
                <ChevronRight className="size-4" />
              </IconButton>
            </>
          )}
          <Button size="sm" variant="ghost" onClick={() => setAdding(!adding)}>
            {adding ? (
              'Back to the rows'
            ) : (
              <>
                <Plus className="size-3.25" />A new row
              </>
            )}
          </Button>
        </div>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-x-4 gap-y-3">
          {fields.map((f) => (
            <label key={f.id} className="flex flex-col gap-1 text-md" htmlFor={`form-${f.id}`}>
              <span className="text-ink-2">{f.name}</span>
              {!CORRECTABLE.has(f.kind) ? (
                <span id={`form-${f.id}`} className="py-1 text-ink-3">
                  {(row && show(f, row.values[f.slug], names)) || 'Set by asking Alpha'}
                </span>
              ) : f.kind === 'choice' ? (
                <Select
                  id={`form-${f.id}`}
                  value={typed[f.slug] ?? ''}
                  onChange={(e) => setTyped({ ...typed, [f.slug]: e.target.value })}
                  adds={{
                    what: 'choice',
                    send: (w) => askForNew('choice', `${f.name} in ${table}`, w),
                  }}
                >
                  <option value="" />
                  {f.choices.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </Select>
              ) : (
                <Field
                  id={`form-${f.id}`}
                  type={f.kind === 'date' ? 'date' : 'text'}
                  value={typed[f.slug] ?? ''}
                  onChange={(e) => {
                    setTyped({ ...typed, [f.slug]: e.target.value })
                    setProblem(null)
                  }}
                />
              )}
            </label>
          ))}
        </div>
        {problem && <div className="text-bad text-sm">{problem}</div>}
        <div className="flex items-center gap-2">
          <Button type="submit" size="sm" variant="primary" disabled={!changed.length}>
            {adding ? 'Add it' : 'Save as yours'}
          </Button>
          {saved && <span className="text-good text-sm">Saved.</span>}
          {!adding && changed.length > 0 && (
            <span className="text-ink-3 text-sm">
              {changed.length} change{changed.length === 1 ? '' : 's'}
            </span>
          )}
        </div>
      </form>
    </div>
  )
}
