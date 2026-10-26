import type { FieldView } from '@alpha/core/api'
import { type FormEvent, useState } from 'react'
import { api, Problem } from '../api.ts'
import { Button } from '../ui/button.tsx'
import { Field, Select, starred } from '../ui/field.tsx'
import { SidePanel } from '../ui/side-panel.tsx'

// Add a row: the person's own values, each saved as theirs; a choice starts on its ★ default.
export function AddRow({
  tableId,
  name,
  fields,
  onClose,
}: {
  tableId: string
  name: string
  fields: FieldView[]
  onClose: () => void
}) {
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      fields.filter((f) => f.kind === 'choice').map((f) => [f.name, starred(`choice.${f.id}`)]),
    ),
  )
  const [problem, setProblem] = useState<string | null>(null)
  const save = async (e: FormEvent) => {
    e.preventDefault()
    setProblem(null)
    const read: Record<string, unknown> = {}
    for (const f of fields) {
      const t = (values[f.name] ?? '').trim()
      if (!t) continue
      const n = Number(t.replace(/[$,\s]/g, ''))
      if ((f.kind === 'money' || f.kind === 'number') && Number.isNaN(n)) {
        setProblem(`${f.name} is not a number.`)
        return
      }
      read[f.name] =
        f.kind === 'money' ? { amount: n, currency: 'USD' } : f.kind === 'number' ? n : t
    }
    try {
      await api.post(`/api/tables/${tableId}/rows`, { values: read })
      onClose()
    } catch (err) {
      setProblem(err instanceof Problem ? err.message : 'That row was not added.')
    }
  }
  return (
    <SidePanel title={`Add a row to ${name}`} onClose={onClose}>
      <form onSubmit={save} className="flex flex-col gap-3 p-4.5">
        {fields.map((f) => (
          <label key={f.id} className="flex flex-col gap-1 text-md" htmlFor={`add-${f.id}`}>
            <span className="text-ink-2">{f.name}</span>
            {f.kind === 'choice' ? (
              <Select
                id={`add-${f.id}`}
                value={values[f.name] ?? ''}
                onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
                starKey={`choice.${f.id}`}
                adds={{ what: 'choice', to: `${f.name} in ${name}` }}
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
    </SidePanel>
  )
}
