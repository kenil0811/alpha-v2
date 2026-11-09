// What a module is for (core step 3e): who it is for, what it keeps track of and the decisions it
// serves, at the top of Setup. Alpha's words show as assumed until the person changes
// them; Edit makes them theirs, and a kit's update never writes over theirs.
import type { ModuleView } from '@alpha/core/api'
import { Pencil } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { api, wordsOf } from './api.ts'
import { Refusal } from './ui/act.tsx'
import { Button } from './ui/button.tsx'
import { Field } from './ui/field.tsx'

const BY = { kit: 'From the module', alpha: 'Assumed by Alpha', person: 'Yours' } as const

const PARTS = [
  ['for', 'For', 'Who it is for'],
  ['keeps', 'Keeps', 'What it keeps track of'],
  ['decides', 'Decides', 'The decisions it serves'],
] as const

export function ModuleCase({ m, onChange }: { m: ModuleView; onChange: () => void }) {
  const c = m.businessCase
  const [editing, setEditing] = useState(false)
  const [typed, setTyped] = useState({ for: '', keeps: '', decides: '' })
  const [problem, setProblem] = useState<string | null>(null)
  const open = () => {
    setTyped({ for: c?.for ?? '', keeps: c?.keeps ?? '', decides: c?.decides ?? '' })
    setProblem(null)
    setEditing(true)
  }
  const save = (e: FormEvent) => {
    e.preventDefault()
    api.post(`/api/modules/${m.id}/case`, typed).then(
      () => {
        setEditing(false)
        onChange()
      },
      (err: unknown) => setProblem(wordsOf(err)),
    )
  }
  return (
    <section className="flex flex-col">
      <div className="flex items-center justify-between">
        <h2 className="font-medium font-serif text-ink text-xl">What it is for</h2>
        {!editing && (
          <Button size="sm" variant="ghost" onClick={open}>
            <Pencil className="size-3.25" />
            {c ? 'Edit' : 'Write'}
          </Button>
        )}
      </div>
      <p className="mt-0.5 mb-2.5 text-ink-3 text-sm">
        {c
          ? `${BY[c.by]}. Alpha reads it before anything it does in ${m.name}.`
          : `Not written yet. Alpha writes it before it adds a table to ${m.name}, or write it now.`}
      </p>
      {editing ? (
        <form onSubmit={save} className="flex flex-col gap-2.5">
          {PARTS.map(([key, label, hint]) => (
            <label key={key} className="flex flex-col gap-1 text-md" htmlFor={`case-${key}`}>
              <span className="text-ink-2">{label}</span>
              <Field
                id={`case-${key}`}
                value={typed[key]}
                placeholder={hint}
                aria-label={hint}
                onChange={(e) => setTyped((t) => ({ ...t, [key]: e.target.value }))}
              />
            </label>
          ))}
          <Refusal words={problem} />
          <div className="flex gap-2">
            <Button
              type="submit"
              size="sm"
              variant="primary"
              disabled={!typed.for.trim() || !typed.keeps.trim() || !typed.decides.trim()}
            >
              Save as yours
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        c && (
          <dl className="flex flex-col">
            {PARTS.map(([key, label]) => (
              <div key={key} className="flex gap-4 border-hair border-t py-2 first:border-t-0">
                <dt className="w-20 shrink-0 text-ink-3 text-md">{label}</dt>
                <dd className={c.by === 'alpha' ? 'text-ink-2 text-md italic' : 'text-ink text-md'}>
                  {c[key]}
                </dd>
              </div>
            ))}
          </dl>
        )
      )}
    </section>
  )
}
