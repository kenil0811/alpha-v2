import type { FieldView } from '@alpha/core/api'
import { type FormEvent, useState } from 'react'
import { api, Problem } from '../api.ts'
import { askForNew } from '../ask.ts'
import { Button } from '../ui/button.tsx'
import { cn } from '../ui/cn.ts'
import { Dialog } from '../ui/dialog.tsx'
import { Field, Select } from '../ui/field.tsx'
import { SidePanel } from '../ui/side-panel.tsx'
import { TagPicker } from './Tags.tsx'
import { isTags, readValue } from './values.ts'

// Add a row: the person's own values, each saved as theirs. In the side panel, or in a dialog
// while the assistant has the side. A part added from its row's view comes with that row given
// (`fixed`, by field name), and notes are written on the row, not here.
export function AddRow({
  tableId,
  name,
  fields: all,
  dialog = false,
  fixed = {},
  onClose,
}: {
  tableId: string
  name: string
  fields: FieldView[]
  dialog?: boolean
  fixed?: Record<string, unknown>
  onClose: () => void
}) {
  // a summary is worked out from other rows, never typed (core step 3c)
  const fields = all.filter((f) => f.kind !== 'notes' && !f.summary && !(f.name in fixed))
  const [values, setValues] = useState<Record<string, string>>({})
  const [problem, setProblem] = useState<string | null>(null)
  const save = async (e: FormEvent) => {
    e.preventDefault()
    setProblem(null)
    const read: Record<string, unknown> = {}
    for (const f of fields) {
      const t = (values[f.name] ?? '').trim()
      if (!t) continue
      if (isTags(f)) {
        const tags = readValue(f, t)
        if ('problem' in tags) return setProblem(tags.problem)
        read[f.name] = tags.value
        continue
      }
      const n = Number(t.replace(/[$,\s]/g, ''))
      if ((f.kind === 'money' || f.kind === 'number') && Number.isNaN(n)) {
        setProblem(`${f.name} is not a number.`)
        return
      }
      read[f.name] =
        f.kind === 'money' ? { amount: n, currency: 'USD' } : f.kind === 'number' ? n : t
    }
    try {
      await api.post(`/api/tables/${tableId}/rows`, { values: { ...read, ...fixed } })
      onClose()
    } catch (err) {
      setProblem(err instanceof Problem ? err.message : 'That row was not added.')
    }
  }
  const title = `Add a row to ${name}`
  const form = (
    <form onSubmit={save} className={cn('flex flex-col gap-3', !dialog && 'p-4.5')}>
      {fields.map((f) => (
        <label key={f.id} className="flex flex-col gap-1 text-md" htmlFor={`add-${f.id}`}>
          <span className="text-ink-2">{f.name}</span>
          {isTags(f) ? (
            <TagPicker
              field={f}
              typed={values[f.name] ?? ''}
              onTyped={(t) => setValues((v) => ({ ...v, [f.name]: t }))}
              table={name}
            />
          ) : f.kind === 'choice' ? (
            <Select
              id={`add-${f.id}`}
              value={values[f.name] ?? ''}
              onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
              stars={f.id}
              adds={{ what: 'choice', send: (w) => askForNew('choice', `${f.name} in ${name}`, w) }}
            >
              <option value="" />
              {f.choices.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Select>
          ) : (
            <Field
              id={`add-${f.id}`}
              type={f.kind === 'date' ? 'date' : 'text'}
              value={values[f.name] ?? ''}
              onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
            />
          )}
        </label>
      ))}
      {problem && <div className="text-bad text-sm">{problem}</div>}
      <div className="flex gap-2">
        <Button type="submit" size="sm" variant="primary">
          Add it
        </Button>
        <Button size="sm" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </form>
  )
  return dialog ? (
    <Dialog open title={title} onClose={onClose}>
      {form}
    </Dialog>
  ) : (
    <SidePanel title={title} onClose={onClose}>
      {form}
    </SidePanel>
  )
}
